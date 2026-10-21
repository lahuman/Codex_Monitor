# Graphical Android widgets

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
