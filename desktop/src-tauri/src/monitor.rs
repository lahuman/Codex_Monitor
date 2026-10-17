use codex_lb_server::business::{
    AccountSummary, Dashboard, ResetCredit, Service, reset_credit_count,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
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
    available_count: Option<u64>,
    credits: Option<Vec<ResetCredit>>,
    observed_at: Option<String>,
    error: Option<String>,
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
#[derive(Default)]
pub struct UsageMonitor {
    gate: tokio::sync::Mutex<()>,
    accounts: Mutex<HashMap<String, AccountPoll>>,
    history: Mutex<crate::history::HistoryStore>,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub accounts: Vec<codex_lb_server::business::AccountSummary>,
    pub storage_pending: bool,
    pub reset_credits: HashMap<String, ResetCreditObservation>,
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
impl UsageMonitor {
    pub fn with_history(history: crate::history::HistoryStore) -> Self {
        Self {
            history: Mutex::new(history),
            ..Self::default()
        }
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
                let last = poll.and_then(|p| p.attempted_at);
                let observed = a.quota_observed_at.map(|t| t.timestamp());
                let next = if a.paused {
                    None
                } else {
                    Some(
                        last.unwrap_or(0)
                            .max(observed.unwrap_or(0))
                            .saturating_add(60)
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
        let reset_credits = accounts
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
            quota_windows: accounts
                .iter()
                .map(|a| (a.id.clone(), crate::history::windows(a)))
                .collect(),
            history: history.histories(&accounts, now),
            alert_preferences: history.preferences(&accounts),
            monitoring_issue: history.issue.clone(),
            poll_status,
            reset_credits,
            accounts,
            storage_pending,
            usage_errors,
        })
    }
    async fn read(&self, service: &Arc<Service>, id: &str, automatic: bool) -> Result<(), String> {
        let _gate = self.gate.lock().await;
        let now = Instant::now();
        {
            let mut polls = self
                .accounts
                .lock()
                .map_err(|_| "모니터링 상태를 읽지 못했습니다.")?;
            let poll = polls.entry(id.into()).or_default();
            if automatic
                && poll
                    .attempted
                    .is_some_and(|last| now.duration_since(last) < Duration::from_secs(60))
            {
                return Ok(());
            }
            poll.attempted = Some(now);
            poll.attempted_at = Some(now_seconds());
            poll.refreshing = true;
        }
        let _reading = Reading {
            polls: &self.accounts,
            id: id.into(),
        };
        if automatic {
            let snapshot = service.dashboard().map_err(|e| e.to_string())?;
            let Some(account) = snapshot.accounts.iter().find(|a| a.id == id) else {
                return Ok(());
            };
            if account.paused
                || account
                    .quota_observed_at
                    .is_some_and(|t| chrono_age(t.timestamp()) < 60)
            {
                return Ok(());
            }
        }
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
        self.read(service, id, false).await
    }
    pub async fn refresh_due(&self, service: &Arc<Service>) -> Result<(), String> {
        let snapshot = service.dashboard().map_err(|e| e.to_string())?;
        for account in snapshot.accounts {
            if !account.paused
                && account
                    .quota_observed_at
                    .is_none_or(|t| chrono_age(t.timestamp()) >= 60)
            {
                // Each failure is retained for both consumers; other accounts still get a turn.
                let _ = self.read(service, &account.id, true).await;
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
