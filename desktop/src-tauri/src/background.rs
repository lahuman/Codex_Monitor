//! Headless Android collection. One process owns the same account service and history as the UI.
use crate::{history, monitor::UsageMonitor};
use codex_lb_server::business::{Endpoints, Service};
use std::{
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

pub struct MobileCore {
    pub service: Arc<Service>,
    pub usage: Arc<UsageMonitor>,
}
static CORE: Mutex<Option<(PathBuf, Arc<MobileCore>)>> = Mutex::new(None);
static VISIBLE: AtomicBool = AtomicBool::new(false);
static LIFECYCLE: tokio::sync::Notify = tokio::sync::Notify::const_new();

pub fn core(path: &Path) -> Result<Arc<MobileCore>, String> {
    let path = std::fs::canonicalize(path).map_err(|_| "앱 저장소를 확인하지 못했습니다.")?;
    let mut owned = CORE.lock().map_err(|_| "앱 상태 잠금 오류")?;
    if let Some((identity, core)) = &*owned {
        if identity != &path {
            return Err("다른 앱 저장소의 상태는 공유할 수 없습니다.".into());
        }
        return Ok(core.clone());
    }
    let service = Service::open(&path, Endpoints::default()).map_err(|e| e.to_string())?;
    let core = Arc::new(MobileCore {
        service,
        usage: Arc::new(UsageMonitor::with_history(history::open_history(&path))),
    });
    *owned = Some((path, core.clone()));
    Ok(core)
}
#[uniffi::export]
pub fn set_app_visible(visible: bool) {
    VISIBLE.store(visible, Ordering::SeqCst);
    LIFECYCLE.notify_one();
}
#[cfg(target_os = "android")]
pub async fn wait_for_visibility() {
    while !VISIBLE.load(Ordering::SeqCst) {
        LIFECYCLE.notified().await;
    }
}
#[cfg(target_os = "android")]
pub async fn lifecycle_changed() {
    LIFECYCLE.notified().await;
}

#[derive(Debug, uniffi::Error)]
pub enum WorkerError {
    Storage,
    Interval,
    Runtime,
}
impl std::fmt::Display for WorkerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Storage => "앱 저장소에 접근하지 못했습니다.",
            Self::Interval => "조회 간격이 올바르지 않습니다.",
            Self::Runtime => "백그라운드 실행을 준비하지 못했습니다.",
        })
    }
}
impl std::error::Error for WorkerError {}
#[derive(uniffi::Record)]
pub struct WorkerReading {
    pub snapshot: String,
    pub outcome: String,
}

#[uniffi::export]
pub fn collect_background(data_dir: String, minutes: u32) -> Result<WorkerReading, WorkerError> {
    crate::monitor::mobile_interval(u64::from(minutes)).map_err(|_| WorkerError::Interval)?;
    if minutes == 0 {
        return Err(WorkerError::Interval);
    }
    static RUNTIME: OnceLock<Result<tokio::runtime::Runtime, std::io::Error>> = OnceLock::new();
    let runtime = RUNTIME
        .get_or_init(|| {
            tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .enable_all()
                .build()
        })
        .as_ref()
        .map_err(|_| WorkerError::Runtime)?;
    runtime.block_on(async {
        let core = core(Path::new(&data_dir)).map_err(|_| WorkerError::Storage)?;
        let result = tokio::time::timeout(
            Duration::from_secs(120),
            core.usage.refresh_due_after(
                &core.service,
                Duration::from_secs(u64::from(minutes.max(15)) * 60),
            ),
        )
        .await;
        let snapshot = core
            .usage
            .snapshot(&core.service)
            .map_err(|_| WorkerError::Storage)?;
        let outcome = match result {
            Err(_) => "timeout",
            Ok(Err(_)) => "storage_error",
            Ok(Ok(())) if !snapshot.usage_errors.is_empty() => "query_error",
            Ok(Ok(())) => "completed",
        };
        let snapshot = serde_json::to_string(&crate::widget_snapshot::snapshot(&snapshot))
            .map_err(|_| WorkerError::Storage)?;
        Ok(WorkerReading {
            snapshot,
            outcome: outcome.into(),
        })
    })
}
