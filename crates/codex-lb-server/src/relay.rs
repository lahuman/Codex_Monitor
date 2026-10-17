use crate::business;
// Owned in-process server lifecycle.

use axum::{Json, Router, http::StatusCode, routing::get};
use serde::Serialize;
use std::{
    net::{Ipv4Addr, SocketAddr},
    time::Duration,
};
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};

#[derive(Debug, thiserror::Error)]
pub enum ServerError {
    #[error("The server is already started; stop it before changing the port")]
    AlreadyStarted,
    #[error("Cannot listen on {address}: {source}")]
    Bind {
        address: SocketAddr,
        source: std::io::Error,
    },
    #[error("Cannot inspect listener: {0}")]
    Listener(std::io::Error),
    #[error("Server failed: {0}")]
    Serve(std::io::Error),
    #[error("Server task failed: {0}")]
    Task(tokio::task::JoinError),
    #[error("Shutdown exceeded its deadline; cleanup is still in progress")]
    StopTimeout,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Stopped,
    Listening,
    Stopping,
    Exited,
}

#[derive(Clone, Debug, Serialize)]
pub struct ServerStatus {
    pub phase: Phase,
    pub address: Option<SocketAddr>,
    pub full_compatibility_verified: bool,
}

struct RunningServer {
    address: SocketAddr,
    shutdown: Option<oneshot::Sender<()>>,
    task: JoinHandle<std::io::Result<()>>,
}

impl Drop for RunningServer {
    fn drop(&mut self) {
        // A dropped JoinHandle would detach the listener. Never detach owned work.
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
        self.task.abort();
    }
}

#[derive(Default)]
pub struct Server {
    running: Option<RunningServer>,
}

impl Server {
    pub fn status(&self) -> ServerStatus {
        let (phase, address) = match &self.running {
            None => (Phase::Stopped, None),
            Some(server) if server.task.is_finished() => (Phase::Exited, Some(server.address)),
            Some(server) if server.shutdown.is_none() => (Phase::Stopping, Some(server.address)),
            Some(server) => (Phase::Listening, Some(server.address)),
        };
        ServerStatus {
            phase,
            address,
            full_compatibility_verified: false,
        }
    }

    pub async fn start(&mut self, port: u16) -> Result<ServerStatus, ServerError> {
        self.start_router(port, routes(None)).await
    }

    pub async fn start_with_service(
        &mut self,
        port: u16,
        service: std::sync::Arc<business::Service>,
    ) -> Result<ServerStatus, ServerError> {
        self.start_router(
            port,
            routes(Some(service.clone())).merge(crate::proxy::routes(service)),
        )
        .await
    }

    async fn start_router(
        &mut self,
        port: u16,
        router: Router,
    ) -> Result<ServerStatus, ServerError> {
        if self.running.is_some() {
            return Err(ServerError::AlreadyStarted);
        }
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        let listener = TcpListener::bind(address)
            .await
            .map_err(|source| ServerError::Bind { address, source })?;
        let address = listener.local_addr().map_err(ServerError::Listener)?;
        let (shutdown, stop) = oneshot::channel();
        let task = tokio::spawn(async move {
            axum::serve(listener, router)
                .with_graceful_shutdown(async {
                    let _ = stop.await;
                })
                .await
        });
        self.running = Some(RunningServer {
            address,
            shutdown: Some(shutdown),
            task,
        });
        Ok(self.status())
    }

    pub async fn stop(&mut self, deadline: Duration) -> Result<ServerStatus, ServerError> {
        let Some(server) = &mut self.running else {
            return Ok(self.status());
        };
        if let Some(shutdown) = server.shutdown.take() {
            let _ = shutdown.send(());
        }
        let completed = match tokio::time::timeout(deadline, &mut server.task).await {
            Ok(completed) => completed,
            // Preserve the task and its ownership on timeout. A subsequent stop
            // continues waiting; it cannot accidentally start a second listener.
            Err(_) => return Err(ServerError::StopTimeout),
        };
        self.running = None;
        completed
            .map_err(ServerError::Task)?
            .map_err(ServerError::Serve)?;
        Ok(self.status())
    }
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Serialize)]
struct HealthCheck {
    status: &'static str,
    checks: Option<serde_json::Value>,
    bridge_ring: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct Detail {
    detail: &'static str,
}

fn routes(service: Option<std::sync::Arc<business::Service>>) -> Router {
    Router::new()
        .route("/health", get(|| async { Json(Health { status: "ok" }) }))
        .route(
            "/health/live",
            get(|| async {
                Json(HealthCheck {
                    status: "ok",
                    checks: None,
                    bridge_ring: None,
                })
            }),
        )
        .route(
            "/health/ready",
            get(move || {
                let service = service.clone();
                async move {
                    use axum::response::IntoResponse;
                    if service.as_ref().is_some_and(|service| service.ready()) {
                        Json(HealthCheck {
                            status: "ok",
                            checks: None,
                            bridge_ring: None,
                        })
                        .into_response()
                    } else {
                        (
                            StatusCode::SERVICE_UNAVAILABLE,
                            Json(Detail {
                                detail: "Service unavailable",
                            }),
                        )
                            .into_response()
                    }
                }
            }),
        )
        .fallback(|| async {
            (
                StatusCode::NOT_FOUND,
                Json(Detail {
                    detail: "Not Found",
                }),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn shutdown_timeout_retains_owned_task_and_listener() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let (shutdown, _stop) = oneshot::channel();
        let (release, released) = oneshot::channel();
        let task = tokio::spawn(async move {
            let _ = released.await;
            drop(listener);
            Ok(())
        });
        let mut server = Server {
            running: Some(RunningServer {
                address,
                shutdown: Some(shutdown),
                task,
            }),
        };
        assert!(matches!(
            server.stop(Duration::ZERO).await,
            Err(ServerError::StopTimeout)
        ));
        assert_eq!(server.status().phase, Phase::Stopping);
        assert!(matches!(
            server.start(0).await,
            Err(ServerError::AlreadyStarted)
        ));
        assert!(TcpListener::bind(address).await.is_err());
        release.send(()).unwrap();
        assert_eq!(
            server.stop(Duration::from_secs(2)).await.unwrap().phase,
            Phase::Stopped
        );
        assert!(TcpListener::bind(address).await.is_ok());
    }
}
