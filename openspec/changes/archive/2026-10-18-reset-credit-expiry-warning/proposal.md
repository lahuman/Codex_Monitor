# Warn before reset vouchers expire

## Why
The monitoring app lists voucher expiry timestamps but does not emphasize an approaching deadline. Users can miss a voucher even while quota status is healthy. Upstream displays a countdown and marks less-than-seven-day validity as expiring soon; it also offers redemption which is outside our read-only product scope.

## What Changes
- Derive voucher display and warning eligibility in one frontend projection shared by the account panel and dashboard summary.
- Warn for available vouchers with less than seven days remaining and emphasize deadlines of at most 24 hours.
- Display per-voucher remaining time, badge and absolute expiry, preserving count/unknown/failure/stale/paused semantics.
- Advance the UI wall clock independently of successful IPC reads so failed refreshes do not freeze freshness or expiry classification.
- Document verified upstream behavior, app-specific urgency and the read-only scope.

## Impact
Desktop frontend only; existing provider/IPC reads, stored counts and local account/history data remain unchanged. No voucher redemption or OS notifications are introduced.
