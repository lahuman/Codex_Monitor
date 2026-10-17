use crate::business::{Service, TokenUsage, bounded_bytes};
use axum::{
    Extension, Json, Router,
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, OriginalUri, Request, State, rejection::BytesRejection},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::post,
};
use serde_json::{Value, json};
use std::sync::Arc;

pub fn routes(service: Arc<Service>) -> Router {
    Router::new()
        .route("/v1/responses", post(relay))
        .route("/v1/responses/", post(relay))
        .route("/backend-api/codex/responses", post(relay))
        .route("/v1/responses/compact", post(relay))
        .route("/backend-api/codex/responses/compact", post(relay))
        .layer(DefaultBodyLimit::max(16 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(service.clone(), authorize))
        .with_state(service)
}
fn error(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(json!({"error":{"message":message,"type":"proxy_error","code":code}})),
    )
        .into_response()
}
struct RecordGuard {
    service: Arc<Service>,
    id: String,
    status: Option<u16>,
    settled: bool,
}
impl RecordGuard {
    fn finish(&mut self, outcome: &str, usage: TokenUsage) -> Result<(), crate::business::Error> {
        // Even on a disk failure the in-memory final result must not become cancelled.
        self.settled = true;
        self.service.finish(&self.id, outcome, self.status, usage)
    }
}
impl Drop for RecordGuard {
    fn drop(&mut self) {
        if !self.settled {
            let _ = self
                .service
                .finish(&self.id, "cancelled", self.status, TokenUsage::default());
        }
    }
}
fn usage(value: &Value) -> TokenUsage {
    TokenUsage {
        input_tokens: value["input_tokens"].as_u64(),
        output_tokens: value["output_tokens"].as_u64(),
        cached_tokens: value["input_tokens_details"]["cached_tokens"].as_u64(),
    }
}
/// Incremental SSE framing. Bytes may split UTF-8, CRLF or multiline data anywhere.
#[derive(Default)]
struct Events {
    line: Vec<u8>,
    data: Vec<u8>,
    skip_lf: bool,
    terminal: Option<Value>,
}
impl Events {
    fn push(&mut self, chunk: &[u8]) -> Result<(), ()> {
        for &byte in chunk {
            if self.skip_lf {
                self.skip_lf = false;
                if byte == b'\n' {
                    continue;
                }
            }
            if byte == b'\r' || byte == b'\n' {
                self.end_line()?;
                self.skip_lf = byte == b'\r';
            } else {
                if self.line.len() + self.data.len() >= 16 * 1024 * 1024 {
                    return Err(());
                }
                self.line.push(byte);
            }
        }
        Ok(())
    }
    fn end_line(&mut self) -> Result<(), ()> {
        if self.line.is_empty() {
            if !self.data.is_empty() {
                let text = std::str::from_utf8(&self.data).map_err(|_| ())?;
                if text.trim() != "[DONE]" {
                    let event: Value = serde_json::from_str(text).map_err(|_| ())?;
                    if matches!(
                        event["type"].as_str(),
                        Some(
                            "response.completed"
                                | "response.failed"
                                | "response.incomplete"
                                | "error"
                        )
                    ) && self.terminal.is_none()
                    {
                        self.terminal = Some(event);
                    }
                }
                self.data.clear();
            }
        } else if let Some(data) = self.line.strip_prefix(b"data:") {
            let data = data.strip_prefix(b" ").unwrap_or(data);
            if !self.data.is_empty() {
                self.data.push(b'\n');
            }
            self.data.extend_from_slice(data);
        }
        self.line.clear();
        Ok(())
    }
    fn outcome(&self) -> &'static str {
        match self.terminal.as_ref().and_then(|v| v["type"].as_str()) {
            Some("response.completed") => "completed",
            Some("response.failed" | "error") => "failed",
            _ => "incomplete",
        }
    }
    fn usage(&self) -> TokenUsage {
        self.terminal
            .as_ref()
            .map(|v| usage(&v["response"]["usage"]))
            .unwrap_or_default()
    }
}
async fn authorize(
    State(service): State<Arc<Service>>,
    mut request: Request,
    next: Next,
) -> Response {
    let headers = request.headers();
    if headers.contains_key("origin")
        || !service.authorized(headers.get("authorization").and_then(|s| s.to_str().ok()))
    {
        return error(
            StatusCode::UNAUTHORIZED,
            "invalid_api_key",
            "A local application bearer key is required.",
        );
    }
    let Ok(permit) = service.capacity.clone().try_acquire_owned() else {
        return error(
            StatusCode::TOO_MANY_REQUESTS,
            "capacity",
            "Too many active requests.",
        );
    };
    request.extensions_mut().insert(Arc::new(permit));
    next.run(request).await
}
async fn relay(
    State(service): State<Arc<Service>>,
    Extension(_permit): Extension<Arc<tokio::sync::OwnedSemaphorePermit>>,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
    body: Result<Bytes, BytesRejection>,
) -> Response {
    let body = match body {
        Ok(body) => body,
        Err(rejection) => {
            return error(
                rejection.status(),
                "invalid_body",
                "Cannot read request body within the 16 MiB limit.",
            );
        }
    };
    let Ok(mut payload) = serde_json::from_slice::<Value>(&body) else {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_json",
            "Expected a JSON object.",
        );
    };
    let Some(object) = payload.as_object_mut() else {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_json",
            "Expected a JSON object.",
        );
    };
    let Some(model) = object
        .get("model")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty() && s.len() <= 256)
        .map(str::to_owned)
    else {
        return error(
            StatusCode::BAD_REQUEST,
            "model_required",
            "A model is required.",
        );
    };
    let pin = match headers.get("x-codex-lb-account") {
        Some(value) => match value.to_str() {
            Ok(s) => Some(s),
            Err(_) => {
                return error(
                    StatusCode::BAD_REQUEST,
                    "invalid_account",
                    "Invalid account pin.",
                );
            }
        },
        None => None,
    };
    if (object.contains_key("previous_response_id") || object.contains_key("conversation"))
        && pin.is_none()
    {
        return error(
            StatusCode::BAD_REQUEST,
            "account_pin_required",
            "Continuation requests require x-codex-lb-account from the application's account list.",
        );
    }
    // File IDs belong to one upstream account; never silently balance those.
    fn contains_file(value: &Value) -> bool {
        match value {
            Value::Object(o) => o.contains_key("file_id") || o.values().any(contains_file),
            Value::Array(a) => a.iter().any(contains_file),
            _ => false,
        }
    }
    if pin.is_none() && contains_file(&payload) {
        return error(
            StatusCode::BAD_REQUEST,
            "account_pin_required",
            "File requests require an explicit account pin.",
        );
    }
    let compact = uri.path().trim_end_matches('/').ends_with("/compact");
    if !compact && payload.get("stream").is_some_and(|v| !v.is_boolean()) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_stream",
            "stream must be boolean.",
        );
    }
    let stream = !compact && payload["stream"].as_bool().unwrap_or(false);
    if let Some(input) = payload["input"].as_str() {
        payload["input"] = json!([{"role":"user","content":[{"type":"input_text","text":input}]}]);
    } else if payload.get("input").is_none() {
        payload["input"] = json!([]);
    } else if !payload["input"].is_array() {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "input must be a string or array.",
        );
    }
    for field in [
        "max_output_tokens",
        "metadata",
        "prompt_cache_retention",
        "safety_identifier",
        "temperature",
        "top_p",
        "truncation",
        "user",
    ] {
        payload.as_object_mut().unwrap().remove(field);
    }
    if compact {
        for field in [
            "stream",
            "store",
            "include",
            "tools",
            "tool_choice",
            "text",
            "client_metadata",
        ] {
            payload.as_object_mut().unwrap().remove(field);
        }
    }

    if compact {
        payload["parallel_tool_calls"] = json!(false);
    }
    if !compact {
        payload["stream"] = json!(true);
        payload["store"] = json!(false);
        if payload.get("instructions").is_none() {
            payload["instructions"] = json!("");
        }
    }
    let credential = match service.credential(pin, false).await {
        Ok(c) => c,
        Err(e) => {
            return error(
                StatusCode::SERVICE_UNAVAILABLE,
                "account_unavailable",
                &e.to_string(),
            );
        }
    };
    let id = match service.begin(&credential, model) {
        Ok(id) => id,
        Err(e) => {
            return error(
                StatusCode::SERVICE_UNAVAILABLE,
                "storage_unavailable",
                &e.to_string(),
            );
        }
    };
    let mut guard = RecordGuard {
        service: service.clone(),
        id,
        status: None,
        settled: false,
    };
    let path = if compact {
        "codex/responses/compact"
    } else {
        "codex/responses"
    };
    let mut request = service
        .client
        .post(format!("{}/{path}", service.endpoints.backend))
        .bearer_auth(&credential.access_token)
        .header("chatgpt-account-id", &credential.account_id)
        .header(
            "accept",
            if compact {
                "application/json"
            } else {
                "text/event-stream"
            },
        )
        .json(&payload);
    // Forward session identity as supplied; credentials and hop-by-hop headers never pass through.
    for name in [
        "session_id",
        "conversation_id",
        "originator",
        "version",
        "user-agent",
        "openai-beta",
        "x-codex-turn-metadata",
        "x-codex-session-id",
    ] {
        if let Some(value) = headers.get(name) {
            request = request.header(name, value);
        }
    }
    let mut upstream = match request.send().await {
        Ok(r) => r,
        Err(_) => {
            let _ = guard.finish("network_error", TokenUsage::default());
            return error(
                StatusCode::BAD_GATEWAY,
                "upstream_connection",
                "Upstream connection failed; the request was not retried.",
            );
        }
    };
    let status = upstream.status();
    guard.status = Some(status.as_u16());
    let mut response_headers = HeaderMap::new();
    for name in ["x-request-id", "retry-after"] {
        if let Some(value) = upstream.headers().get(name) {
            response_headers.insert(name, value.clone());
        }
    }
    response_headers.insert(
        "x-codex-lb-account",
        credential.id.parse().expect("base64 identity"),
    );
    if !status.is_success() {
        let _ = guard.finish("http_error", TokenUsage::default());
        let bytes = match bounded_bytes(upstream, 1024 * 1024).await {
            Ok(b) => b,
            Err(_) => {
                return error(
                    StatusCode::BAD_GATEWAY,
                    "invalid_upstream_error",
                    "Cannot read upstream error.",
                );
            }
        };
        response_headers.insert("content-type", "application/json".parse().unwrap());
        return (status, response_headers, bytes).into_response();
    }
    if compact {
        let bytes = match bounded_bytes(upstream, 16 * 1024 * 1024).await {
            Ok(b) => b,
            Err(_) => {
                let _ = guard.finish("invalid_response", TokenUsage::default());
                return error(
                    StatusCode::BAD_GATEWAY,
                    "invalid_response",
                    "Cannot read compact response.",
                );
            }
        };
        let Ok(value) = serde_json::from_slice::<Value>(&bytes) else {
            let _ = guard.finish("invalid_response", TokenUsage::default());
            return error(
                StatusCode::BAD_GATEWAY,
                "invalid_response",
                "Expected compact JSON response.",
            );
        };
        if guard.finish("completed", usage(&value["usage"])).is_err() {
            return error(
                StatusCode::INSUFFICIENT_STORAGE,
                "storage_unavailable",
                "Usage could not be persisted.",
            );
        }
        response_headers.insert("content-type", "application/json".parse().unwrap());
        return (status, response_headers, bytes).into_response();
    }
    if !upstream
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|s| s.starts_with("text/event-stream"))
    {
        let _ = guard.finish("invalid_response", TokenUsage::default());
        return error(
            StatusCode::BAD_GATEWAY,
            "invalid_response",
            "Expected an upstream SSE response.",
        );
    }
    if stream {
        let output = async_stream::try_stream! {
            let _permit=_permit;
            let mut events=Events::default();
            loop {
                match upstream.chunk().await {
                    Ok(Some(bytes))=>{
                        if events.push(&bytes).is_err(){let _=guard.finish("invalid_response",TokenUsage::default());Err(std::io::Error::other("Invalid upstream SSE"))?;}
                        if events.terminal.is_some(){guard.finish(events.outcome(),events.usage()).map_err(|_|std::io::Error::other("Usage persistence failed"))?;}
                        yield bytes;
                        if events.terminal.is_some(){break}
                    }
                    Ok(None)=>{let _=guard.finish("incomplete",TokenUsage::default());Err(std::io::Error::other("Upstream closed before terminal event"))?;}
                    Err(_)=>{let _=guard.finish("network_error",TokenUsage::default());Err(std::io::Error::other("Upstream stream failed"))?;}
                }
            }
        };
        let output: std::pin::Pin<
            Box<dyn futures_util::Stream<Item = std::result::Result<Bytes, std::io::Error>> + Send>,
        > = Box::pin(output);
        response_headers.insert("content-type", "text/event-stream".parse().unwrap());
        response_headers.insert("cache-control", "no-cache".parse().unwrap());
        (status, response_headers, Body::from_stream(output)).into_response()
    } else {
        let mut events = Events::default();
        loop {
            match upstream.chunk().await {
                Ok(Some(bytes)) => {
                    if events.push(&bytes).is_err() {
                        let _ = guard.finish("invalid_response", TokenUsage::default());
                        return error(
                            StatusCode::BAD_GATEWAY,
                            "invalid_response",
                            "Invalid upstream SSE.",
                        );
                    }
                }
                Ok(None) | Err(_) => {
                    let _ = guard.finish("incomplete", TokenUsage::default());
                    return error(
                        StatusCode::BAD_GATEWAY,
                        "incomplete_response",
                        "Upstream closed before terminal event.",
                    );
                }
            }
            if events.terminal.is_some() {
                break;
            }
        }
        if guard.finish(events.outcome(), events.usage()).is_err() {
            return error(
                StatusCode::INSUFFICIENT_STORAGE,
                "storage_unavailable",
                "Usage could not be persisted.",
            );
        }
        if events.outcome() != "completed" {
            return error(
                StatusCode::BAD_GATEWAY,
                "upstream_failed",
                "Upstream did not complete the response.",
            );
        }
        (
            status,
            response_headers,
            Json(events.terminal.take().unwrap()["response"].clone()),
        )
            .into_response()
    }
}
