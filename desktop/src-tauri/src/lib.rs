#[cfg(feature = "android-worker")]
uniffi::setup_scaffolding!();
#[cfg(target_os = "android")]
mod android_widget;
#[cfg(feature = "android-worker")]
mod background;
mod commands;
mod history;
#[cfg(desktop)]
mod menubar;
#[cfg(target_os = "macos")]
mod menubar_native;
mod monitor;
mod panel;
mod voucher_alert;
#[cfg(feature = "android-worker")]
mod widget_snapshot;
#[cfg(not(target_os = "android"))]
use codex_lb_server::business::Endpoints;
use codex_lb_server::business::Service;
use std::sync::Arc;

use std::sync::atomic::AtomicBool;
#[cfg(desktop)]
use std::sync::atomic::Ordering;
#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;

struct DesktopState {
    initialization_error: Option<String>,
    service: Option<Arc<Service>>,
    exiting: AtomicBool,
    usage: Arc<monitor::UsageMonitor>,
    monitor: std::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    #[cfg(desktop)]
    account_trays: std::sync::Mutex<Vec<String>>,
}

#[cfg(desktop)]
fn show_window(app: &tauri::AppHandle) {
    if let Some(panel) = app.get_webview_window("menubar") {
        let _ = panel.hide();
    }
    if let Some(window) = app.get_webview_window("main")
        && let Err(error) = window
            .show()
            .and_then(|_| window.unminimize())
            .and_then(|_| window.set_focus())
    {
        eprintln!("Show window: {error}");
    }
}

#[cfg(mobile)]
fn show_window(_app: &tauri::AppHandle) {}

#[cfg(desktop)]
fn request_quit(app: tauri::AppHandle) {
    let state = app.state::<DesktopState>();
    if state.exiting.swap(true, Ordering::SeqCst) {
        return;
    }
    menubar::stop(&app);
    tauri::async_runtime::spawn(async move {
        let state = app.state::<DesktopState>();
        if let Some(service) = &state.service {
            let _ = service.cancel_login().await;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        show_window(app)
    }));
    #[cfg(target_os = "android")]
    let builder = builder.plugin(android_widget::init());
    #[cfg(target_os = "android")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        android_widget::mobile_settings,
        android_widget::set_mobile_interval,
        android_widget::pin_widget,
        commands::dashboard,
        commands::set_account_nickname,
        commands::show_dashboard,
        commands::hide_monitor_panel,
        commands::panel_account,
        commands::select_panel_account,
        commands::import_account,
        commands::change_account,
        commands::refresh_usage,
        commands::start_login,
        commands::pending_login,
        commands::open_login_page,
        commands::poll_login,
        commands::configure_alert,
        commands::cancel_login
    ]);
    let builder = builder.plugin(tauri_plugin_opener::init());
    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::dashboard,
        commands::set_account_nickname,
        commands::show_dashboard,
        commands::hide_monitor_panel,
        commands::panel_account,
        commands::select_panel_account,
        commands::import_account,
        commands::change_account,
        commands::refresh_usage,
        commands::start_login,
        commands::pending_login,
        commands::open_login_page,
        commands::poll_login,
        commands::configure_alert,
        commands::cancel_login
    ]);
    let app = builder
        .setup(|app| {
            let opened = app
                .path()
                .app_data_dir()
                .map_err(|_| "앱 저장소 경로를 찾을 수 없습니다.".to_owned())
                .and_then(|dir| {
                    #[cfg(target_os = "android")]
                    {
                        let core = background::core(&dir)?;
                        Ok((core.service.clone(), core.usage.clone()))
                    }
                    #[cfg(not(target_os = "android"))]
                    {
                        let service =
                            Service::open(&dir, Endpoints::default()).map_err(|e| e.to_string())?;
                        Ok((
                            service,
                            Arc::new(monitor::UsageMonitor::with_history(history::open_history(
                                &dir,
                            ))),
                        ))
                    }
                });
            let (service, usage, initialization_error) = match opened {
                Ok((service, usage)) => (Some(service), usage, None),
                Err(detail) => (
                    None,
                    Arc::new(monitor::UsageMonitor::default()),
                    Some(detail),
                ),
            };
            app.manage(DesktopState {
                initialization_error,
                service,
                exiting: AtomicBool::new(false),
                usage,
                monitor: std::sync::Mutex::new(None),
                #[cfg(desktop)]
                account_trays: std::sync::Mutex::new(Vec::new()),
            });
            panel::install(app.handle())?;
            #[cfg(desktop)]
            menubar::install(app.handle())?;
            #[cfg(target_os = "android")]
            android_widget::start(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "menubar" && matches!(event, tauri::WindowEvent::Focused(false)) {
                panel::lost_focus(window);
            }
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("Hide window: {error}");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Failed to create desktop application");
    app.run(|_app, event| match event {
        #[cfg(desktop)]
        tauri::RunEvent::ExitRequested {
            api, code: None, ..
        } => {
            api.prevent_exit();
            request_quit(_app.clone());
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => show_window(_app),
        _ => {}
    });
}
