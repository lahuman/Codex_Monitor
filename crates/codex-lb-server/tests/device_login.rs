use codex_lb_server::business::{Endpoints, LoginStatus, Service};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[tokio::test]
async fn approved_login_survives_restart_and_temporary_exchange_failure() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let polls = Arc::new(AtomicUsize::new(0));
    let exchanges = Arc::new(AtomicUsize::new(0));
    let p = polls.clone();
    let e = exchanges.clone();
    let provider = tokio::spawn(async move {
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut bytes = [0; 4096];
            loop {
                let n = socket.read(&mut bytes).await.unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&bytes[..n]);
                if let Some(end) = request.windows(4).position(|v| v == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]);
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .and_then(|n| n.trim().parse::<usize>().ok())
                        })
                        .unwrap_or(0);
                    if request.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let request = String::from_utf8(request).unwrap();
            let (status, body) = if request.starts_with("POST /api/accounts/deviceauth/usercode ") {
                (
                    200,
                    r#"{"device_auth_id":"fixture-device","user_code":"FIXTURE-CODE","interval":1,"expires_in":900}"#,
                )
            } else if request.starts_with("POST /api/accounts/deviceauth/token ") {
                if p.fetch_add(1, Ordering::SeqCst) == 0 {
                    (503, "temporary unavailable")
                } else {
                    (
                        200,
                        r#"{"authorization_code":"fixture-grant","code_verifier":"fixture-verifier"}"#,
                    )
                }
            } else {
                assert!(request.starts_with("POST /oauth/token "));
                assert!(request.contains("code=fixture-grant"));
                if e.fetch_add(1, Ordering::SeqCst) == 0 {
                    (503, "temporary unavailable")
                } else {
                    (
                        200,
                        r#"{"access_token":"fixture-access","refresh_token":"fixture-refresh","id_token":"fixture-id","account_id":"fixture-account"}"#,
                    )
                }
            };
            let response = format!(
                "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            socket.write_all(response.as_bytes()).await.unwrap();
        }
    });
    let dir = tempfile::tempdir().unwrap();
    let endpoints = Endpoints {
        auth: endpoint.clone(),
        backend: endpoint,
    };
    let service = Service::open(dir.path(), endpoints.clone()).unwrap();
    let view = service.start_login().await.unwrap();
    assert_eq!(view.user_code, "FIXTURE-CODE");
    drop(service);
    let service = Service::open(dir.path(), endpoints.clone()).unwrap();
    assert_eq!(
        service.pending_login().await.unwrap().user_code,
        view.user_code
    );
    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
    assert!(matches!(
        service.poll_login().await.unwrap(),
        LoginStatus::Retrying { .. }
    ));
    assert!(service.pending_login().await.is_ok());
    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
    assert!(matches!(
        service.poll_login().await.unwrap(),
        LoginStatus::Retrying { .. }
    ));
    assert_eq!(polls.load(Ordering::SeqCst), 2);
    drop(service);
    let service = Service::open(dir.path(), endpoints.clone()).unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
    assert!(matches!(
        service.poll_login().await.unwrap(),
        LoginStatus::Connected { .. }
    ));
    assert_eq!(
        polls.load(Ordering::SeqCst),
        2,
        "restart must resume the saved exchange, not repoll a consumed grant"
    );
    assert_eq!(exchanges.load(Ordering::SeqCst), 2);
    assert_eq!(service.dashboard().unwrap().accounts.len(), 1);
    assert!(service.pending_login().await.is_err());
    service.start_login().await.unwrap();
    service.cancel_login().await.unwrap();
    drop(service);
    let service = Service::open(dir.path(), endpoints).unwrap();
    assert!(service.pending_login().await.is_err());
    let vault = std::fs::read(dir.path().join("vault.bin")).unwrap();
    assert!(
        !vault
            .windows(b"fixture-access".len())
            .any(|v| v == b"fixture-access")
    );
    provider.abort();
    let _ = provider.await;
}
