use crate::monitor::ResetCreditObservation;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct VoucherUrgency {
    pub count: usize,
    pub expires_at: f64,
    pub observed_at: f64,
    pub valid_until: f64,
}
// One owner for the native menu and compact-panel label warning. Display-time
// consumers may invalidate these facts, never reinterpret provider candidates.
pub fn urgency(
    observation: &ResetCreditObservation,
    paused: bool,
    now: i64,
) -> Option<VoucherUrgency> {
    if paused || observation.error.is_some() {
        return None;
    }
    let count = observation.available_count?;
    if count == 0 {
        return None;
    }
    let at = chrono::DateTime::parse_from_rfc3339(observation.observed_at.as_deref()?)
        .ok()?
        .timestamp_millis() as f64
        / 1000.0;
    let now = now as f64;
    if !(0.0..=120.0).contains(&(now - at)) {
        return None;
    }
    let available = observation
        .credits
        .as_ref()?
        .iter()
        .filter(|c| c.status.as_deref() == Some("available"))
        .collect::<Vec<_>>();
    if available.len() as u64 > count {
        return None;
    }
    let expiries = available
        .iter()
        .filter_map(|c| c.expires_at.as_ref())
        .map(|t| t.timestamp_millis() as f64 / 1000.0)
        .filter(|expiry| *expiry > now && *expiry - now <= 86400.0)
        .collect::<Vec<_>>();
    let expires_at = expiries.iter().copied().min_by(f64::total_cmp)?;
    Some(VoucherUrgency {
        count: expiries.len(),
        expires_at,
        observed_at: at,
        valid_until: at + 120.0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use codex_lb_server::business::ResetCredit;
    const NOW: i64 = 1900000000;
    fn observation(offset: i64) -> ResetCreditObservation {
        ResetCreditObservation {
            available_count: Some(1),
            credits: Some(vec![ResetCredit {
                id: "voucher".into(),
                status: Some("available".into()),
                expires_at: chrono::DateTime::from_timestamp(NOW + offset, 0),
            }]),
            observed_at: Some(
                chrono::DateTime::from_timestamp(NOW, 0)
                    .unwrap()
                    .to_rfc3339(),
            ),
            error: None,
        }
    }
    #[test]
    fn one_day_boundary_and_expiry_are_not_rounded() {
        for (offset, expected) in [
            (86401, false),
            (86400, true),
            (1, true),
            (0, false),
            (-1, false),
        ] {
            assert_eq!(
                urgency(&observation(offset), false, NOW).is_some(),
                expected,
                "{offset}"
            );
        }
        let mut reading = observation(86400);
        reading.credits.as_mut().unwrap()[0].expires_at =
            chrono::DateTime::from_timestamp(NOW + 86400, 500_000_000);
        assert!(urgency(&reading, false, NOW).is_none());
    }
    #[test]
    fn details_status_count_and_paused_states_fail_closed() {
        let original = observation(3600);
        assert!(urgency(&original, true, NOW).is_none());
        for variant in 0..10 {
            let mut reading = original.clone();
            match variant {
                0 => reading.available_count = Some(0),
                1 => reading.available_count = None,
                2 => reading.credits = None,
                3 => reading.error = Some("offline".into()),
                4 => reading.observed_at = None,
                5 => reading.observed_at = Some("invalid".into()),
                6 => reading.credits.as_mut().unwrap()[0].status = Some("redeemed".into()),
                7 => reading.credits.as_mut().unwrap()[0].status = Some("unknown".into()),
                8 => reading.credits.as_mut().unwrap()[0].expires_at = None,
                _ => {
                    let copy = reading.credits.as_ref().unwrap()[0].clone();
                    reading.credits.as_mut().unwrap().push(copy);
                }
            }
            assert!(urgency(&reading, false, NOW).is_none(), "variant {variant}");
        }
    }
    #[test]
    fn validity_matches_the_existing_freshness_window() {
        let reading = observation(3600);
        assert!(urgency(&reading, false, NOW - 1).is_none());
        assert!(urgency(&reading, false, NOW + 120).is_some());
        assert!(urgency(&reading, false, NOW + 121).is_none());
    }
    #[test]
    fn confirmed_partial_details_warn_without_changing_provider_count() {
        let mut reading = observation(3600);
        reading.available_count = Some(5);
        let alert = urgency(&reading, false, NOW).unwrap();
        assert_eq!(alert.count, 1);
        assert_eq!(alert.expires_at, (NOW + 3600) as f64);
        assert_eq!(alert.valid_until, (NOW + 120) as f64);
        assert_eq!(reading.available_count, Some(5));
    }
}
