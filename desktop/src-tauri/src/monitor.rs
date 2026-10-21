use codex_lb_server::business::{
    AccountSummary, Dashboard, ResetCredit, Service, reset_credit_count,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

#[derive(Default)]
struct AccountPoll {
    attempted: Option<Instant>,
    error: Option<String>,
    attempted_at: Option<i64>,
    refreshing: bool,
    reset_credits: Option<ResetCreditObservation>,
}
#[derive(Clone, Serialize)]
pub struct ResetCreditObservation {
    pub(crate) available_count: Option<u64>,
    pub(crate) credits: Option<Vec<ResetCredit>>,
    pub(crate) observed_at: Option<String>,
    pub(crate) error: Option<String>,
}
impl ResetCreditObservation {
    fn partial(account: &AccountSummary, error: Option<String>) -> Self {
        let count = reset_credit_count(account);
        Self {
            available_count: count,
            credits: None,
            observed_at: count.and(account.quota_observed_at.map(|t| t.to_rfc3339())),
            error,
        }
    }
}
pub struct UsageMonitor {
    gate: tokio::sync::Mutex<()>,
    cadence: AtomicU64,
    automatic_enabled: AtomicBool,
    accounts: Mutex<HashMap<String, AccountPoll>>,
    history: Mutex<crate::history::HistoryStore>,
}
impl Default for UsageMonitor {
    fn default() -> Self {
        Self {
            gate: Default::default(),
            cadence: AtomicU64::new(60),
            automatic_enabled: AtomicBool::new(true),
            accounts: Default::default(),
            history: Default::default(),
        }
    }
}
#[derive(Serialize)]
pub struct Snapshot {
    pub account_labels: std::collections::BTreeMap<String, crate::history::AccountLabel>,
    pub accounts: Vec<codex_lb_server::business::AccountSummary>,
    pub storage_pending: bool,
    pub reset_credits: HashMap<String, ResetCreditObservation>,
    pub voucher_urgency: HashMap<String, crate::voucher_alert::VoucherUrgency>,
    pub usage_errors: HashMap<String, String>,
    pub history: std::collections::BTreeMap<String, Vec<crate::history::Sample>>,
    pub alert_preferences: std::collections::BTreeMap<String, crate::history::AlertPreference>,
    pub poll_status: HashMap<String, PollStatus>,
    pub monitoring_issue: Option<String>,
    pub quota_windows: std::collections::BTreeMap<String, Vec<crate::history::Window>>,
}
#[derive(Serialize)]
pub struct PollStatus {
    last_attempt_at: Option<i64>,
    next_refresh_at: Option<i64>,
    refreshing: bool,
}
struct Reading<'a> {
    polls: &'a Mutex<HashMap<String, AccountPoll>>,
    id: String,
}
impl Drop for Reading<'_> {
    fn drop(&mut self) {
        if let Ok(mut polls) = self.polls.lock()
            && let Some(poll) = polls.get_mut(&self.id)
        {
            poll.refreshing = false;
        }
    }
}
#[cfg(any(feature = "android-worker", test))]
pub fn mobile_interval(minutes: u64) -> Result<Option<Duration>, String> {
    match minutes {
        0 => Ok(None),
        1 | 5 | 10 | 30 | 60 | 100 => Ok(Some(Duration::from_secs(minutes * 60))),
        _ => Err("지원하지 않는 조회 간격입니다.".into()),
    }
}
impl UsageMonitor {
    pub fn with_history(history: crate::history::HistoryStore) -> Self {
        Self {
            history: Mutex::new(history),
            ..Self::default()
        }
    }
    pub fn set_nickname(&self, id: &str, nickname: &str) -> Result<(), String> {
        self.history
            .lock()
            .map_err(|_| "모니터링 기록 잠금 오류")?
            .set_nickname(id, nickname)
    }
    pub fn configure_alert(&self, id: &str, enabled: bool, threshold: u8) -> Result<(), String> {
        self.history
            .lock()
            .map_err(|_| "모니터링 기록 잠금 오류")?
            .configure(id, enabled, threshold)
    }
    pub fn snapshot(&self, service: &Service) -> Result<Snapshot, String> {
        let Dashboard {
            accounts,
            storage_pending,
            ..
        } = service.dashboard().map_err(|e| e.to_string())?;
        let mut polls = self
            .accounts
            .lock()
            .map_err(|_| "모니터링 상태를 읽지 못했습니다.")?;
        polls.retain(|id, _| accounts.iter().any(|a| &a.id == id));
        let usage_errors = polls
            .iter()
            .filter_map(|(id, p)| p.error.as_ref().map(|e| (id.clone(), e.clone())))
            .collect();
        let now = now_seconds();
        let poll_status = accounts
            .iter()
            .map(|a| {
                let poll = polls.get(&a.id);
                let last = poll
                    .and_then(|p| p.attempted_at)
                    .or_else(|| self.history.lock().ok().and_then(|h| h.last_attempt(&a.id)));
                let cadence = self.cadence.load(Ordering::Relaxed);
                let observed = a.quota_observed_at.map(|t| t.timestamp());
                let next = if a.paused
                    || cadence == 0
                    || !self.automatic_enabled.load(Ordering::Relaxed)
                {
                    None
                } else {
                    Some(
                        last.unwrap_or(0)
                            .max(observed.unwrap_or(0))
                            .saturating_add(cadence as i64)
                            .max(now),
                    )
                };
                (
                    a.id.clone(),
                    PollStatus {
                        last_attempt_at: last,
                        next_refresh_at: next,
                        refreshing: poll.is_some_and(|p| p.refreshing),
                    },
                )
            })
            .collect();
        let reset_credits: HashMap<String, ResetCreditObservation> = accounts
            .iter()
            .map(|a| {
                let observation = polls
                    .get(&a.id)
                    .and_then(|p| p.reset_credits.clone())
                    .unwrap_or_else(|| ResetCreditObservation::partial(a, None));
                (a.id.clone(), observation)
            })
            .collect();
        drop(polls);
        let history = self.history.lock().map_err(|_| "모니터링 기록 잠금 오류")?;
        Ok(Snapshot {
            account_labels: history.labels(&accounts),
            quota_windows: accounts
                .iter()
                .map(|a| (a.id.clone(), crate::history::windows(a)))
                .collect(),
            history: history.histories(&accounts, now),
            alert_preferences: history.preferences(&accounts),
            monitoring_issue: history.issue.clone(),
            poll_status,
            voucher_urgency: accounts
                .iter()
                .filter_map(|a| {
                    reset_credits
                        .get(&a.id)
                        .and_then(|o| crate::voucher_alert::urgency(o, a.paused, now))
                        .map(|warning| (a.id.clone(), warning))
                })
                .collect(),
            reset_credits,
            accounts,
            storage_pending,
            usage_errors,
        })
    }
    async fn read(
        &self,
        service: &Arc<Service>,
        id: &str,
        automatic: Option<Duration>,
    ) -> Result<(), String> {
        let _gate = self.gate.lock().await;
        if automatic.is_some() && !self.automatic_enabled.load(Ordering::Relaxed) {
            return Ok(());
        }
        let now = Instant::now();
        let at = now_seconds();
        let dashboard = service.dashboard().map_err(|e| e.to_string())?;
        let account = dashboard
            .accounts
            .iter()
            .find(|a| a.id == id)
            .ok_or("계정을 찾을 수 없습니다.")?;
        if account.paused {
            return Err("계정의 자동 모니터링이 정지되어 있습니다.".into());
        }
        if let Some(interval) = automatic {
            if account
                .quota_observed_at
                .is_some_and(|t| chrono_age(t.timestamp()) < interval.as_secs() as i64)
            {
                return Ok(());
            }
            let persisted = self
                .history
                .lock()
                .map_err(|_| "모니터링 기록 잠금 오류")?
                .last_attempt(id);
            if persisted.is_some_and(|last| at.saturating_sub(last) < interval.as_secs() as i64) {
                return Ok(());
            }
        }
        {
            let mut polls = self
                .accounts
                .lock()
                .map_err(|_| "모니터링 상태를 읽지 못했습니다.")?;
            let poll = polls.entry(id.into()).or_default();
            if let Some(interval) = automatic
                && poll
                    .attempted
                    .is_some_and(|last| now.duration_since(last) < interval)
            {
                return Ok(());
            }
            poll.attempted = Some(now);
            poll.attempted_at = Some(at);
        }
        // Durable before transport: process reclamation must not reset automatic cooldown.
        let marked = self
            .history
            .lock()
            .map_err(|_| "모니터링 기록 잠금 오류")?
            .mark_attempt(id, at, &dashboard.accounts);
        if automatic.is_some() {
            marked?;
        }
        self.accounts
            .lock()
            .map_err(|_| "모니터링 상태 잠금 오류")?
            .entry(id.into())
            .or_default()
            .refreshing = true;
        let _reading = Reading {
            polls: &self.accounts,
            id: id.into(),
        };
        let result = service.refresh_usage(id).await.map_err(|e| e.to_string());
        if result.is_ok() {
            let snapshot = service.dashboard().map_err(|e| e.to_string())?;
            if let Some(account) = snapshot.accounts.iter().find(|a| a.id == id) {
                self.history
                    .lock()
                    .map_err(|_| "모니터링 기록 잠금 오류")?
                    .record(account, now_seconds());
            }
        }
        // Independent reads preserve quota success when voucher details fail.
        let reset_credits = match service.reset_credits(id).await {
            Ok(details) => ResetCreditObservation {
                available_count: Some(details.data.available_count),
                credits: Some(details.data.credits),
                observed_at: Some(details.observed_at),
                error: None,
            },
            Err(error) => {
                let snapshot = service.dashboard().map_err(|e| e.to_string())?;
                let account = snapshot
                    .accounts
                    .iter()
                    .find(|a| a.id == id)
                    .ok_or("계정을 찾을 수 없습니다.")?;
                ResetCreditObservation::partial(account, Some(error.to_string()))
            }
        };
        let mut polls = self
            .accounts
            .lock()
            .map_err(|_| "모니터링 상태를 저장하지 못했습니다.")?;
        let poll = polls.entry(id.into()).or_default();
        poll.reset_credits = Some(reset_credits);
        poll.error = result.as_ref().err().cloned();
        result
    }
    pub async fn refresh(&self, service: &Arc<Service>, id: &str) -> Result<(), String> {
        self.read(service, id, None).await
    }
    #[cfg(any(feature = "android-worker", test))]
    pub fn configure_mobile(&self, minutes: u64) -> Result<(), String> {
        let interval = mobile_interval(minutes)?;
        self.cadence
            .store(interval.map_or(0, |i| i.as_secs()), Ordering::Relaxed);
        self.automatic_enabled
            .store(interval.is_some(), Ordering::Relaxed);
        Ok(())
    }
    #[cfg(any(feature = "android-worker", test))]
    pub async fn refresh_mobile(&self, service: &Arc<Service>, minutes: u64) -> Result<(), String> {
        let interval = mobile_interval(minutes)?;
        self.configure_mobile(minutes)?;
        match interval {
            Some(interval) => self.refresh_due_after(service, interval).await,
            None => Ok(()),
        }
    }
    #[cfg(any(desktop, test))]
    pub async fn refresh_due(&self, service: &Arc<Service>) -> Result<(), String> {
        self.refresh_due_after(service, Duration::from_secs(60))
            .await
    }
    pub async fn refresh_due_after(
        &self,
        service: &Arc<Service>,
        interval: Duration,
    ) -> Result<(), String> {
        self.cadence.store(interval.as_secs(), Ordering::Relaxed);
        let mut accounts = service.dashboard().map_err(|e| e.to_string())?.accounts;
        {
            let history = self.history.lock().map_err(|_| "모니터링 기록 잠금 오류")?;
            accounts.sort_by_key(|a| {
                history
                    .last_attempt(&a.id)
                    .unwrap_or(0)
                    .max(a.quota_observed_at.map(|t| t.timestamp()).unwrap_or(0))
            });
        }
        for account in accounts {
            if !account.paused {
                let _ = self.read(service, &account.id, Some(interval)).await;
            }
        }
        Ok(())
    }
}
fn now_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn chrono_age(timestamp: i64) -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
        - timestamp
}

#[cfg(test)]
mod tests {
    use super::*;
    use codex_lb_server::business::Endpoints;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    #[tokio::test]
    async fn durable_attempts_prevent_retries_after_restart_and_manual_still_collects() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let calls = Arc::new(AtomicUsize::new(0));
        let count = calls.clone();
        let provider = tokio::spawn(async move {
            loop {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut bytes = [0u8; 4096];
                let _ = stream.read(&mut bytes).await.unwrap();
                count.fetch_add(1, Ordering::SeqCst);
                stream.write_all(b"HTTP/1.1 503 Unavailable\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}").await.unwrap();
            }
        });
        let directory = tempfile::tempdir().unwrap();
        let endpoints = Endpoints {
            backend: endpoint.clone(),
            auth: endpoint,
        };
        let service = Service::open(directory.path(), endpoints.clone()).unwrap();
        let account = service.import(r#"{"tokens":{"access_token":"fixture-access","refresh_token":"fixture-refresh","id_token":"fixture-id","account_id":"workspace"}}"#).await.unwrap();
        let monitor = UsageMonitor::with_history(crate::history::open_history(directory.path()));
        monitor.refresh_mobile(&service, 100).await.unwrap();
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        drop(monitor);
        drop(service);
        let service = Service::open(directory.path(), endpoints).unwrap();
        let monitor = UsageMonitor::with_history(crate::history::open_history(directory.path()));
        let (left, right) = tokio::join!(
            monitor.refresh_mobile(&service, 100),
            monitor.refresh_mobile(&service, 100)
        );
        left.unwrap();
        right.unwrap();
        assert_eq!(
            calls.load(Ordering::SeqCst),
            2,
            "cold restart and overlapping work must retain the cooldown"
        );
        monitor.configure_mobile(0).unwrap();
        assert!(
            monitor.snapshot(&service).unwrap().poll_status[&account.id]
                .next_refresh_at
                .is_none()
        );
        monitor
            .refresh_due_after(&service, Duration::from_secs(1))
            .await
            .unwrap();
        assert_eq!(
            calls.load(Ordering::SeqCst),
            2,
            "disabled state must also gate the worker"
        );
        assert!(monitor.refresh(&service, &account.id).await.is_err());
        assert_eq!(
            calls.load(Ordering::SeqCst),
            4,
            "manual collection bypasses automatic cadence"
        );
        provider.abort();
        let _ = provider.await;
    }
    #[test]
    fn mobile_cadence_is_explicit_and_bounded() {
        assert_eq!(mobile_interval(0).unwrap(), None);
        for minutes in [1, 5, 10, 30, 60, 100] {
            assert_eq!(
                mobile_interval(minutes).unwrap(),
                Some(Duration::from_secs(minutes * 60))
            );
        }
        for minutes in [2, 99, 101, u64::MAX] {
            assert!(mobile_interval(minutes).is_err());
        }
    }
    #[tokio::test]
    async fn failed_and_successful_reads_share_status_and_automatic_attempts_are_throttled() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let provider = tokio::spawn(async move {
            let quota = r#"{"rate_limit":{"primary_window":{"used_percent":25}},"rate_limit_reset_credits":{"available_count":3}}"#;
            let details = r#"{"available_count":2,"credits":[{"id":"later","status":"available","expires_at":"2030-07-17T00:00:00Z"},{"id":"future","status":"future_status","expires_at":null}]}"#;
            let malformed = r#"{"available_count":2,"credits":[{"id":"bad","status":"available","expires_at":"not-a-date"}]}"#;
            for (path, status, body) in [
                ("usage", 503, quota),
                ("rate-limit-reset-credits", 503, "{}"),
                ("usage", 200, quota),
                ("rate-limit-reset-credits", 200, details),
                ("usage", 200, quota),
                ("rate-limit-reset-credits", 503, "{}"),
                ("usage", 200, quota),
                ("rate-limit-reset-credits", 200, malformed),
            ] {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut input = vec![];
                let mut buffer = [0; 1024];
                while !input.windows(4).any(|w| w == b"\r\n\r\n") {
                    let n = stream.read(&mut buffer).await.unwrap();
                    assert!(n > 0);
                    input.extend_from_slice(&buffer[..n]);
                }
                assert!(input.starts_with(format!("GET /wham/{path} ").as_bytes()));
                let request = String::from_utf8(input).unwrap().to_lowercase();
                assert!(request.contains("authorization: bearer fixture-access"));
                assert!(request.contains("chatgpt-account-id: workspace"));
                stream.write_all(format!("HTTP/1.1 {status} Result\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).as_bytes()).await.unwrap();
            }
        });
        let dir = tempfile::tempdir().unwrap();
        let service = Service::open(
            dir.path(),
            Endpoints {
                backend: endpoint.clone(),
                auth: endpoint,
            },
        )
        .unwrap();
        let account=service.import(r#"{"tokens":{"access_token":"fixture-access","refresh_token":"fixture-refresh","id_token":"fixture-id","account_id":"workspace"}}"#).await.unwrap();
        let monitor = UsageMonitor::default();
        tokio::time::timeout(
            Duration::from_millis(100),
            monitor.refresh_mobile(&service, 0),
        )
        .await
        .unwrap()
        .unwrap();
        assert!(monitor.refresh(&service, &account.id).await.is_err());
        assert!(
            monitor.snapshot(&service).unwrap().reset_credits[&account.id]
                .available_count
                .is_none()
        );
        assert!(
            monitor
                .snapshot(&service)
                .unwrap()
                .usage_errors
                .contains_key(&account.id)
        );
        monitor
            .accounts
            .lock()
            .unwrap()
            .get_mut(&account.id)
            .unwrap()
            .attempted = Some(Instant::now() - Duration::from_secs(61));
        tokio::time::timeout(
            Duration::from_millis(100),
            monitor.refresh_mobile(&service, 100),
        )
        .await
        .unwrap()
        .unwrap();
        monitor
            .accounts
            .lock()
            .unwrap()
            .get_mut(&account.id)
            .unwrap()
            .attempted = Some(Instant::now());
        tokio::time::timeout(Duration::from_millis(100), monitor.refresh_due(&service))
            .await
            .unwrap()
            .unwrap();
        assert!(
            monitor
                .snapshot(&service)
                .unwrap()
                .usage_errors
                .contains_key(&account.id)
        );
        monitor.refresh(&service, &account.id).await.unwrap();
        let snapshot = monitor.snapshot(&service).unwrap();
        assert!(snapshot.usage_errors.is_empty());
        assert_eq!(
            snapshot.accounts[0].quota.as_ref().unwrap()["rate_limit"]["primary_window"]["used_percent"],
            25
        );
        let credits = &snapshot.reset_credits[&account.id];
        assert_eq!(credits.available_count, Some(2));
        assert!(credits.observed_at.is_some());
        assert!(credits.error.is_none());
        let items = credits.credits.as_ref().unwrap();
        assert_eq!(
            items[0].expires_at.unwrap().to_rfc3339(),
            "2030-07-17T00:00:00+00:00"
        );
        assert_eq!(items[1].status.as_deref(), Some("future_status"));
        for _ in 0..2 {
            monitor.refresh(&service, &account.id).await.unwrap();
            let partial = monitor.snapshot(&service).unwrap();
            assert!(partial.usage_errors.is_empty());
            let credit = &partial.reset_credits[&account.id];
            assert_eq!(credit.available_count, Some(3));
            assert!(credit.credits.is_none());
            assert!(credit.observed_at.is_some());
            assert!(credit.error.is_some());
        }
        service
            .change_account(&account.id, false, true)
            .await
            .unwrap();
        monitor.refresh_due(&service).await.unwrap();
        provider.await.unwrap();
    }
}
