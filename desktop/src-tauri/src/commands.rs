use crate::DesktopState;
use codex_lb_server::business::{AccountSummary, DeviceView, LoginStatus, Service};
use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;
fn service(state: &DesktopState) -> Result<Arc<Service>, String> {
    if state.exiting.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("앱이 종료 중입니다.".into());
    }
    state.service.clone().ok_or_else(|| {
        state
            .initialization_error
            .clone()
            .unwrap_or_else(|| "계정 저장소가 준비되지 않았습니다.".into())
    })
}
#[tauri::command]
pub fn dashboard(state: State<'_, DesktopState>) -> Result<crate::monitor::Snapshot, String> {
    state.usage.snapshot(service(&state)?.as_ref())
}
#[tauri::command]
pub async fn import_account(
    raw: String,
    state: State<'_, DesktopState>,
) -> Result<AccountSummary, String> {
    service(&state)?
        .import(&raw)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn change_account(
    id: String,
    remove: bool,
    paused: bool,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    service(&state)?
        .change_account(&id, remove, paused)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn refresh_usage(id: String, state: State<'_, DesktopState>) -> Result<(), String> {
    state.usage.refresh(&service(&state)?, &id).await
}
#[tauri::command]
pub async fn start_login(state: State<'_, DesktopState>) -> Result<DeviceView, String> {
    service(&state)?
        .start_login()
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn pending_login(state: State<'_, DesktopState>) -> Result<Option<DeviceView>, String> {
    match service(&state)?.pending_login().await {
        Ok(view) => Ok(Some(view)),
        Err(codex_lb_server::business::Error::Expired) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}
#[tauri::command]
pub async fn open_login_page(
    app: tauri::AppHandle,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    let view = service(&state)?
        .pending_login()
        .await
        .map_err(|e| e.to_string())?;
    app.opener().open_url(&view.verification_url, None::<&str>)
        .map_err(|_| "기본 브라우저를 열지 못했습니다. 표시된 로그인 주소를 복사해 원하는 브라우저에서 열어 주세요.".to_owned())
}
#[tauri::command]
pub async fn poll_login(state: State<'_, DesktopState>) -> Result<LoginStatus, String> {
    service(&state)?
        .poll_login()
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn cancel_login(state: State<'_, DesktopState>) -> Result<(), String> {
    service(&state)?
        .cancel_login()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn configure_alert(
    id: String,
    enabled: bool,
    threshold: u8,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    let service = service(&state)?;
    if !service
        .dashboard()
        .map_err(|e| e.to_string())?
        .accounts
        .iter()
        .any(|a| a.id == id)
    {
        return Err("계정을 찾을 수 없습니다.".into());
    }
    state.usage.configure_alert(&id, enabled, threshold)
}

#[tauri::command]
pub fn set_account_nickname(
    id: String,
    nickname: String,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    let service = service(&state)?;
    if !service
        .dashboard()
        .map_err(|e| e.to_string())?
        .accounts
        .iter()
        .any(|a| a.id == id)
    {
        return Err("계정을 찾을 수 없습니다.".into());
    }
    state.usage.set_nickname(&id, &nickname)
}
#[tauri::command]
pub fn show_dashboard(app: tauri::AppHandle) {
    if let Some(panel) = app.get_webview_window("menubar") {
        let _ = panel.hide();
    }
    crate::show_window(&app);
}
#[tauri::command]
pub fn hide_monitor_panel(app: tauri::AppHandle) -> Result<(), String> {
    app.get_webview_window("menubar")
        .map_or(Ok(()), |w| w.hide().map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn panel_account(app: tauri::AppHandle) -> Option<String> {
    crate::panel::selected(&app)
}
#[tauri::command]
pub fn select_panel_account(
    app: tauri::AppHandle,
    id: String,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    if !service(&state)?
        .dashboard()
        .map_err(|e| e.to_string())?
        .accounts
        .iter()
        .any(|a| a.id == id)
    {
        return Err("계정을 찾을 수 없습니다.".into());
    }
    crate::panel::select(&app, id).map_err(|e| e.to_string())
}
