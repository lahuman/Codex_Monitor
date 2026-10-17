use codex_lb_server::business::AccountSummary;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

const MAX_BYTES: u64 = 8 * 1024 * 1024;
const RETENTION: i64 = 25 * 3600;
const SAMPLE_INTERVAL: i64 = 300;
const MAX_SAMPLES: usize = 32000;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Window {
    pub period: String,
    pub label: String,
    pub seconds: Option<u64>,
    pub remaining: Option<f64>,
    pub reset_at: Option<i64>,
}
#[derive(Deserialize)]
struct ProviderWindow {
    used_percent: Option<f64>,
    limit_window_seconds: Option<u64>,
    reset_at: Option<i64>,
}
#[derive(Default, Deserialize)]
struct RateLimit {
    primary_window: Option<ProviderWindow>,
    secondary_window: Option<ProviderWindow>,
}
#[derive(Default, Deserialize)]
struct Quota {
    rate_limit: Option<RateLimit>,
}
pub fn windows(account: &AccountSummary) -> Vec<Window> {
    let quota = account
        .quota
        .clone()
        .and_then(|q| serde_json::from_value::<Quota>(q).ok())
        .unwrap_or_default();
    let Some(rate) = quota.rate_limit else {
        return vec![];
    };
    let primary_only = rate.secondary_window.is_none();
    [
        ("primary", rate.primary_window),
        ("secondary", rate.secondary_window),
    ]
    .into_iter()
    .filter_map(|(slot, value)| {
        value.map(|w| {
            let period = if primary_only && w.limit_window_seconds == Some(604800) {
                "secondary"
            } else if primary_only && w.limit_window_seconds == Some(2592000) {
                "monthly"
            } else {
                slot
            };
            let label = match w.limit_window_seconds {
                Some(18000) => "5시간".into(),
                Some(604800) => "주간".into(),
                Some(2592000) => "월간".into(),
                Some(s) => format!("{s}초"),
                None => {
                    if slot == "primary" {
                        "기본".into()
                    } else {
                        "추가".into()
                    }
                }
            };
            Window {
                period: period.into(),
                label,
                seconds: w.limit_window_seconds,
                remaining: w
                    .used_percent
                    .filter(|v| v.is_finite())
                    .map(|v| (100.0 - v).clamp(0.0, 100.0)),
                reset_at: w.reset_at,
            }
        })
    })
    .collect()
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Sample {
    pub at: i64,
    pub windows: Vec<Window>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct AlertPreference {
    pub enabled: bool,
    pub threshold: u8,
}
impl Default for AlertPreference {
    fn default() -> Self {
        Self {
            enabled: true,
            threshold: 10,
        }
    }
}
#[derive(Deserialize, Serialize)]
struct Saved {
    version: u8,
    history: BTreeMap<String, Vec<Sample>>,
    alerts: BTreeMap<String, AlertPreference>,
}
impl Default for Saved {
    fn default() -> Self {
        Self {
            version: 1,
            history: BTreeMap::new(),
            alerts: BTreeMap::new(),
        }
    }
}
#[derive(Default)]
pub struct HistoryStore {
    path: Option<PathBuf>,
    data: Saved,
    pub issue: Option<String>,
    blocked: bool,
    pending_cleanup: Option<PathBuf>,
}
impl HistoryStore {
    pub fn open(path: PathBuf) -> Self {
        let mut store = Self {
            path: Some(path.clone()),
            ..Self::default()
        };
        let loaded = (|| -> Result<Saved, String> {
            let file = match fs::File::open(&path) {
                Ok(f) => f,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Saved::default()),
                Err(e) => return Err(e.to_string()),
            };
            let mut bytes = vec![];
            file.take(MAX_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() as u64 > MAX_BYTES {
                return Err("기록 파일 크기 제한 초과".into());
            }
            let data: Saved = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            let valid = data.version == 1
                && data.history.len() <= 100
                && data.alerts.len() <= 100
                && data.history.values().map(Vec::len).sum::<usize>() <= MAX_SAMPLES
                && data
                    .alerts
                    .values()
                    .all(|p| (1..=100).contains(&p.threshold))
                && data.history.values().all(|samples| {
                    samples.len() <= 302
                        && samples.windows(2).all(|w| w[0].at < w[1].at)
                        && samples.iter().all(|s| {
                            s.at > 0
                                && s.windows.len() <= 2
                                && s.windows.iter().all(|w| {
                                    matches!(w.period.as_str(), "primary" | "secondary" | "monthly")
                                        && !w.label.is_empty()
                                        && w.label.len() <= 64
                                        && w.remaining.is_none_or(|p| {
                                            p.is_finite() && (0.0..=100.0).contains(&p)
                                        })
                                })
                        })
                });
            if !valid {
                return Err("기록 파일 형식 또는 용량 제한 오류".into());
            }
            Ok(data)
        })();
        match loaded {
            Ok(data) => store.data = data,
            Err(error) => {
                store.issue = Some(format!("모니터링 기록을 읽지 못했습니다: {error}"));
                store.blocked = true;
            }
        }
        store
    }
    fn persist(&mut self) -> Result<(), String> {
        if self.blocked {
            return Err(self
                .issue
                .clone()
                .unwrap_or_else(|| "기록 저장소를 사용할 수 없습니다.".into()));
        }
        if let Some(pending) = &self.pending_cleanup {
            match fs::remove_file(pending) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => {
                    let error = format!("임시 기록 파일 정리 실패: {e}");
                    self.issue = Some(error.clone());
                    return Err(error);
                }
            }
            self.pending_cleanup = None;
        }
        let Some(path) = &self.path else {
            return Ok(());
        };
        let save = (|| -> Result<(), String> {
            let bytes = serde_json::to_vec(&self.data).map_err(|e| e.to_string())?;
            if bytes.len() as u64 > MAX_BYTES {
                return Err("모니터링 기록 크기 제한 초과".into());
            }
            let parent = path.parent().ok_or("기록 경로 오류")?;
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            let temporary = path.with_extension(format!(
                "{}.pending",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos()
            ));
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&temporary).map_err(|e| e.to_string())?;
            // Only this newly created pending file belongs to this write.
            let result = (|| {
                file.write_all(&bytes)?;
                file.sync_all()?;
                fs::rename(&temporary, path)?;
                // Windows does not support opening directories through std::fs::File.
                // The file itself is synchronized before the atomic replacement above.
                #[cfg(unix)]
                fs::File::open(parent)?.sync_all()?;
                Ok(())
            })();
            if result.is_err() {
                match fs::remove_file(&temporary) {
                    Ok(()) => {}
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                    Err(_) => self.pending_cleanup = Some(temporary),
                }
            }
            result.map_err(|e: std::io::Error| e.to_string())
        })();
        match &save {
            Ok(()) => self.issue = None,
            Err(e) => self.issue = Some(format!("모니터링 기록 저장 실패: {e}")),
        };
        save
    }
    pub fn record(&mut self, account: &AccountSummary, now: i64) {
        let before = self.data.history.values().map(Vec::len).sum::<usize>();
        for samples in self.data.history.values_mut() {
            samples.retain(|s| s.at >= now - RETENTION);
        }
        self.data.history.retain(|_, v| !v.is_empty());
        let Some(at) = account.quota_observed_at.map(|t| t.timestamp()) else {
            return;
        };
        if self.data.history.len() >= 100 && !self.data.history.contains_key(&account.id) {
            return;
        }
        let after = self.data.history.values().map(Vec::len).sum::<usize>();
        let samples = self.data.history.entry(account.id.clone()).or_default();
        let mut changed = before != after;
        if samples
            .last()
            .is_none_or(|last| at - last.at >= SAMPLE_INTERVAL)
        {
            if after >= MAX_SAMPLES || samples.len() >= 302 {
                self.issue = Some("모니터링 이력 개수 제한에 도달했습니다.".into());
                return;
            }
            changed = true;
            samples.push(Sample {
                at,
                windows: windows(account),
            });
        }
        if changed || self.issue.is_some() {
            let _ = self.persist();
        }
    }
    pub fn histories(
        &self,
        accounts: &[AccountSummary],
        now: i64,
    ) -> BTreeMap<String, Vec<Sample>> {
        accounts
            .iter()
            .filter_map(|a| {
                self.data.history.get(&a.id).map(|samples| {
                    (
                        a.id.clone(),
                        samples
                            .iter()
                            .filter(|s| s.at >= now - RETENTION)
                            .cloned()
                            .collect(),
                    )
                })
            })
            .collect()
    }
    pub fn preferences(&self, accounts: &[AccountSummary]) -> BTreeMap<String, AlertPreference> {
        accounts
            .iter()
            .map(|a| {
                (
                    a.id.clone(),
                    self.data.alerts.get(&a.id).cloned().unwrap_or_default(),
                )
            })
            .collect()
    }
    pub fn configure(&mut self, id: &str, enabled: bool, threshold: u8) -> Result<(), String> {
        if !(1..=100).contains(&threshold) {
            return Err("알림 기준은 1~100%입니다.".into());
        }
        if self.blocked {
            return Err(self.issue.clone().unwrap_or_default());
        }
        if self.data.alerts.len() >= 100 && !self.data.alerts.contains_key(id) {
            return Err("알림 계정 수 제한 초과".into());
        }
        self.data
            .alerts
            .insert(id.into(), AlertPreference { enabled, threshold });
        self.persist()
    }
}
pub fn open_history(path: &Path) -> HistoryStore {
    HistoryStore::open(path.join("monitoring.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn account(at: i64, used: Option<f64>, reset: i64) -> AccountSummary {
        AccountSummary {
            id: "fixture".into(),
            account_id: "workspace".into(),
            email: None,
            plan: Some("team".into()),
            paused: false,
            quota: Some(
                serde_json::json!({"rate_limit":{"primary_window":{"used_percent":used,"limit_window_seconds":604800,"reset_at":reset}}}),
            ),
            quota_observed_at: Some(
                std::time::SystemTime::UNIX_EPOCH
                    .checked_add(std::time::Duration::from_secs(at as u64))
                    .unwrap()
                    .into(),
            ),
        }
    }
    #[test]
    fn history_preferences_and_unknowns_survive_restart_with_bounded_sampling() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("monitoring.json");
        let mut store = HistoryStore::open(path.clone());
        let at = 1900000000;
        store.record(&account(at, Some(51.0), 2000000000), at);
        store.record(&account(at + 60, Some(52.0), 2000000000), at + 60);
        assert_eq!(store.data.history["fixture"].len(), 1);
        store.record(&account(at + 300, None, 2000000000), at + 300);
        store.configure("fixture", false, 20).unwrap();
        let mut reopened = HistoryStore::open(path);
        assert!(reopened.issue.is_none());
        assert_eq!(reopened.data.history["fixture"].len(), 2);
        let window = &reopened.data.history["fixture"][0].windows[0];
        assert_eq!(window.period, "secondary");
        assert_eq!(window.remaining, Some(49.0));
        assert_eq!(
            reopened.data.history["fixture"][1].windows[0].remaining,
            None
        );
        assert!(!reopened.data.alerts["fixture"].enabled);
        assert_eq!(reopened.data.alerts["fixture"].threshold, 20);
        reopened.record(
            &account(at + RETENTION + 600, Some(60.0), 2100000000),
            at + RETENTION + 600,
        );
        assert_eq!(reopened.data.history["fixture"].len(), 1);
    }
    #[test]
    fn invalid_history_is_preserved_and_threshold_is_checked() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("monitoring.json");
        fs::write(&path, b"invalid fixture").unwrap();
        let mut store = HistoryStore::open(path.clone());
        assert!(store.issue.is_some());
        store.record(&account(1900000000, Some(50.0), 2000000000), 1900000000);
        assert!(store.configure("fixture", true, 10).is_err());
        assert_eq!(fs::read(path).unwrap(), b"invalid fixture");
        assert!(
            HistoryStore::default()
                .configure("fixture", true, 0)
                .is_err()
        );
    }
    #[test]
    fn loaded_history_enforces_file_size_limit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("monitoring.json");
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_BYTES + 1)
            .unwrap();
        assert!(HistoryStore::open(path).issue.is_some());
    }
}
