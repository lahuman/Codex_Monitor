use axum::{
    Json, Router,
    body::{Body, Bytes},
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use codex_lb_server::{
    Server,
    business::{Endpoints, Service},
};
use serde_json::{Value, json};
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};
use tokio::net::TcpListener;

#[derive(Default)]
struct Mock {
    generations: AtomicUsize,
    refreshes: AtomicUsize,
    active: AtomicUsize,
    polls: AtomicUsize,
    delay_refresh: AtomicUsize,
}
fn jwt(exp: u64) -> String {
    format!("e30.{}.signature",URL_SAFE_NO_PAD.encode(serde_json::to_vec(&json!({"exp":exp,"email":"fixture@example.test","sub":"seat-1","https://api.openai.com/auth":{"chatgpt_account_id":"workspace-1","chatgpt_plan_type":"plus"}})).unwrap()))
}
fn tokens(exp: u64) -> Value {
    json!({"access_token":jwt(exp),"id_token":jwt(exp),"refresh_token":"fixture-refresh-secret","account_id":"workspace-1"})
}
fn auth(exp: u64) -> String {
    json!({"tokens":tokens(exp)}).to_string()
}
async fn quota(headers: HeaderMap) -> Response {
    assert_eq!(headers["chatgpt-account-id"], "workspace-1");
    assert!(
        headers["authorization"]
            .to_str()
            .unwrap()
            .starts_with("Bearer e30.")
    );
    Json(json!({"rate_limit":{"primary_window":{"used_percent":17,"reset_at":1900000000}}}))
        .into_response()
}
async fn token(State(mock): State<Arc<Mock>>, headers: HeaderMap, body: Bytes) -> Response {
    if headers["content-type"]
        .to_str()
        .unwrap()
        .contains("application/json")
    {
        let body: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["grant_type"], "refresh_token");
        assert_eq!(body["refresh_token"], "fixture-refresh-secret");
        mock.refreshes.fetch_add(1, Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(
            mock.delay_refresh.load(Ordering::SeqCst) as u64,
        ))
        .await;
    } else {
        assert!(
            std::str::from_utf8(&body)
                .unwrap()
                .contains("grant_type=authorization_code")
        );
    }
    Json(tokens(4102444800)).into_response()
}
struct Active(Arc<Mock>);
impl Drop for Active {
    fn drop(&mut self) {
        self.0.active.fetch_sub(1, Ordering::SeqCst);
    }
}
async fn generation(
    State(mock): State<Arc<Mock>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    assert_eq!(headers["chatgpt-account-id"], "workspace-1");
    assert_eq!(body["store"], false);
    assert_eq!(body["stream"], true);
    mock.generations.fetch_add(1, Ordering::SeqCst);
    if body["model"] == "denied" {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error":{"code":"rate_limit_exceeded"}})),
        )
            .into_response();
    }
    if body["model"] == "redirect" {
        return (
            StatusCode::TEMPORARY_REDIRECT,
            [("location", "http://127.0.0.1:1/leak")],
        )
            .into_response();
    }
    if body["model"] == "hanging" {
        mock.active.fetch_add(1, Ordering::SeqCst);
        let guard = Active(mock);
        let stream = async_stream::stream! {let _guard=guard;loop{yield Ok::<_,std::io::Error>(Bytes::from_static(b": heartbeat\n\n"));tokio::time::sleep(Duration::from_millis(20)).await;}};
        return (
            [("content-type", "text/event-stream")],
            Body::from_stream(stream),
        )
            .into_response();
    }
    let terminal = json!({"type":"response.completed","response":{"id":"resp-fixture","object":"response","status":"completed","output":[{"content":[{"type":"output_text","text":"안녕"}]}],"usage":{"input_tokens":12,"output_tokens":7,"input_tokens_details":{"cached_tokens":3}}}});
    let data = if body["model"] == "truncated" {
        "data: {\"type\":\"response.created\"}\n\n".to_owned()
    } else {
        format!(
            "data: {{\"type\":\"response.output_text.delta\",\"delta\":\"안녕\"}}\r\n\r\ndata: {terminal}\r\n\r\n"
        )
    };
    let chunks: Vec<_> = data
        .as_bytes()
        .chunks(3)
        .map(|b| Ok::<_, std::io::Error>(Bytes::copy_from_slice(b)))
        .collect();
    (
        [("content-type", "text/event-stream")],
        Body::from_stream(futures_util::stream::iter(chunks)),
    )
        .into_response()
}
struct Fixture {
    mock: Arc<Mock>,
    service: Arc<Service>,
    server: Server,
    upstream: tokio::task::JoinHandle<()>,
    dir: tempfile::TempDir,
    endpoints: Endpoints,
    client: reqwest::Client,
    url: String,
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.upstream.abort();
    }
}
impl Fixture {
    async fn new() -> Self {
        let mock = Arc::new(Mock::default());
        let router=Router::new().route("/wham/usage",get(quota)).route("/oauth/token",post(token)).route("/codex/responses",post(generation))
        .route("/codex/responses/compact",post(||async{Json(json!({"object":"response.compaction","output":[],"usage":{"input_tokens":4,"output_tokens":2}}))}))
        .route("/api/accounts/deviceauth/usercode",post(||async{Json(json!({"device_auth_id":"fixture-device","usercode":"TEST-CODE","interval":"1","expires_in":30}))}))
        .route("/api/accounts/deviceauth/token",post(|State(mock):State<Arc<Mock>>|async move{if mock.polls.fetch_add(1,Ordering::SeqCst)==0 {(StatusCode::FORBIDDEN,Json(json!({"error":"authorization_pending"}))).into_response()}else{Json(json!({"authorization_code":"fixture-code","code_verifier":"fixture-verifier"})).into_response()}}))
        .with_state(mock.clone());
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let backend = format!("http://{}", listener.local_addr().unwrap());
        let endpoints = Endpoints {
            backend: backend.clone(),
            auth: backend,
        };
        let upstream = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let dir = tempfile::tempdir().unwrap();
        let service = Service::open(dir.path(), endpoints.clone()).unwrap();
        let mut server = Server::default();
        let status = server.start_with_service(0, service.clone()).await.unwrap();
        Self {
            mock,
            service,
            server,
            upstream,
            dir,
            endpoints,
            client: reqwest::Client::new(),
            url: format!("http://{}", status.address.unwrap()),
        }
    }
    fn request(&self, path: &str, body: Value) -> reqwest::RequestBuilder {
        self.client
            .post(format!("{}{path}", self.url))
            .bearer_auth(self.service.local_key().unwrap())
            .json(&body)
    }
}
#[tokio::test]
async fn import_quota_proxy_stream_compact_and_restart_are_durable() {
    let mut f = Fixture::new().await;
    let account = f.service.import(&auth(4102444800)).await.unwrap();
    f.service.refresh_usage(&account.id).await.unwrap();
    assert_eq!(
        f.service.dashboard().unwrap().accounts[0]
            .quota
            .as_ref()
            .unwrap()["rate_limit"]["primary_window"]["used_percent"],
        17
    );
    let response = f
        .request(
            "/v1/responses",
            json!({"model":"fixture","input":"test","stream":true}),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["x-codex-lb-account"], account.id);
    assert!(response.text().await.unwrap().contains("안녕"));
    let response = f
        .request("/v1/responses/", json!({"model":"fixture","input":"test"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.json::<Value>().await.unwrap()["id"],
        "resp-fixture"
    );
    let response = f
        .request(
            "/v1/responses/compact",
            json!({"model":"fixture","input":[]}),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let dashboard = f.service.dashboard().unwrap();
    assert_eq!(dashboard.requests.len(), 3);
    assert_eq!(dashboard.requests[1].usage.cached_tokens, Some(3));
    assert!(dashboard.requests.iter().all(|r| r.outcome == "completed"));
    f.server.stop(Duration::from_secs(2)).await.unwrap();
    let reopened = Service::open(f.dir.path(), f.endpoints.clone()).unwrap();
    assert_eq!(reopened.dashboard().unwrap().requests.len(), 3);
    assert_eq!(
        reopened.local_key().unwrap(),
        f.service.local_key().unwrap()
    );
    let bytes = std::fs::read(f.dir.path().join("vault.bin")).unwrap();
    assert!(
        !bytes
            .windows(b"fixture-refresh-secret".len())
            .any(|w| w == b"fixture-refresh-secret")
    );
    let safe = serde_json::to_string(&dashboard).unwrap();
    assert!(!safe.contains("access_token"));
    assert!(!safe.contains("fixture-refresh-secret"));
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(f.dir.path().join("vault.key"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }
}
#[tokio::test]
async fn authorization_pin_and_paused_account_fail_before_dispatch() {
    let f = Fixture::new().await;
    let a = f.service.import(&auth(4102444800)).await.unwrap();
    assert_eq!(
        f.client
            .post(format!("{}/v1/responses", f.url))
            .json(&json!({"model":"fixture"}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        f.request("/v1/responses", json!({"model":"fixture"}))
            .header("origin", "https://foreign.test")
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        f.request(
            "/v1/responses",
            json!({"model":"fixture","previous_response_id":"old"})
        )
        .send()
        .await
        .unwrap()
        .status(),
        400
    );
    assert_eq!(
        f.request(
            "/v1/responses",
            json!({"model":"fixture","input":[{"file_id":"owned"}]})
        )
        .send()
        .await
        .unwrap()
        .status(),
        400
    );
    f.service.change_account(&a.id, false, true).await.unwrap();
    assert_eq!(
        f.request("/v1/responses", json!({"model":"fixture"}))
            .send()
            .await
            .unwrap()
            .status(),
        503
    );
    assert_eq!(f.mock.generations.load(Ordering::SeqCst), 0);
    f.service.change_account(&a.id, false, false).await.unwrap();
    assert_eq!(
        f.request(
            "/v1/responses",
            json!({"model":"fixture","previous_response_id":"old"})
        )
        .header("x-codex-lb-account", &a.id)
        .send()
        .await
        .unwrap()
        .status(),
        200
    );
    f.service.change_account(&a.id, true, false).await.unwrap();
    assert!(f.service.dashboard().unwrap().accounts.is_empty());
}
#[tokio::test]
async fn expired_token_refresh_is_singleflight() {
    let f = Fixture::new().await;
    let a = f.service.import(&auth(1)).await.unwrap();
    let (one, two) = tokio::join!(
        f.service.refresh_usage(&a.id),
        f.service.refresh_usage(&a.id)
    );
    one.unwrap();
    two.unwrap();
    assert_eq!(f.mock.refreshes.load(Ordering::SeqCst), 1);
    let response = f
        .request("/v1/responses", json!({"model":"fixture"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(f.mock.refreshes.load(Ordering::SeqCst), 1);
}
#[tokio::test]
async fn upstream_errors_are_not_retried_and_unknown_usage_is_not_zero() {
    let f = Fixture::new().await;
    f.service.import(&auth(4102444800)).await.unwrap();
    assert_eq!(
        f.request("/v1/responses", json!({"model":"denied"}))
            .send()
            .await
            .unwrap()
            .status(),
        429
    );
    assert_eq!(
        f.request("/v1/responses", json!({"model":"truncated"}))
            .send()
            .await
            .unwrap()
            .status(),
        502
    );
    let d = f.service.dashboard().unwrap();
    assert_eq!(d.requests[0].outcome, "incomplete");
    assert!(d.requests[0].usage.input_tokens.is_none());
    assert_eq!(d.requests[1].outcome, "http_error");
    assert_eq!(f.mock.generations.load(Ordering::SeqCst), 2);
}
#[tokio::test]
async fn cancellation_releases_upstream_and_records_outcome() {
    let f = Fixture::new().await;
    f.service.import(&auth(4102444800)).await.unwrap();
    let mut response = f
        .request("/v1/responses", json!({"model":"hanging","stream":true}))
        .send()
        .await
        .unwrap();
    response.chunk().await.unwrap();
    drop(response);
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            if f.service.dashboard().unwrap().requests[0].outcome == "cancelled"
                && f.mock.active.load(Ordering::SeqCst) == 0
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
}
#[tokio::test]
async fn device_authorization_obeys_poll_interval_and_connects() {
    let f = Fixture::new().await;
    assert!(f.service.pending_login().await.is_err());
    let view = f.service.start_login().await.unwrap();
    let pending = f.service.pending_login().await.unwrap();
    assert_eq!(
        pending.verification_url,
        format!("{}/codex/device", f.endpoints.auth)
    );
    assert_eq!(pending.user_code, view.user_code);
    assert_eq!(pending.expires_at, view.expires_at);
    assert_eq!(view.user_code, "TEST-CODE");
    assert_eq!(
        serde_json::to_value(f.service.poll_login().await.unwrap()).unwrap()["status"],
        "pending"
    );
    assert_eq!(f.mock.polls.load(Ordering::SeqCst), 0);
    tokio::time::sleep(Duration::from_millis(1050)).await;
    assert_eq!(
        serde_json::to_value(f.service.poll_login().await.unwrap()).unwrap()["status"],
        "pending"
    );
    tokio::time::sleep(Duration::from_millis(1050)).await;
    assert_eq!(
        serde_json::to_value(f.service.poll_login().await.unwrap()).unwrap()["status"],
        "connected"
    );
    assert_eq!(f.service.dashboard().unwrap().accounts.len(), 1);
    assert!(f.service.poll_login().await.is_err());
    assert!(f.service.pending_login().await.is_err());
    f.service.start_login().await.unwrap();
    f.service.cancel_login().await.unwrap();
    assert!(f.service.pending_login().await.is_err());
}
#[tokio::test]
async fn malformed_auth_and_tampered_vault_fail_closed() {
    let f = Fixture::new().await;
    assert!(f.service.import("{\"tokens\":{}}").await.is_err());
    assert!(f.service.dashboard().unwrap().accounts.is_empty());
    let path = f.dir.path().join("vault.bin");
    let mut bytes = std::fs::read(&path).unwrap();
    bytes[20] ^= 1;
    std::fs::write(path, bytes).unwrap();
    assert!(Service::open(f.dir.path(), f.endpoints.clone()).is_err());
}

#[tokio::test]
async fn cancelling_usage_during_rotation_does_not_abandon_rotated_tokens() {
    let f = Fixture::new().await;
    let a = f.service.import(&auth(1)).await.unwrap();
    f.mock.delay_refresh.store(150, Ordering::SeqCst);
    let service = f.service.clone();
    let id = a.id.clone();
    let job = tokio::spawn(async move { service.refresh_usage(&id).await });
    tokio::time::timeout(Duration::from_secs(2), async {
        while f.mock.refreshes.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    job.abort();
    let _ = job.await;
    f.service.drain_auth().await.unwrap();
    f.service.refresh_usage(&a.id).await.unwrap();
    assert_eq!(f.mock.refreshes.load(Ordering::SeqCst), 1);
}
#[tokio::test]
async fn failed_rotation_persistence_retains_token_and_blocks_dispatch() {
    let f = Fixture::new().await;
    let a = f.service.import(&auth(1)).await.unwrap();
    let path = f.dir.path().join("vault.bin");
    let backup = f.dir.path().join("saved.bin");
    std::fs::rename(&path, &backup).unwrap();
    std::fs::create_dir(&path).unwrap();
    assert!(f.service.refresh_usage(&a.id).await.is_err());
    assert!(f.service.dashboard().unwrap().storage_pending);
    assert_eq!(
        f.request("/v1/responses", json!({"model":"fixture"}))
            .send()
            .await
            .unwrap()
            .status(),
        503
    );
    assert_eq!(f.mock.generations.load(Ordering::SeqCst), 0);
    std::fs::remove_dir(&path).unwrap();
    std::fs::rename(backup, &path).unwrap();
    f.service.refresh_usage(&a.id).await.unwrap();
    assert_eq!(f.mock.refreshes.load(Ordering::SeqCst), 1);
    assert!(!f.service.dashboard().unwrap().storage_pending);
}

#[tokio::test]
async fn capacity_bounds_streams_and_releases_slots_after_disconnect() {
    let f = Fixture::new().await;
    f.service.import(&auth(4102444800)).await.unwrap();
    let mut responses = Vec::new();
    for _ in 0..8 {
        let mut r = f
            .request("/v1/responses", json!({"model":"hanging","stream":true}))
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 200);
        r.chunk().await.unwrap();
        responses.push(r);
    }
    assert_eq!(
        f.request("/v1/responses", json!({"model":"fixture"}))
            .send()
            .await
            .unwrap()
            .status(),
        429
    );
    drop(responses);
    tokio::time::timeout(Duration::from_secs(3), async {
        while f.mock.active.load(Ordering::SeqCst) != 0 {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(
        f.request("/v1/responses", json!({"model":"fixture"}))
            .send()
            .await
            .unwrap()
            .status(),
        200
    );
}
#[tokio::test]
async fn readiness_and_error_envelopes_match_real_service_state() {
    let f = Fixture::new().await;
    assert_eq!(
        f.client
            .get(format!("{}/health/ready", f.url))
            .send()
            .await
            .unwrap()
            .status(),
        200
    );
    let response = f
        .client
        .post(format!("{}/v1/responses", f.url))
        .bearer_auth(f.service.local_key().unwrap())
        .body("{")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 400);
    assert_eq!(
        response.json::<Value>().await.unwrap()["error"]["code"],
        "invalid_json"
    );
    f.service.import(&auth(4102444800)).await.unwrap();
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    let response = client
        .post(format!("{}/v1/responses", f.url))
        .bearer_auth(f.service.local_key().unwrap())
        .json(&json!({"model":"redirect"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 307);
    assert_eq!(f.mock.generations.load(Ordering::SeqCst), 1);
}
