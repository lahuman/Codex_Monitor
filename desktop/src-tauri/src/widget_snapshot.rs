use serde::Serialize;
#[derive(Serialize)]
struct WidgetAccount {
    id: String,
    name: String,
    observed_at: Option<i64>,
    status: &'static str,
    windows: Vec<crate::history::Window>,
    vouchers: Option<u64>,
}
#[derive(Serialize)]
pub struct WidgetSnapshot {
    version: u8,
    accounts: Vec<WidgetAccount>,
    total: usize,
    active_count: usize,
}
pub fn snapshot(snapshot: &crate::monitor::Snapshot) -> WidgetSnapshot {
    WidgetSnapshot {
        version: 2,
        total: snapshot.accounts.len(),
        active_count: snapshot.accounts.iter().filter(|a| !a.paused).count(),
        accounts: snapshot
            .accounts
            .iter()
            .take(100)
            .map(|a| WidgetAccount {
                id: a.id.clone(),
                name: snapshot
                    .account_labels
                    .get(&a.id)
                    .map(|l| l.full.chars().take(48).collect())
                    .unwrap_or_else(|| "계정".into()),
                observed_at: a.quota_observed_at.map(|t| t.timestamp()),
                status: if a.paused {
                    "정지"
                } else if snapshot.usage_errors.contains_key(&a.id) {
                    "조회 실패"
                } else {
                    "마지막 관측"
                },
                windows: snapshot
                    .quota_windows
                    .get(&a.id)
                    .cloned()
                    .unwrap_or_default()
                    .into_iter()
                    .take(2)
                    .collect(),
                vouchers: snapshot
                    .reset_credits
                    .get(&a.id)
                    .and_then(|v| v.available_count),
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn widget_catalogue_preserves_identity_and_canonical_windows_without_provider_payload() {
        let accounts: Vec<_> = (0..100)
            .map(|i| codex_lb_server::business::AccountSummary {
                id: format!("account-{i}"),
                account_id: "private-provider-id".into(),
                email: Some("not-exported@example.test".into()),
                plan: None,
                paused: i == 1,
                quota: Some(serde_json::json!({"access_token":"never-export","rate_limit":{}})),
                quota_observed_at: Some(chrono::Utc::now()),
            })
            .collect();
        let mut source = crate::monitor::Snapshot {
            account_labels: accounts
                .iter()
                .map(|a| {
                    (
                        a.id.clone(),
                        crate::history::AccountLabel {
                            nickname: Some("업무".into()),
                            full: "업무".repeat(48),
                            compact: "업무".into(),
                        },
                    )
                })
                .collect(),
            quota_windows: accounts
                .iter()
                .map(|a| {
                    (
                        a.id.clone(),
                        vec![crate::history::Window {
                            period: "monthly".into(),
                            label: "월간".into(),
                            seconds: Some(2592000),
                            remaining: Some(0.0),
                            reset_at: None,
                        }],
                    )
                })
                .collect(),
            accounts,
            storage_pending: false,
            reset_credits: Default::default(),
            voucher_urgency: Default::default(),
            usage_errors: Default::default(),
            history: Default::default(),
            alert_preferences: Default::default(),
            poll_status: Default::default(),
            monitoring_issue: None,
        };
        source
            .usage_errors
            .insert("account-2".into(), "sensitive transport details".into());
        let result = serde_json::to_value(snapshot(&source)).unwrap();
        assert_eq!(result["version"], 2);
        assert_eq!(result["accounts"].as_array().unwrap().len(), 100);
        assert_eq!(result["accounts"][99]["id"], "account-99");
        assert_eq!(result["accounts"][0]["windows"][0]["label"], "월간");
        assert_eq!(result["accounts"][0]["windows"][0]["remaining"], 0.0);
        assert_eq!(result["accounts"][1]["status"], "정지");
        assert_eq!(result["accounts"][2]["status"], "조회 실패");
        let encoded = result.to_string();
        assert!(encoded.len() < 131072);
        for secret in [
            "never-export",
            "private-provider-id",
            "not-exported@example.test",
            "sensitive transport details",
        ] {
            assert!(!encoded.contains(secret));
        }
        source.accounts.clear();
        assert_eq!(
            serde_json::to_value(snapshot(&source)).unwrap()["accounts"],
            serde_json::json!([])
        );
    }
}
