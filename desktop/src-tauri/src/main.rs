#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod history;
mod menubar;
mod monitor;
use codex_lb_server::business::{Endpoints, Service};
use std::sync::Arc;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

struct DesktopState {
    initialization_error: Option<String>,
    service: Option<Arc<Service>>,
    exiting: AtomicBool,
    usage: monitor::UsageMonitor,
    monitor: std::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main")
        && let Err(error) = window
            .show()
            .and_then(|_| window.unminimize())
            .and_then(|_| window.set_focus())
    {
        eprintln!("Show window: {error}");
    }
}

fn request_quit(app: tauri::AppHandle) {
    let state = app.state::<DesktopState>();
    if state.exiting.swap(true, Ordering::SeqCst) {
        return;
    }
    menubar::stop(&app);
    tauri::async_runtime::spawn(async move {
        let state = app.state::<DesktopState>();
        if let Some(service) = &state.service {
            service.cancel_login().await;
            if let Err(error) = service.drain_auth().await {
                state.exiting.store(false, Ordering::SeqCst);
                menubar::start(&app);
                show_window(&app);
                let _ = app.emit("operation-error", error.to_string());
                return;
            }
        }
        app.exit(0);
    });
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::dashboard,
            commands::import_account,
            commands::change_account,
            commands::refresh_usage,
            commands::start_login,
            commands::open_login_page,
            commands::poll_login,
            commands::configure_alert,
            commands::cancel_login
        ])
        .setup(|app| {
            let opened = app
                .path()
                .app_data_dir()
                .map_err(|_| "앱 저장소 경로를 찾을 수 없습니다.".to_owned())
                .and_then(|dir| {
                    Service::open(&dir, Endpoints::default()).map_err(|e| e.to_string())
                });
            let (service, initialization_error) = match opened {
                Ok(service) => (Some(service), None),
                Err(detail) => (None, Some(detail)),
            };
            app.manage(DesktopState {
                initialization_error,
                service,
                exiting: AtomicBool::new(false),
                usage: monitor::UsageMonitor::with_history(
                    app.path()
                        .app_data_dir()
                        .ok()
                        .map(|path| history::open_history(&path))
                        .unwrap_or_default(),
                ),
                monitor: std::sync::Mutex::new(None),
            });
            menubar::install(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("Hide window: {error}");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Failed to create desktop application");
    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested {
            api, code: None, ..
        } => {
            api.prevent_exit();
            request_quit(app.clone());
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => show_window(app),
        _ => {}
    });
}
