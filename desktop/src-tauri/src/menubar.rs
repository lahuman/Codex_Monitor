use crate::{DesktopState, request_quit, show_window};
use codex_lb_server::business::AccountSummary;
use std::{
    collections::{BTreeMap, HashMap},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

fn windows(account: &AccountSummary) -> Vec<(String, Option<f64>)> {
    crate::history::windows(account)
        .into_iter()
        .map(|w| (w.label, w.remaining))
        .collect()
}
fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn age(account: &AccountSummary, now: i64) -> Option<i64> {
    account
        .quota_observed_at
        .map(|t| now.saturating_sub(t.timestamp()))
}

#[derive(Clone, PartialEq, Debug)]
pub(crate) struct MenuColumn {
    pub label: String,
    pub quota: Vec<Option<f64>>,
    pub marker: String,
}
impl MenuColumn {
    #[cfg(any(target_os = "macos", test))]
    fn quota_text(&self) -> String {
        let values = self
            .quota
            .iter()
            .map(|v| v.map_or_else(|| "—".into(), |v| format!("{v:.0}%")))
            .collect::<Vec<_>>()
            .join("/");
        format!(
            "{}{}",
            if values.is_empty() { "—" } else { &values },
            self.marker
        )
    }
}

#[derive(Clone, PartialEq, Debug)]
struct Presentation {
    title: String,
    rows: Vec<String>,
    columns: Vec<MenuColumn>,
    account_ids: Vec<String>,
    voucher_urgent: Vec<String>,
}
fn present(
    accounts: &[AccountSummary],
    errors: &HashMap<String, String>,
    now: i64,
    labels: &BTreeMap<String, crate::history::AccountLabel>,
) -> Presentation {
    const COLORS: [&str; 8] = ["🔵", "🟢", "🟣", "🟠", "🟡", "🔴", "🟤", "⚪"];
    let mut short = vec![];
    let mut rows = vec![];
    let mut columns = vec![];
    for (index, account) in accounts.iter().enumerate() {
        let color = COLORS[index % COLORS.len()];
        let label = labels
            .get(&account.id)
            .cloned()
            .unwrap_or_else(|| crate::history::account_label(account, None));
        let values = windows(account);
        let remaining = values
            .iter()
            .map(|(_, v)| v.map_or_else(|| "—".into(), |v| format!("{v:.0}%")))
            .collect::<Vec<_>>()
            .join("/");
        let stale = age(account, now).is_none_or(|a| !(0..=120).contains(&a));
        if index < 4 {
            let marker = if account.paused {
                "Ⅱ"
            } else if errors.contains_key(&account.id) {
                "!"
            } else if stale {
                "~"
            } else {
                ""
            };
            columns.push(MenuColumn {
                label: label.compact.clone(),
                quota: values.iter().map(|(_, remaining)| *remaining).collect(),
                marker: marker.into(),
            });
            short.push(format!(
                "{} {}{}",
                color,
                if remaining.is_empty() {
                    "—"
                } else {
                    &remaining
                },
                if account.paused {
                    " 정지"
                } else if errors.contains_key(&account.id) {
                    " !"
                } else if stale {
                    " ~"
                } else {
                    ""
                }
            ));
        }
        rows.push(format!(
            "{} {}{}",
            color,
            label.full,
            if account.paused {
                " · 일시 정지"
            } else {
                ""
            }
        ));
        if values.is_empty() {
            rows.push("    사용량 미확인".into());
        }
        for (label, remaining) in values {
            rows.push(remaining.map_or_else(
                || format!("    {label}: 사용량 미제공"),
                |r| format!("    {label}: 사용 {:.0}% · 잔여 {r:.0}%", 100.0 - r),
            ));
        }
        rows.push(format!(
            "    조회: {}{}",
            account
                .quota_observed_at
                .map_or_else(|| "조회 전".into(), |t| t.to_rfc3339()),
            if stale { " · 오래된 값" } else { "" }
        ));
        if let Some(error) = errors.get(&account.id) {
            rows.push(format!("    조회 실패: {error}"));
        }
    }
    let extra = if accounts.len() > 4 {
        format!(" · +{}", accounts.len() - 4)
    } else {
        String::new()
    };
    Presentation {
        title: if short.is_empty() {
            "🪙 · 계정 없음".into()
        } else {
            format!("🪙 {}{extra}", short.join(" · "))
        },
        rows,
        columns,
        account_ids: accounts.iter().map(|a| a.id.clone()).collect(),
        voucher_urgent: vec![],
    }
}
fn tooltip(view: &Presentation) -> String {
    let text = format!("Codex Monitor · {} · ~ 오래된 값 · ! 조회 실패", view.title);
    let mut units = 0;
    text.chars()
        .take_while(|character| {
            units += character.len_utf16();
            units <= 127
        })
        .collect()
}
fn menu(app: &tauri::AppHandle, rows: &[String]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for row in rows {
        menu.append(&MenuItem::new(app, row, false, None::<&str>)?)?;
    }
    menu.append(&MenuItem::with_id(
        app,
        "show",
        "대시보드 열기",
        true,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        "quit",
        "앱 종료",
        true,
        None::<&str>,
    )?)?;
    Ok(menu)
}
pub fn install(app: &tauri::AppHandle) -> tauri::Result<()> {
    let builder = TrayIconBuilder::with_id("usage-monitor");
    // Windows has no tray title; without an explicit icon the tray is invisible.
    #[cfg(not(target_os = "macos"))]
    let builder = {
        let icon = app.default_window_icon().ok_or_else(|| {
            tauri::Error::Io(std::io::Error::other("Application icon is missing"))
        })?;
        builder.icon(icon.clone())
    };
    #[cfg(target_os = "macos")]
    let builder = builder
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                rect,
                position,
                ..
            } = event
                && let Err(error) = crate::panel::toggle(tray.app_handle(), rect, position, None)
            {
                eprintln!("Monitor panel: {error}");
            }
        });
    builder
        .title("🪙 · 조회 중")
        .tooltip(format!(
            "{} · 계정별 잔여 한도 · ~ 오래된 값 · ! 조회 실패",
            app.package_info().name
        ))
        .menu(&menu(app, &[])?)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "quit" => request_quit(app.clone()),
            _ => {}
        })
        .build(app)?;
    start(app);
    Ok(())
}
pub fn start(app: &tauri::AppHandle) {
    let state = app.state::<DesktopState>();
    let mut owned = state.monitor.lock().unwrap_or_else(|e| e.into_inner());
    if owned.is_some() {
        return;
    }
    let app = app.clone();
    *owned = Some(tauri::async_runtime::spawn(async move {
        let mut previous = None;
        loop {
            let state = app.state::<DesktopState>();
            if state.exiting.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            if let Some(service) = &state.service {
                let _ = state.usage.refresh_due(service).await;
                match state.usage.snapshot(service) {
                    Ok(snapshot) => {
                        let mut view = present(
                            &snapshot.accounts,
                            &snapshot.usage_errors,
                            now_seconds(),
                            &snapshot.account_labels,
                        );
                        view.voucher_urgent = snapshot
                            .accounts
                            .iter()
                            .filter(|a| snapshot.voucher_urgency.contains_key(&a.id))
                            .map(|a| a.id.clone())
                            .collect();
                        if previous.as_ref() != Some(&view)
                            && let Some(tray) = app.tray_by_id("usage-monitor")
                        {
                            let result = menu(&app, &view.rows)
                                .and_then(|menu| tray.set_menu(Some(menu)))
                                .and_then(|()| update_title(&app, &tray, &view, &snapshot.accounts))
                                .and_then(|()| tray.set_tooltip(Some(tooltip(&view))));
                            match result {
                                Ok(()) => previous = Some(view),
                                Err(e) => eprintln!("Menu bar update: {e}"),
                            }
                        } else {
                            #[cfg(target_os = "macos")]
                            for (account, column) in
                                snapshot.accounts.iter().take(4).zip(&view.columns)
                            {
                                if let Some(tray) =
                                    app.tray_by_id(&format!("usage-account-{}", account.id))
                                {
                                    // Repaint semantic colors with the current native appearance;
                                    // preserve menus and provider polling while the window is hidden.
                                    if let Err(e) = crate::menubar_native::update(
                                        &tray,
                                        std::slice::from_ref(column),
                                        view.voucher_urgent.contains(&account.id),
                                    ) {
                                        eprintln!("Voucher label repaint: {e}");
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        clear_account_items(&app);
                        if let Some(tray) = app.tray_by_id("usage-monitor") {
                            #[cfg(target_os = "macos")]
                            let _ = tray.set_icon(None);
                            let _ = tray.set_visible(true);
                            let _ = tray.set_title(Some("🪙 · 조회 실패"));
                            let _ = tray.set_tooltip(Some(e.to_string()));
                        }
                        previous = None;
                    }
                }
            } else if let Some(tray) = app.tray_by_id("usage-monitor") {
                #[cfg(target_os = "macos")]
                let _ = tray.set_icon(None);
                let _ = tray.set_title(Some("🪙 · 저장소 오류"));
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }));
}
pub fn stop(app: &tauri::AppHandle) {
    if let Some(handle) = app
        .state::<DesktopState>()
        .monitor
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
    {
        handle.abort();
    }
    clear_account_items(app);
}

fn update_title(
    app: &tauri::AppHandle,
    tray: &tauri::tray::TrayIcon,
    view: &Presentation,
    accounts: &[AccountSummary],
) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        update_account_items(app, tray, view, accounts)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, accounts);
        tray.set_title(Some(&view.title))
    }
}

fn clear_account_items(app: &tauri::AppHandle) {
    let owned = app
        .state::<DesktopState>()
        .account_trays
        .lock()
        .map(|mut ids| std::mem::take(&mut *ids))
        .unwrap_or_default();
    for id in owned {
        app.remove_tray_by_id(&id);
    }
}
#[cfg(target_os = "macos")]
fn update_account_items_main(
    app: &tauri::AppHandle,
    summary: &tauri::tray::TrayIcon,
    view: &Presentation,
    accounts: &[AccountSummary],
) -> tauri::Result<()> {
    let desired = accounts
        .iter()
        .take(4)
        .map(|a| format!("usage-account-{}", a.id))
        .collect::<Vec<_>>();
    let state = app.state::<DesktopState>();
    let mut owned = state
        .account_trays
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    owned.retain(|id| {
        if desired.contains(id) {
            true
        } else {
            app.remove_tray_by_id(id);
            false
        }
    });
    for ((account, id), column) in accounts.iter().zip(&desired).zip(&view.columns) {
        let tray = match app.tray_by_id(id) {
            Some(tray) => tray,
            None => {
                let selected = account.id.clone();
                let tray = TrayIconBuilder::with_id(id.clone())
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(move |tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            rect,
                            position,
                            ..
                        } = event
                            && let Err(error) = crate::panel::toggle(
                                tray.app_handle(),
                                rect,
                                position,
                                Some(selected.clone()),
                            )
                        {
                            eprintln!("Account panel: {error}");
                        }
                    })
                    .build(app)?;
                owned.push(id.clone());
                tray
            }
        };
        crate::menubar_native::update(
            &tray,
            std::slice::from_ref(column),
            view.voucher_urgent.contains(&account.id),
        )?;
        tray.set_menu(Some(menu(app, &view.rows)?))?;
        tray.set_tooltip(Some(format!(
            "{} · {} · ~ 오래된 값 · ! 조회 실패 · Ⅱ 정지",
            account.email.as_deref().unwrap_or(&account.account_id),
            column.quota_text()
        )))?;
    }
    summary.set_visible(accounts.is_empty() || accounts.len() > 4)?;
    if accounts.len() > 4 {
        summary.set_icon(None)?;
        summary.set_title(Some(format!("+{}", accounts.len() - 4)))?;
    }
    if accounts.is_empty() {
        crate::menubar_native::update(summary, &[], false)?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn update_account_items(
    app: &tauri::AppHandle,
    tray: &tauri::tray::TrayIcon,
    view: &Presentation,
    accounts: &[AccountSummary],
) -> tauri::Result<()> {
    let app = app.clone();
    let summary = tray.clone();
    let view = view.clone();
    let accounts = accounts.to_vec();
    // Serialize native resource creation/removal on the UI thread. Never hold the
    // registry mutex on a worker while synchronously waiting for that thread.
    tray.with_inner_tray_icon(move |_| update_account_items_main(&app, &summary, &view, &accounts))?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn account(id: &str, used: Option<f64>) -> AccountSummary {
        AccountSummary {
            id: id.into(),
            account_id: id.into(),
            email: None,
            plan: None,
            paused: false,
            quota: Some(
                serde_json::json!({"rate_limit":{"primary_window":{"used_percent":used,"limit_window_seconds":604800}}}),
            ),
            quota_observed_at: None,
        }
    }
    #[test]
    fn per_account_percentage_is_not_averaged() {
        let view = present(
            &[account("one", Some(51.0)), account("two", Some(86.0))],
            &HashMap::new(),
            0,
            &BTreeMap::new(),
        );
        assert!(view.title.starts_with("🪙 "));
        assert_eq!(view.columns[0].label, "one");
        assert_eq!(view.columns[0].quota_text(), "49%~");
        assert_eq!(view.columns[0].quota, vec![Some(49.0)]);
        assert_eq!(view.columns[1].label, "two");
        assert_eq!(view.columns[1].quota_text(), "14%~");
        assert!(view.rows.iter().any(|r| r == "🔵 one"));
        assert!(view.rows.iter().any(|r| r == "🟢 two"));
        assert!(view.title.contains("🔵 49%"));
        assert!(view.title.contains("🟢 14%"));
        assert!(
            view.rows
                .iter()
                .any(|r| r.contains("주간: 사용 51% · 잔여 49%"))
        );
    }
    #[test]
    fn unknown_and_failed_observations_remain_explicit() {
        let view = present(
            &[account("one", None)],
            &HashMap::from([("one".into(), "network".into())]),
            0,
            &BTreeMap::new(),
        );
        assert!(view.title.contains("— !"));
        assert_eq!(view.columns[0].quota_text(), "—!");
        assert!(view.rows.iter().any(|r| r.contains("조회 실패: network")));
        assert!(view.rows.iter().any(|r| r.contains("조회 전")));
    }
    #[test]
    fn replacement_account_with_identical_visible_data_updates_click_identity() {
        let first = account("first", Some(51.0));
        let mut replacement = first.clone();
        replacement.id = "second".into();
        let before = present(&[first], &HashMap::new(), 0, &BTreeMap::new());
        let after = present(&[replacement], &HashMap::new(), 0, &BTreeMap::new());
        assert_eq!(before.columns, after.columns);
        assert_ne!(before, after);
    }
    #[test]
    fn tooltip_fits_windows_capacity_without_splitting_unicode() {
        let view = Presentation {
            title: "🔵".repeat(100),
            rows: vec![],
            columns: vec![],
            account_ids: vec![],
            voucher_urgent: vec![],
        };
        let value = tooltip(&view);
        assert!(value.encode_utf16().count() <= 127);
        assert!(value.starts_with("Codex Monitor"));
    }
    #[test]
    fn title_is_bounded_and_menu_keeps_every_account() {
        let accounts = (0..100)
            .map(|i| account(&i.to_string(), Some(10.0)))
            .collect::<Vec<_>>();
        let view = present(&accounts, &HashMap::new(), 0, &BTreeMap::new());
        assert!(view.title.contains("+96"));
        assert!(view.rows.iter().any(|r| r == "🟠 99"));
    }
}
