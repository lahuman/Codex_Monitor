use codex_lb_server::{Phase, Server, ServerError};
use serde_json::json;
use std::{net::Ipv4Addr, time::Duration};
use tokio::net::TcpListener;

fn client() -> reqwest::Client {
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap()
}

#[tokio::test]
async fn public_health_contract_and_incomplete_readiness_are_explicit() {
    let mut server = Server::default();
    let status = server.start(0).await.unwrap();
    assert_eq!(status.phase, Phase::Listening);
    assert!(!status.full_compatibility_verified);
    let base = format!("http://{}", status.address.unwrap());
    let client = client();
    let response = client.get(format!("{base}/health")).send().await.unwrap();
    assert_eq!(response.status(), 200);
    let body: serde_json::Value = serde_json::from_slice(&response.bytes().await.unwrap()).unwrap();
    assert_eq!(body, json!({"status":"ok"}));
    let response = client
        .get(format!("{base}/health/live"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let body: serde_json::Value = serde_json::from_slice(&response.bytes().await.unwrap()).unwrap();
    assert_eq!(
        body,
        json!({"status":"ok","checks":null,"bridge_ring":null})
    );
    assert_eq!(
        client
            .get(format!("{base}/health/ready"))
            .send()
            .await
            .unwrap()
            .status(),
        503
    );
    assert_eq!(
        client
            .get(format!("{base}/v1/models"))
            .send()
            .await
            .unwrap()
            .status(),
        404
    );
    assert_eq!(
        server.stop(Duration::from_secs(3)).await.unwrap().phase,
        Phase::Stopped
    );
}

#[tokio::test]
async fn occupied_port_does_not_attach_to_or_stop_foreign_listener() {
    let foreign = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
    let address = foreign.local_addr().unwrap();
    let mut server = Server::default();
    assert!(matches!(
        server.start(address.port()).await,
        Err(ServerError::Bind { .. })
    ));
    assert_eq!(
        server.stop(Duration::from_secs(1)).await.unwrap().phase,
        Phase::Stopped
    );
    assert!(TcpListener::bind(address).await.is_err());
    drop(foreign);
    let listener = TcpListener::bind(address).await.unwrap();
    drop(listener);
}

#[tokio::test]
async fn repeated_start_is_rejected_and_stop_releases_port_for_restart() {
    let mut server = Server::default();
    let address = server.start(0).await.unwrap().address.unwrap();
    assert!(matches!(
        server.start(0).await,
        Err(ServerError::AlreadyStarted)
    ));
    server.stop(Duration::from_secs(3)).await.unwrap();
    assert_eq!(
        server.start(address.port()).await.unwrap().address,
        Some(address)
    );
    server.stop(Duration::from_secs(3)).await.unwrap();
    server.stop(Duration::from_secs(3)).await.unwrap();
    assert!(TcpListener::bind(address).await.is_ok());
}

#[tokio::test]
async fn dropping_owner_does_not_detach_listener() {
    let mut server = Server::default();
    let address = server.start(0).await.unwrap().address.unwrap();
    drop(server);
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            if let Ok(listener) = TcpListener::bind(address).await {
                drop(listener);
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}
