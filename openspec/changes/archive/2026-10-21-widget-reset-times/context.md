# Widget update and reset times (0.1.20)

A single upper-right header timestamp replaces repeated account/footer observations. It is the latest non-future observation among displayed accounts, never the render clock. The header retains the settings action. Earlier observations differing by over 120 seconds have a text badge, while paused/error, unobserved and future-dated states remain explicit. This keeps a recently refreshed account from implicitly refreshing older accounts.

Each canonical quota window renders its own reset time as ↻ MM/dd HH:mm under the period label (or under its ring). These are quota reset times, not reset-voucher expirations. Missing values remain ↻ 미확인. Date interpretation remains owned by WidgetWindow.resetAt, without reparsing provider payloads. The old reset-visibility parameter and compact hide path were removed because all window layouts now own a reset field. Capacity budgets reflect 32dp per quota row.

The inline thick graph and trailing percentage remain in one row. A compact period/time column preserves the 280×180dp two-single-window-account case. Compact ring size adjusts to retain visible reset dates at 180×160dp; full-size rings remain unchanged. No provider requests, periodic timers or collection settings are added.

Verification: Android 16 ARM64 emulator update from 0.1.19; nine instrumentation tests passed. Tests verify the update appears once at the upper right, separate five-hour/weekly reset values, mixed-age badges, future/missing timestamps without fabricated updates, date text without ellipsis, compact rings/bars and unchanged configuration lifecycle. Two one-window accounts have identical content height below 180dp in short and tall allocations. Light/dark screenshots reviewed. Physical Samsung launcher and custom font scaling remain unverified.

Screenshots (synthetic data): docs/monitor/assets/android-widget-reset-times.png and android-widget-reset-times-compact.png. OpenSpec 1.11.0 strict validation: 75 specs; strict MkDocs build passed. APK packaging checks version 0.1.20, ARM64, identity and unchanged preview certificate.
