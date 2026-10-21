# Context
The user selected phone-only direct login. Reuse the existing Rust business/monitor implementation. The first widget is a truthful last-observation view; no foreground notification service or independent duplicate credential backend is introduced. Background API polling would need a separately verified Android execution lifecycle.

Android SDK 36, NDK 28.2.13676358, Gradle 9.6.1 and AGP 9.2.0 build the ARM64 preview. Native RemoteViews reads a token-free Rust projection, with a timestamp and tap-to-open. The default collection cadence is 10 minutes; 0 disables collection, and explicit manual refresh bypasses automatic timing. No foreground service or exact background alarm is installed. Android uses WebPKI TLS roots because the desktop native-certificate probe only searches Termux paths on Android; certificate verification is retained.

Example: disable collection, force-stop and reopen: the setting stays disabled; tapping manual collection still reads active accounts. The home widget says automatic collection is off and retains its last observation.


## Battery-aware background collection (0.1.13)
Android WorkManager owns one persistent periodic job, with connected network and battery-not-low constraints. UI timers stop while hidden; the widget has no periodic alarm. For example, a selected 5-minute foreground cadence becomes at least 15 minutes in background. Doze can defer work; force-stop requires reopening. This avoids an always-running service. Shared Rust state owns transport and durable attempts across Activity and Worker. UniFFI-generated Kotlin loads the same native library without starting a WebView. No authenticated phone battery measurement has been performed.


## Login recovery (0.1.14)
A completed browser page is not proof that app token exchange/storage completed. The previous UI discarded its code on every IPC error and Service::open restored no device flow. Store Waiting/Exchange/Tokens phases in the existing encrypted vault, recover on startup and pause UI polling while hidden. For example, a browser approval during process reclamation resumes the same code after reopening. One-shot authorization grants can still be consumed upstream if the process dies during exchange; an upstream invalid grant requires a fresh login. Tokens, grants and device IDs never enter the widget or release artifacts.


## Mobile card layout (0.1.15)
Android uses paired quota bars with account identity above them, a compact voucher line and collapsed details. Shared quota windows, health, voucher interpretation, history and alert controls remain owned by their existing modules. Settings live in the menu, and charts are mounted only when expanded. For example, two connected accounts can be compared on a 390px phone without opening large charts. Unknown percentages remain distinct from zero. No relay or fabricated token/cost metrics are introduced. Desktop keeps its original composition.

## Graphical widget revision (0.1.17)


## Design rationale

Use the mobile dashboard’s large quota values, calm surfaces and green/yellow/orange/red threshold hierarchy. Android widget styling and adaptive sizing guidance, plus battery-widget circle and comparison patterns, informed the native layout; no external artwork is copied.

- https://developer.android.com/design/ui/mobile/guides/widgets/style
- https://developer.android.com/design/ui/mobile/guides/widgets/sizing
- https://developer.android.com/develop/ui/views/appwidgets/configuration
- https://dribbble.com/shots/23054734-Battery-Analytics-Widget-for-android

For example, place a dark ring widget for a work account next to a light bar widget for a personal account. The overview retains bars and shows the visible/total count. Small sizes omit reset details, while preserving quota and observation time. The widget does not claim token counts or a history graph from a single quota observation.

## Ownership and compatibility

Rust emits version 2 canonical quota summaries with stable internal account ids (at most 100, matching account-service limits). WidgetData is the single Kotlin parser, retaining unknown versus zero. Legacy version 1 overview snapshots remain readable. Per-widget preferences own account, graph, theme and privacy choices; restore remaps ids and deletion removes only the matching entry. A removed account never selects a replacement implicitly.

Configuration uses framework Activity/views, matching the RemoteViews launcher inflater. AppCompat’s view substitution is incompatible with RemoteViews bitmap actions and was caught in instrumentation. Pin confirmation carries an explicit mutable one-shot callback so the launcher can supply its widget id; the receiver verifies provider ownership before saving. Existing installed widgets default to overview and can use the settings button.

Bitmaps are density-independent and bounded: two 176×176 ARGB rings per orientation (~496 KiB for both orientation layouts). Native text stays accessible. Widget refreshes use cached summaries; no new network work or timers are introduced. Actual battery drain has not been measured.

## Verification

Android 16 dedicated ARM64 emulator, synthetic accounts only: five native instrumentation tests cover canonical validation, sixth-account selection, independent settings, real AppWidgetManager bind/update/restore/delete, save/cancel UI, pin callback ownership and light/dark/compact/unknown/zero renders. Small-ring footer was shortened after screenshot review to prevent clipping. System bars follow the native configuration theme. Rust library tests: 21 passed. Desktop/mobile frontend tests: 67 passed.

Before: docs/monitor/assets/android-widget.png (previous plain summary). After: android-widget-rings.png, android-widget-dark.png and android-widget-overview.png in the same directory, captured from actual RemoteViews with synthetic data. Real phone launchers, device font settings and provider collection are not established by emulator tests.

Manual launcher verification: the app opened the Android pin confirmation sheet; confirming added a live 4×3 widget to the emulator home screen. OpenSpec 1.11.0 strict validation: 75 specs passed. MkDocs strict build passed. APK packaging verified version 0.1.17, ARM64, package identity and the existing preview signing certificate.

# Compact widget spacing (0.1.18)

The reported phone screenshot contains two single-window accounts inside a tall 4×3 allocation. The body previously used weight=1 and center_vertical, which spread unused space above and below the rows. The card now wraps its contents inside a transparent top-aligned host frame. Native row font padding and vertical padding are reduced, the overview subtitle is merged into the footer, and the default launcher grid requests 4×2 with a 180dp default / 160dp minimum resize height. The renderer accepts this lower height instead of silently treating it as 180dp.

The launcher owns an existing widget’s grid allocation; updating the APK cannot reclaim its cells automatically. Users can drag the lower resize handle upward or re-add the widget. Selected-account compact rings and bars also fit the 160dp minimum. Graph preference, account identity, cached values and collection frequency are unchanged. Configuration previews use 200dp instead of 260dp.

Verification: Android 16 ARM64 emulator updated from 0.1.17 to 0.1.18 without uninstalling. Six native integration tests passed, including the reported sm/ge one-window fixture at 280×180 and 280×320 dp. Both allocations produce the same card height below 180dp, retain both account values, place rows immediately below the header and keep the footer inside the card. Screenshots of light/dark overview and 160dp rings/bars were reviewed for clipping. Provider configuration save/cancel, independent settings, restore/delete and pinned-callback ownership continue to pass. No provider API calls or new timers were added. Samsung launcher resizing and non-default phone font scales were not verified on a physical phone.

After screenshot: docs/monitor/assets/android-widget-compact.png (synthetic sm/ge accounts, 48%/68%, actual RemoteViews rendering). Previous large-allocation design: android-widget-overview.png in the same folder. OpenSpec 1.11.0 strict validation and MkDocs strict build passed. The APK is checked for version 0.1.18, ARM64 architecture and matching preview signing certificate.

# Inline widget bars (0.1.19)

Horizontal quota presentation now uses one row for a decorative color-matched period dot, period label, 12dp rounded track and trailing percentage. Overview bars were 4dp; selected-account bars were 7dp. Percentage values remain native accessible text, right-aligned outside the track. Unknown stays an em dash and zero remains 0%; stale/error values retain muted colors. Rings keep their existing layout.

Each quota period owns its inline row. Overview capacity now budgets by canonical window count instead of assuming equal-height accounts, so two-period accounts cannot overflow the previous one-period estimate. Up to four accounts are shown with the visible/total count. Card sizing, settings, account selection, observation timestamps and collection schedule are unchanged. One row uses a bounded 256×24 ARGB bitmap (24 KiB); rendering creates no provider requests or additional timers.

Android 16 ARM64 emulator: update install from 0.1.18; all seven native instrumentation tests passed. Real RemoteViews measurements verify that the value follows the track, centers vertically on it, stays within its row, and leaves a visible track at 180/280/360dp widths. The two-account 48%/68% single-period fixture still fits 280×180dp. Light/dark, multi-period, 100%, zero/unknown, compact rings, settings save/cancel, restore/delete and pin ownership were checked. The native screens were reviewed visually. Physical Samsung rendering and customized font scales remain unverified.

Screenshot: docs/monitor/assets/android-widget-inline.png (synthetic data). Before: android-widget-compact.png. Strict OpenSpec 1.11.0 validation: 75 specs; strict MkDocs build passed. APK packaging checks version 0.1.19, ARM64, package identity and the unchanged preview signing certificate.

# Widget update and reset times (0.1.20)

A single upper-right header timestamp replaces repeated account/footer observations. It is the latest non-future observation among displayed accounts, never the render clock. The header retains the settings action. Earlier observations differing by over 120 seconds have a text badge, while paused/error, unobserved and future-dated states remain explicit. This keeps a recently refreshed account from implicitly refreshing older accounts.

Each canonical quota window renders its own reset time as ↻ MM/dd HH:mm under the period label (or under its ring). These are quota reset times, not reset-voucher expirations. Missing values remain ↻ 미확인. Date interpretation remains owned by WidgetWindow.resetAt, without reparsing provider payloads. The old reset-visibility parameter and compact hide path were removed because all window layouts now own a reset field. Capacity budgets reflect 32dp per quota row.

The inline thick graph and trailing percentage remain in one row. A compact period/time column preserves the 280×180dp two-single-window-account case. Compact ring size adjusts to retain visible reset dates at 180×160dp; full-size rings remain unchanged. No provider requests, periodic timers or collection settings are added.

Verification: Android 16 ARM64 emulator update from 0.1.19; nine instrumentation tests passed. Tests verify the update appears once at the upper right, separate five-hour/weekly reset values, mixed-age badges, future/missing timestamps without fabricated updates, date text without ellipsis, compact rings/bars and unchanged configuration lifecycle. Two one-window accounts have identical content height below 180dp in short and tall allocations. Light/dark screenshots reviewed. Physical Samsung launcher and custom font scaling remain unverified.

Screenshots (synthetic data): docs/monitor/assets/android-widget-reset-times.png and android-widget-reset-times-compact.png. OpenSpec 1.11.0 strict validation: 75 specs; strict MkDocs build passed. APK packaging checks version 0.1.20, ARM64, identity and unchanged preview certificate.


## Responsive reset times (0.1.21)

A Samsung screenshot exposed that the fixed 68dp timestamp column truncated `10/28 …` although the default emulator font passed. Horizontal quota layouts now share one XML layout, with an 11sp full-width reset row. Ring dates wrap to their available width. The native renderer measures actual text/layout at the current density and font scale, reusing bounded graph bitmaps while dropping overflow accounts. When no complete account fits, a resize message replaces clipped content. The upper-right observation stamp remains unique; rendering makes no provider calls or timers.

For example, two weekly accounts at 280×180 dp and normal font scale retain names, bars, percentages and full reset dates. Enlarging system text can reduce the visible account count; enlarge the widget to see more. Font/density emulation cannot establish behavior for every Samsung font or launcher.
