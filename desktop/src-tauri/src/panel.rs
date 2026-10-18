use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri::{WebviewUrl, WebviewWindowBuilder};
#[derive(Default)]
struct PanelState {
    hidden_at: std::sync::Mutex<Option<std::time::Instant>>,
    selection: std::sync::Mutex<Option<String>>,
}
pub fn selected(app: &tauri::AppHandle) -> Option<String> {
    app.state::<PanelState>()
        .selection
        .lock()
        .ok()
        .and_then(|s| s.clone())
}
pub fn select(app: &tauri::AppHandle, id: String) -> tauri::Result<()> {
    if let Ok(mut selection) = app.state::<PanelState>().selection.lock() {
        *selection = Some(id.clone());
    }
    app.emit_to("menubar", "panel-account-selected", id)
}

pub fn install(app: &tauri::AppHandle) -> tauri::Result<()> {
    app.manage(PanelState::default());
    #[cfg(target_os = "macos")]
    WebviewWindowBuilder::new(
        app,
        "menubar",
        WebviewUrl::App("index.html#/menubar".into()),
    )
    .title("Codex Monitor · 빠른 보기")
    .inner_size(380.0, 640.0)
    .visible(false)
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .build()?;
    #[cfg(not(target_os = "macos"))]
    let _ = app;
    Ok(())
}

pub fn lost_focus(window: &tauri::Window) {
    if window.label() != "menubar" || !window.is_visible().unwrap_or(false) {
        return;
    }
    if let Ok(mut last) = window.state::<PanelState>().hidden_at.lock() {
        *last = Some(std::time::Instant::now());
    }
    let _ = window.hide();
}

#[cfg(target_os = "macos")]
fn placement(anchor: (f64, f64), area: (f64, f64, f64, f64)) -> (f64, f64, f64, f64) {
    let (left, top, width, height) = area;
    let w = 380.0_f64.min((width - 16.0).max(1.0));
    let h = 640.0_f64.min((height - 16.0).max(1.0));
    let x = (anchor.0 - w / 2.0).clamp(left + 8.0, left + width - w - 8.0);
    let y = anchor.1.max(top + 8.0).min(top + height - h - 8.0);
    (x, y, w, h)
}

#[cfg(target_os = "macos")]
pub fn toggle(
    app: &tauri::AppHandle,
    rect: tauri::Rect,
    point: tauri::PhysicalPosition<f64>,
    account: Option<String>,
) -> tauri::Result<()> {
    let same_account = account.is_none() || selected(app) == account;
    let Some(window) = app.get_webview_window("menubar") else {
        return Ok(());
    };
    let just_hidden = app
        .state::<PanelState>()
        .hidden_at
        .lock()
        .ok()
        .and_then(|last| *last)
        .is_some_and(|at| at.elapsed() < std::time::Duration::from_millis(250));
    if same_account && (window.is_visible()? || just_hidden) {
        return window.hide();
    }
    if let Some(id) = account {
        select(app, id)?;
    }
    let Some(monitor) = app.monitor_from_point(point.x, point.y)? else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let position = rect.position.to_physical::<f64>(scale);
    let size = rect.size.to_physical::<f64>(scale);
    let area = monitor.work_area();
    let (x, y, w, h) = placement(
        (
            (position.x + size.width / 2.0) / scale,
            (position.y + size.height) / scale + 5.0,
        ),
        (
            area.position.x as f64 / scale,
            area.position.y as f64 / scale,
            area.size.width as f64 / scale,
            area.size.height as f64 / scale,
        ),
    );
    window.set_size(tauri::LogicalSize::new(w, h))?;
    window.set_position(tauri::LogicalPosition::new(x, y))?;
    window.show()?;
    window.set_focus()
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    #[test]
    fn panel_stays_inside_work_area_on_offset_and_small_monitors() {
        for (anchor, area) in [
            ((1900.0, 25.0), (0.0, 24.0, 1920.0, 1056.0)),
            ((-1200.0, 30.0), (-1280.0, 24.0, 1280.0, 720.0)),
            ((20.0, 20.0), (0.0, 24.0, 320.0, 480.0)),
        ] {
            let (x, y, w, h) = placement(anchor, area);
            assert!(x >= area.0 && y >= area.1);
            assert!(x + w <= area.0 + area.2 && y + h <= area.1 + area.3);
        }
    }
}
