# Reset credit monitor context

## Expiry warnings in 0.1.2

# Context

Upstream inspected at commit `72630bbfeee9e3b0d9acfb95e2b1e706b8b0188e`. `frontend/src/utils/formatters.ts` defines EXPIRING_SOON_THRESHOLD_MS as seven days and considers strictly less than that interval expiringSoon. `reset-credit-confirm-dialog.tsx` lists available vouchers and nearest expiry with countdown/color; `reset-credit-settings.tsx` provides badges, expiry badge and opt-in auto-redemption; the reset-credit spec/scheduler attempts opt-in automatic redemption within five minutes. Source inspection establishes those behaviors, not an execution test of the upstream service.

This app remains read-only. It adopts the seven-day attention window and adds an inclusive 24-hour urgent level. A single reset-credit frontend projection owns status selection, sorted dates, remaining time and freshness-dependent warnings; consumers use its facts rather than independently reinterpreting raw statuses/dates. Authoritative available_count=0 overrides residual available items. Partial lists can warn about confirmed known vouchers but must retain missing-details notices. Unknown dates never mean unlimited validity.

In-app warnings require an active account, known positive count, usable details, no detail error and an observation between 0 and 120 seconds old. Stale/paused/error data remains displayed as historical information, not a live alarm. Expiry at or before now is labeled elapsed/refresh-needed rather than included among future warnings or used to decrement the provider count. Quota alert preferences do not disable voucher warnings.

Example: a fresh account holding vouchers expiring in six days and six hours shows two upcoming vouchers and urgent emphasis for the six-hour deadline, with both absolute dates retained. A stopped account shows only its last-observation labels. Visible UI ticks every five seconds and updates on focus even if IPC reads fail; no additional provider polling is added.

## Verification

41 frontend tests passed, including all seven-day/24-hour boundaries, elapsed/undated/unknown/redeemed statuses, authoritative zero, count/detail inconsistency, partial details, stale/future/missing timestamps, pause, privacy blur and focus-driven aging after IPC failure. Desktop TypeScript production build and ESLint passed. The initial production build caught a widened warning string type; the projection now explicitly binds it to its WarningLevel union. No untyped boundary cast was added.

Fictional browser QA compared the prior and new UI (0 vs 1 summary alert for the same fixture), examined light/dark themes and a 390px viewport without horizontal overflow, and found no browser console errors. QA fixtures stay in a temporary harness and are excluded from publication. No real account data was used for these previews.

The 0.1.2 optimized arm64 app, DMG and ZIP completed with strict full-bundle signing verification, ZIP round-trip, read-only DMG mount and checksums. Two real-app packaging/diagnostic regression tests passed. Signing remains ad-hoc with no notarization ticket and Gatekeeper rejection recorded; recipient Mac and Windows execution are not established by these tests. Existing versions remain preserved. Strict MkDocs, 85 local source/document/image links, installed Tauri JSON Schema and Windows workflow actionlint passed. Upstream review is pinned source inspection, not real upstream-service/provider verification.

## Menu bar voucher warning in 0.1.6

Rust voucher_alert owns account-scoped red-label urgency facts and freshness/expiry deadlines; native items and the compact panel consume those facts. The existing frontend voucher projection continues to own detail rows and seven-day notices. The compact panel reuses those rows with two initially visible expiry groups. Native urgent images use semantic red for the nickname and the button appearance for the quota; normal items remain templates. The existing five-second loop refreshes urgent image colors without adding provider requests.

For example, 업무 with one voucher expiring in six hours has a red nickname above a normal 49% quota row; its popup shows 1개, the absolute expiry and 6시간 0분 remaining. Another account without an urgent voucher keeps its normal nickname color.

## Nearest voucher first in 0.1.8

All voucher panels show one expiry row by default, with the provider total unchanged. The existing voucher projection sorts known future expiry dates first, then historical elapsed records, then undated records. This prevents an old elapsed record hiding the next usable voucher. An accessible button expands all details and collapses back to one. The compact account panel keys voucher detail state by account identity so another account does not inherit expansion. Existing count mismatches, missing-detail and stale/error messages remain. For example vouchers expiring in six hours, six days, yesterday and with no date initially show the six-hour record; expanding reveals all four.

## Compact popup layout in 0.1.9

One voucher row remains the initial state, with the rest not rendered until full-list expansion. Popup layout combines the provider total, a short warning badge and the full-list action in its heading, followed by the expiry date and remaining time on one line. The badge exposes warning counts through its accessible label and tooltip. The separate popup urgent paragraph and duplicated card warning paragraph were removed; native nickname urgency remains unchanged. For example a three-voucher account first shows its total, one expiry/countdown row and the explicit full-list action. Dashboard detail formatting remains unchanged.

Popup spacing is reduced while preserving font sizes and the chart. Extra errors, expanded details, long localized content and smaller displays may still require scrolling; overflow is never hidden. The component continues displaying stale/paused/error/unknown/count-mismatch notices, and dates use the user's local time zone. Compact absolute dates omit seconds but retain year, month, day, hour and minute.
