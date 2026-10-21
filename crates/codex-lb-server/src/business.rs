//! Desktop-owned credentials and observed usage. JWT claims are unverified metadata.
use crate::storage::{Vault, random_key};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::{Mutex as AsyncMutex, Semaphore};

pub type Result<T> = std::result::Result<T, Error>;
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("앱 저장소를 읽거나 저장하지 못했습니다. 디스크 공간과 접근 권한을 확인하세요.")]
    Storage,
    #[error("인증 파일 형식이 올바르지 않습니다. Codex auth.json의 tokens 항목이 필요합니다.")]
    InvalidAuth,
    #[error("계정을 찾을 수 없거나 일시 정지 상태입니다.")]
    Account,
    #[error("연결된 활성 계정이 없습니다.")]
    NoAccount,
    #[error("네트워크 연결 또는 응답 읽기에 실패했습니다.")]
    Network,
    #[error("인증 서비스 또는 제공자가 HTTP {0} 오류를 반환했습니다.")]
    Upstream(u16),
    #[error("제공자 응답의 형식 또는 크기가 올바르지 않습니다.")]
    Protocol,
    #[error("로그인 코드가 만료되었습니다. 다시 로그인하세요.")]
    Expired,
    #[error("계정 수 제한(100개)에 도달했습니다.")]
    Capacity,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Tokens {
    #[serde(alias = "accessToken")]
    pub access_token: String,
    #[serde(alias = "refreshToken")]
    pub refresh_token: String,
    #[serde(alias = "idToken")]
    pub id_token: String,
    #[serde(default, alias = "accountId")]
    pub account_id: Option<String>,
}
#[derive(Deserialize)]
struct AuthFile {
    tokens: Tokens,
}
#[derive(Default, Deserialize)]
struct Claims {
    email: Option<String>,
    sub: Option<String>,
    exp: Option<u64>,
    #[serde(rename = "https://api.openai.com/auth", default)]
    auth: AuthClaims,
}
#[derive(Default, Deserialize)]
struct AuthClaims {
    chatgpt_account_id: Option<String>,
    chatgpt_plan_type: Option<String>,
    chatgpt_user_id: Option<String>,
}
fn claims(token: &str) -> Claims {
    token
        .split('.')
        .nth(1)
        .and_then(|s| URL_SAFE_NO_PAD.decode(s.trim_end_matches('=')).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}
#[derive(Clone, Deserialize, Serialize)]
pub struct AccountSummary {
    pub id: String,
    pub account_id: String,
    pub email: Option<String>,
    pub plan: Option<String>,
    pub paused: bool,
    pub quota: Option<Value>,
    pub quota_observed_at: Option<DateTime<Utc>>,
}
/// Provider reset vouchers, separate from paid usage credits.
#[derive(Clone, Deserialize, Serialize)]
pub struct ResetCredit {
    pub id: String,
    pub status: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct ResetCredits {
    pub available_count: u64,
    pub credits: Vec<ResetCredit>,
}
pub struct ResetCreditReading {
    pub data: ResetCredits,
    pub observed_at: String,
}
pub fn reset_credit_count(account: &AccountSummary) -> Option<u64> {
    account
        .quota
        .as_ref()?
        .get("rate_limit_reset_credits")?
        .get("available_count")?
        .as_u64()
}
#[derive(Clone, Deserialize, Serialize)]
struct Account {
    summary: AccountSummary,
    tokens: Tokens,
    refreshed_at: DateTime<Utc>,
}
#[derive(Clone, Default, Deserialize, Serialize)]
pub struct TokenUsage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cached_tokens: Option<u64>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct RequestRecord {
    pub id: String,
    pub account_id: String,
    pub model: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub outcome: String,
    pub http_status: Option<u16>,
    pub usage: TokenUsage,
}
#[derive(Clone, Deserialize, Serialize)]
struct Data {
    version: u8,
    local_key: String,
    accounts: Vec<Account>,
    requests: Vec<RequestRecord>,
    #[serde(default)]
    pending_device_login: Option<DeviceFlow>,
}
struct State {
    data: Data,
    dirty: bool,
}
#[derive(Serialize)]
pub struct Dashboard {
    pub accounts: Vec<AccountSummary>,
    #[cfg(feature = "legacy-relay")]
    pub requests: Vec<RequestRecord>,
    pub storage_pending: bool,
}
#[derive(Clone)]
pub struct Endpoints {
    pub backend: String,
    pub auth: String,
}
impl Default for Endpoints {
    fn default() -> Self {
        Self {
            backend: "https://chatgpt.com/backend-api".into(),
            auth: "https://auth.openai.com".into(),
        }
    }
}
#[derive(Clone)]
pub struct Credential {
    pub id: String,
    pub account_id: String,
    pub access_token: String,
}
#[derive(Deserialize, Serialize, Clone)]
pub struct DeviceView {
    pub user_code: String,
    pub verification_url: String,
    pub interval_seconds: u64,
    pub expires_at: DateTime<Utc>,
}
#[derive(Clone, Deserialize, Serialize)]
struct DeviceFlow {
    view: DeviceView,
    id: String,
    next_poll: DateTime<Utc>,
    phase: DevicePhase,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "phase", rename_all = "snake_case")]
enum DevicePhase {
    Waiting,
    Exchange { code: String, verifier: String },
    Tokens { tokens: Tokens },
}
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum LoginStatus {
    Pending,
    Retrying { message: String },
    Connected { account: AccountSummary },
}
pub const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
pub struct Service {
    vault: Vault,
    state: Mutex<State>,
    auth_gate: AsyncMutex<()>,
    device: AsyncMutex<Option<DeviceFlow>>,
    pub(crate) client: reqwest::Client,
    pub(crate) endpoints: Endpoints,
    #[cfg(feature = "legacy-relay")]
    pub(crate) capacity: Arc<Semaphore>,
    auth_capacity: Arc<Semaphore>,
    auth_jobs: AsyncMutex<tokio::task::JoinSet<()>>,
}
impl Service {
    pub fn open(dir: &Path, endpoints: Endpoints) -> Result<Arc<Self>> {
        // Only HTTPS or explicit loopback fixtures. UI cannot change destinations.
        for endpoint in [&endpoints.backend, &endpoints.auth] {
            let url = reqwest::Url::parse(endpoint).map_err(|_| Error::Protocol)?;
            if url.scheme() != "https"
                && !(url.scheme() == "http" && url.host_str() == Some("127.0.0.1"))
            {
                return Err(Error::Protocol);
            }
            if !url.username().is_empty()
                || url.password().is_some()
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(Error::Protocol);
            }
        }
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
        let vault = Vault::open(dir)?;
        let mut data = vault.load::<Data>()?.unwrap_or(Data {
            version: 1,
            local_key: random_key()?,
            accounts: vec![],
            requests: vec![],
            pending_device_login: None,
        });
        if data.version != 1 {
            return Err(Error::Storage);
        }
        for record in &mut data.requests {
            if record.outcome == "in_progress" {
                record.outcome = "interrupted".into();
                record.finished_at = Some(Utc::now());
            }
        }
        data.pending_device_login = data
            .pending_device_login
            .filter(|flow| Utc::now() < flow.view.expires_at);
        let device = data.pending_device_login.clone();
        vault.save(&data)?;
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(Duration::from_secs(90))
            .build()
            .map_err(|_| Error::Network)?;
        Ok(Arc::new(Self {
            vault,
            state: Mutex::new(State { data, dirty: false }),
            auth_gate: AsyncMutex::new(()),
            device: AsyncMutex::new(device),
            client,
            endpoints,
            #[cfg(feature = "legacy-relay")]
            capacity: Arc::new(Semaphore::new(8)),
            auth_capacity: Arc::new(Semaphore::new(8)),
            auth_jobs: AsyncMutex::new(tokio::task::JoinSet::new()),
        }))
    }
    fn state(&self) -> Result<std::sync::MutexGuard<'_, State>> {
        self.state.lock().map_err(|_| Error::Storage)
    }
    fn persist(&self, state: &mut State) -> Result<()> {
        state.dirty = true;
        self.vault.save(&state.data)?;
        state.dirty = false;
        Ok(())
    }
    pub fn ready(&self) -> bool {
        self.state().is_ok_and(|state| !state.dirty)
    }
    pub fn flush(&self) -> Result<()> {
        let mut state = self.state()?;
        self.persist(&mut state)
    }
    pub fn dashboard(&self) -> Result<Dashboard> {
        let state = self.state()?;
        Ok(Dashboard {
            accounts: state
                .data
                .accounts
                .iter()
                .map(|a| a.summary.clone())
                .collect(),
            #[cfg(feature = "legacy-relay")]
            requests: state.data.requests.iter().rev().cloned().collect(),
            storage_pending: state.dirty,
        })
    }
    pub fn local_key(&self) -> Result<String> {
        Ok(self.state()?.data.local_key.clone())
    }
    pub fn authorized(&self, header: Option<&str>) -> bool {
        let Ok(key) = self.local_key() else {
            return false;
        };
        header
            .and_then(|s| s.strip_prefix("Bearer "))
            .is_some_and(|s| {
                aws_lc_rs::constant_time::verify_slices_are_equal(s.as_bytes(), key.as_bytes())
                    .is_ok()
            })
    }
    pub async fn import(&self, raw: &str) -> Result<AccountSummary> {
        if raw.len() > 1024 * 1024 {
            return Err(Error::InvalidAuth);
        }
        let file: AuthFile = serde_json::from_str(raw).map_err(|_| Error::InvalidAuth)?;
        let _gate = self.auth_gate.lock().await;
        self.save_tokens(file.tokens)
    }
    fn save_tokens(&self, tokens: Tokens) -> Result<AccountSummary> {
        for token in [
            &tokens.access_token,
            &tokens.refresh_token,
            &tokens.id_token,
        ] {
            if token.is_empty()
                || token.len() > 64 * 1024
                || token.bytes().any(|b| b.is_ascii_control())
            {
                return Err(Error::InvalidAuth);
            }
        }
        let meta = claims(&tokens.id_token);
        let account_id = tokens
            .account_id
            .clone()
            .or(meta.auth.chatgpt_account_id)
            .filter(|s| !s.is_empty() && s.len() < 512 && !s.bytes().any(|b| b.is_ascii_control()))
            .ok_or(Error::InvalidAuth)?;
        // Keep workspace seats distinct even when their workspace account ID is shared.
        let principal = meta
            .auth
            .chatgpt_user_id
            .or(meta.sub)
            .or(meta.email.clone())
            .unwrap_or_default();
        let identity =
            serde_json::to_vec(&(&account_id, &principal)).map_err(|_| Error::InvalidAuth)?;
        let id = URL_SAFE_NO_PAD
            .encode(aws_lc_rs::digest::digest(&aws_lc_rs::digest::SHA256, &identity).as_ref());
        let mut state = self.state()?;
        let existing = state.data.accounts.iter().position(|a| a.summary.id == id);
        if existing.is_none() && state.data.accounts.len() >= 100 {
            return Err(Error::Capacity);
        }
        let summary = AccountSummary {
            id,
            account_id,
            email: meta.email,
            plan: meta.auth.chatgpt_plan_type,
            paused: false,
            quota: None,
            quota_observed_at: None,
        };
        let account = Account {
            summary: summary.clone(),
            tokens,
            refreshed_at: Utc::now(),
        };
        if let Some(i) = existing {
            state.data.accounts[i] = account;
        } else {
            state.data.accounts.push(account);
        }
        self.persist(&mut state)?;
        Ok(summary)
    }
    pub async fn change_account(&self, id: &str, remove: bool, paused: bool) -> Result<()> {
        let _gate = self.auth_gate.lock().await;
        let mut state = self.state()?;
        let index = state
            .data
            .accounts
            .iter()
            .position(|a| a.summary.id == id)
            .ok_or(Error::Account)?;
        if remove {
            state.data.accounts.remove(index);
        } else {
            state.data.accounts[index].summary.paused = paused;
        }
        self.persist(&mut state)
    }
    pub async fn drain_auth(&self) -> Result<()> {
        let mut jobs = self.auth_jobs.lock().await;
        while let Some(result) = jobs.join_next().await {
            result.map_err(|_| Error::Network)?;
        }
        self.flush()
    }
    pub(crate) async fn credential(
        self: &Arc<Self>,
        pin: Option<&str>,
        force: bool,
    ) -> Result<Credential> {
        // A disconnected client must not abandon an exchange consuming a rotating token.
        // The service retains and drains every job, while only eight can be outstanding.
        let permit = self
            .auth_capacity
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| Error::Network)?;
        let (send, receive) = tokio::sync::oneshot::channel();
        let service = self.clone();
        let pin = pin.map(str::to_owned);
        {
            let mut jobs = self.auth_jobs.lock().await;
            while let Some(result) = jobs.try_join_next() {
                result.map_err(|_| Error::Network)?;
            }
            jobs.spawn(async move {
                let _permit = permit;
                let result = service.credential_inner(pin.as_deref(), force).await;
                let _ = send.send(result);
            });
        }
        receive.await.map_err(|_| Error::Network)?
    }
    async fn credential_inner(&self, pin: Option<&str>, force: bool) -> Result<Credential> {
        let _gate = self.auth_gate.lock().await;
        let account = {
            let mut state = self.state()?;
            if state.dirty {
                self.persist(&mut state)?;
            }
            let a = if let Some(id) = pin {
                state
                    .data
                    .accounts
                    .iter()
                    .find(|a| a.summary.id == id && !a.summary.paused)
            } else {
                state
                    .data
                    .accounts
                    .iter()
                    .filter(|a| !a.summary.paused)
                    .min_by_key(|a| {
                        state
                            .data
                            .requests
                            .iter()
                            .filter(|r| r.account_id == a.summary.id)
                            .count()
                    })
            };
            a.cloned().ok_or(Error::NoAccount)?
        };
        let expired = claims(&account.tokens.access_token)
            .exp
            .is_some_and(|exp| exp <= Utc::now().timestamp().max(0) as u64 + 60);
        let mut tokens = account.tokens.clone();
        if force || expired || (Utc::now() - account.refreshed_at).num_days() >= 8 {
            let response=self.client.post(format!("{}/oauth/token",self.endpoints.auth)).timeout(Duration::from_secs(30)).json(&json!({"grant_type":"refresh_token","client_id":CLIENT_ID,"refresh_token":tokens.refresh_token,"scope":"openid profile email"})).send().await.map_err(|_|Error::Network)?;
            let value = checked_json(response).await?;
            let mut rotated: Tokens = serde_json::from_value(value).map_err(|_| Error::Protocol)?;
            if rotated.access_token.is_empty()
                || rotated.refresh_token.is_empty()
                || rotated.id_token.is_empty()
            {
                return Err(Error::Protocol);
            }
            let refreshed_account = claims(&rotated.id_token).auth.chatgpt_account_id;
            if refreshed_account.is_some_and(|id| id != account.summary.account_id) {
                return Err(Error::Protocol);
            }
            rotated.account_id = Some(account.summary.account_id.clone());
            let mut state = self.state()?;
            let entry = state
                .data
                .accounts
                .iter_mut()
                .find(|a| a.summary.id == account.summary.id)
                .ok_or(Error::Account)?;
            entry.tokens = rotated.clone();
            entry.refreshed_at = Utc::now();
            // Keep the new single-use refresh token in memory even when saving fails.
            self.persist(&mut state)?;
            tokens = rotated;
        }
        Ok(Credential {
            id: account.summary.id,
            account_id: account.summary.account_id,
            access_token: tokens.access_token,
        })
    }
    async fn observed_json(self: &Arc<Self>, id: &str, path: &str) -> Result<Value> {
        let mut credential = self.credential(Some(id), false).await?;
        let fetch = |c: &Credential| {
            self.client
                .get(format!("{}{path}", self.endpoints.backend))
                .bearer_auth(&c.access_token)
                .header("chatgpt-account-id", &c.account_id)
                .timeout(Duration::from_secs(15))
        };
        let mut response = fetch(&credential)
            .send()
            .await
            .map_err(|_| Error::Network)?;
        if response.status() == 401 {
            credential = self.credential(Some(id), true).await?;
            response = fetch(&credential)
                .send()
                .await
                .map_err(|_| Error::Network)?;
        }
        checked_json(response).await
    }
    pub async fn reset_credits(self: &Arc<Self>, id: &str) -> Result<ResetCreditReading> {
        let value = self
            .observed_json(id, "/wham/rate-limit-reset-credits")
            .await?;
        if value.get("error").is_some() {
            return Err(Error::Protocol);
        }
        let data = serde_json::from_value(value).map_err(|_| Error::Protocol)?;
        Ok(ResetCreditReading {
            data,
            observed_at: Utc::now().to_rfc3339(),
        })
    }
    pub async fn refresh_usage(self: &Arc<Self>, id: &str) -> Result<()> {
        let quota = self.observed_json(id, "/wham/usage").await?;
        if !quota.is_object() {
            return Err(Error::Protocol);
        }
        let mut state = self.state()?;
        let account = state
            .data
            .accounts
            .iter_mut()
            .find(|a| a.summary.id == id)
            .ok_or(Error::Account)?;
        account.summary.quota = Some(quota);
        account.summary.quota_observed_at = Some(Utc::now());
        self.persist(&mut state)
    }
    #[cfg(feature = "legacy-relay")]
    pub(crate) fn begin(&self, credential: &Credential, model: String) -> Result<String> {
        let id = random_key()?;
        let mut state = self.state()?;
        if !state
            .data
            .accounts
            .iter()
            .any(|a| a.summary.id == credential.id && !a.summary.paused)
        {
            return Err(Error::Account);
        }
        if state.data.requests.len() >= 500 {
            let i = state
                .data
                .requests
                .iter()
                .position(|r| r.outcome != "in_progress")
                .ok_or(Error::Capacity)?;
            state.data.requests.remove(i);
        }
        state.data.requests.push(RequestRecord {
            id: id.clone(),
            account_id: credential.id.clone(),
            model,
            started_at: Utc::now(),
            finished_at: None,
            outcome: "in_progress".into(),
            http_status: None,
            usage: TokenUsage::default(),
        });
        self.persist(&mut state)?;
        Ok(id)
    }
    #[cfg(feature = "legacy-relay")]
    pub(crate) fn finish(
        &self,
        id: &str,
        outcome: &str,
        status: Option<u16>,
        usage: TokenUsage,
    ) -> Result<()> {
        let mut state = self.state()?;
        let record = state
            .data
            .requests
            .iter_mut()
            .find(|r| r.id == id)
            .ok_or(Error::Storage)?;
        record.outcome = outcome.into();
        record.http_status = status;
        record.usage = usage;
        record.finished_at = Some(Utc::now());
        self.persist(&mut state)
    }
    pub async fn start_login(&self) -> Result<DeviceView> {
        let mut flow = self.device.lock().await;
        let value = checked_json(
            self.client
                .post(format!(
                    "{}/api/accounts/deviceauth/usercode",
                    self.endpoints.auth
                ))
                .json(&json!({"client_id":CLIENT_ID}))
                .timeout(Duration::from_secs(30))
                .send()
                .await
                .map_err(|_| Error::Network)?,
        )
        .await?;
        let id = value["device_auth_id"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or(Error::Protocol)?
            .to_owned();
        let code = value
            .get("user_code")
            .or_else(|| value.get("usercode"))
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .ok_or(Error::Protocol)?
            .to_owned();
        let interval = value["interval"]
            .as_u64()
            .or_else(|| value["interval"].as_str().and_then(|s| s.parse().ok()))
            .unwrap_or(5)
            .clamp(1, 60);
        let expiry = value["expires_in"]
            .as_i64()
            .filter(|n| *n > 0)
            .unwrap_or(900)
            .min(900);
        let view = DeviceView {
            user_code: code,
            verification_url: format!("{}/codex/device", self.endpoints.auth),
            interval_seconds: interval,
            expires_at: Utc::now() + chrono::Duration::seconds(expiry),
        };
        let pending = DeviceFlow {
            view: view.clone(),
            id,
            next_poll: Utc::now() + chrono::Duration::seconds(interval as i64),
            phase: DevicePhase::Waiting,
        };
        self.store_device_flow(Some(pending.clone()))?;
        *flow = Some(pending);
        Ok(view)
    }
    pub async fn pending_login(&self) -> Result<DeviceView> {
        let flow = self.device.lock().await;
        let flow = flow
            .as_ref()
            .filter(|flow| Utc::now() < flow.view.expires_at)
            .ok_or(Error::Expired)?;
        Ok(flow.view.clone())
    }
    fn store_device_flow(&self, flow: Option<DeviceFlow>) -> Result<()> {
        let mut state = self.state()?;
        let previous = state.data.pending_device_login.clone();
        state.data.pending_device_login = flow;
        if let Err(error) = self.persist(&mut state) {
            state.data.pending_device_login = previous;
            return Err(error);
        }
        Ok(())
    }
    pub async fn cancel_login(&self) -> Result<()> {
        let mut holder = self.device.lock().await;
        self.store_device_flow(None)?;
        *holder = None;
        Ok(())
    }
    pub async fn poll_login(&self) -> Result<LoginStatus> {
        match self.poll_login_inner().await {
            Err(Error::Network | Error::Storage | Error::Upstream(429 | 500..=599)) => Ok(LoginStatus::Retrying {
                message: "연결 확인이 일시적으로 지연되고 있습니다. 앱으로 돌아온 상태에서 다시 확인해 주세요.".into(),
            }),
            result => result,
        }
    }
    async fn poll_login_inner(&self) -> Result<LoginStatus> {
        let mut holder = self.device.lock().await;
        let mut flow = holder.clone().ok_or(Error::Expired)?;
        if Utc::now() >= flow.view.expires_at {
            self.store_device_flow(None)?;
            *holder = None;
            return Err(Error::Expired);
        }
        if Utc::now() < flow.next_poll {
            return Ok(LoginStatus::Pending);
        }
        flow.next_poll = Utc::now() + chrono::Duration::seconds(flow.view.interval_seconds as i64);
        self.store_device_flow(Some(flow.clone()))?;
        *holder = Some(flow.clone());
        if matches!(flow.phase, DevicePhase::Waiting) {
            let response = self
                .client
                .post(format!(
                    "{}/api/accounts/deviceauth/token",
                    self.endpoints.auth
                ))
                .timeout(Duration::from_secs(30))
                .json(&json!({"device_auth_id":flow.id,"user_code":flow.view.user_code}))
                .send()
                .await
                .map_err(|_| Error::Network)?;
            if matches!(response.status().as_u16(), 403 | 404) {
                return Ok(LoginStatus::Pending);
            }
            let status = response.status();
            if status.is_server_error() || status.as_u16() == 429 {
                return Err(Error::Upstream(status.as_u16()));
            }
            let value: Value = serde_json::from_slice(&bounded_bytes(response, 1024 * 1024).await?)
                .map_err(|_| Error::Protocol)?;
            let error = value["error"]
                .as_str()
                .or_else(|| value["error"]["code"].as_str());
            if matches!(error, Some("authorization_pending" | "slow_down")) {
                if error == Some("slow_down") {
                    flow.view.interval_seconds = (flow.view.interval_seconds + 5).min(60);
                }
                flow.next_poll =
                    Utc::now() + chrono::Duration::seconds(flow.view.interval_seconds as i64);
                self.store_device_flow(Some(flow.clone()))?;
                *holder = Some(flow);
                return Ok(LoginStatus::Pending);
            }
            if !status.is_success() {
                return Err(Error::Upstream(status.as_u16()));
            }
            flow.phase = if let Some(code) = value["authorization_code"].as_str() {
                DevicePhase::Exchange {
                    code: code.to_owned(),
                    verifier: value["code_verifier"]
                        .as_str()
                        .ok_or(Error::Protocol)?
                        .to_owned(),
                }
            } else {
                DevicePhase::Tokens {
                    tokens: serde_json::from_value(value).map_err(|_| Error::Protocol)?,
                }
            };
            self.store_device_flow(Some(flow.clone()))?;
            *holder = Some(flow.clone());
        }
        if let DevicePhase::Exchange { code, verifier } = &flow.phase {
            let value = checked_json(
                self.client
                    .post(format!("{}/oauth/token", self.endpoints.auth))
                    .timeout(Duration::from_secs(30))
                    .form(&[
                        ("grant_type", "authorization_code"),
                        ("client_id", CLIENT_ID),
                        ("code", code),
                        ("code_verifier", verifier),
                        (
                            "redirect_uri",
                            &format!("{}/deviceauth/callback", self.endpoints.auth),
                        ),
                    ])
                    .send()
                    .await
                    .map_err(|_| Error::Network)?,
            )
            .await?;
            flow.phase = DevicePhase::Tokens {
                tokens: serde_json::from_value(value).map_err(|_| Error::Protocol)?,
            };
            self.store_device_flow(Some(flow.clone()))?;
            *holder = Some(flow.clone());
        }
        let DevicePhase::Tokens { tokens } = flow.phase else {
            return Err(Error::Protocol);
        };
        let _gate = self.auth_gate.lock().await;
        let account = self.save_tokens(tokens)?;
        self.store_device_flow(None)?;
        *holder = None;
        Ok(LoginStatus::Connected { account })
    }
}
pub(crate) async fn bounded_bytes(mut response: reqwest::Response, max: usize) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| Error::Network)? {
        if chunk.len() > max.saturating_sub(bytes.len()) {
            return Err(Error::Protocol);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
async fn checked_json(response: reqwest::Response) -> Result<Value> {
    if !response.status().is_success() {
        return Err(Error::Upstream(response.status().as_u16()));
    }
    serde_json::from_slice(&bounded_bytes(response, 1024 * 1024).await?)
        .map_err(|_| Error::Protocol)
}
