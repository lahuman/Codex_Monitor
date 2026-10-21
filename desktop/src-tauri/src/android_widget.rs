use crate::DesktopState;
use serde::{Deserialize, Serialize};
use tauri::{
    Manager, Runtime,
    plugin::{Builder, PluginHandle, TauriPlugin},
};
struct Bridge<R: Runtime>(PluginHandle<R>);
#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub minutes: u64,
    pub background_minutes: Option<u64>,
    pub background_state: String,
    pub last_worker_at: Option<i64>,
    pub last_worker_result: Option<String>,
}
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("monitor-widget")
        .setup(|app, api| {
            let handle = api
                .register_android_plugin("local.codex_lb.desktop.preview", "MonitorWidgetPlugin")?;
            app.manage(Bridge(handle));
            Ok(())
        })
        .build()
}
#[tauri::command]
pub async fn mobile_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    app.state::<Bridge<tauri::Wry>>()
        .0
        .run_mobile_plugin_async("settings", serde_json::json!({}))
        .await
        .map_err(|_| "조회 설정을 읽지 못했습니다.".into())
}
#[tauri::command]
pub async fn set_mobile_interval(app: tauri::AppHandle, minutes: u64) -> Result<Settings, String> {
    if ![0, 1, 5, 10, 30, 60, 100].contains(&minutes) {
        return Err("지원하지 않는 조회 간격입니다.".into());
    }
    let settings: Settings = app
        .state::<Bridge<tauri::Wry>>()
        .0
        .run_mobile_plugin_async("setInterval", serde_json::json!({"minutes": minutes}))
        .await
        .map_err(|_| "조회 설정을 저장하지 못했습니다.".to_owned())?;
    app.state::<DesktopState>()
        .usage
        .configure_mobile(settings.minutes)?;
    Ok(settings)
}
#[tauri::command]
pub async fn pin_widget(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    app.state::<Bridge<tauri::Wry>>()
        .0
        .run_mobile_plugin_async("pinWidget", serde_json::json!({}))
        .await
        .map_err(|_| "홈 화면에서 길게 눌러 Codex Monitor 위젯을 추가해 주세요.".into())
}
pub fn start(app: &tauri::AppHandle) {
    let handle = app.clone();
    let task = tauri::async_runtime::spawn(async move {
        let mut previous_snapshot = String::new();
        loop {
            crate::background::wait_for_visibility().await;
            let settings = mobile_settings(handle.clone()).await;
            if let Ok(settings) = settings {
                let state = handle.state::<DesktopState>();
                if let Some(service) = &state.service {
                    let _ = state.usage.refresh_mobile(service, settings.minutes).await;
                    if let Ok(snapshot) = state.usage.snapshot(service)
                        && let Ok(snapshot) =
                            serde_json::to_string(&crate::widget_snapshot::snapshot(&snapshot))
                        && snapshot != previous_snapshot
                    {
                        if handle
                            .state::<Bridge<tauri::Wry>>()
                            .0
                            .run_mobile_plugin_async::<serde_json::Value>(
                                "publish",
                                serde_json::json!({"snapshot": snapshot}),
                            )
                            .await
                            .is_ok()
                        {
                            previous_snapshot = snapshot;
                        }
                    }
                }
            }
            tokio::select! {
                _ = tokio::time::sleep(std::time::Duration::from_secs(15)) => {},
                _ = crate::background::lifecycle_changed() => {},
            }
        }
    });
    if let Ok(mut owned) = app.state::<DesktopState>().monitor.lock() {
        *owned = Some(task);
    }
}
