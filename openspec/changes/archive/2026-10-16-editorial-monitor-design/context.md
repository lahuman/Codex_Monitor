# Design decisions and verification

The supplied editorial reference informs the cream canvas, warm ink, coral interaction accent, hairline dividers, native serif headings and compact cards. Licensed reference fonts and third-party branding are not bundled. Dark mode uses warm dark surfaces and lighter semantic accents.

Account identity belongs to each card header. Quota legends describe only remaining and used, while history legends identify quota periods. A native SVG meter replaces the generic account-as-series donut, removing repeated identity and the wide legend column. Quota, countdown, freshness, history and alert controls share one account card. Cards use two columns from 1100 CSS pixels and one below that; period tiles wrap to fit.

For example, an account with a weekly quota shows its identity and plan above a small meter, a remaining/used legend, and a separate weekly history legend. An unknown observation remains unknown rather than becoming zero. The dashboard consumes the canonical quota_windows snapshot; fixture snapshots were corrected to include that backend contract.

Validation: 15 frontend product/monitoring tests passed, including semantic legend ownership, privacy, quota refresh, unknown data, period normalization and existing account actions. TypeScript and full frontend ESLint passed. Strict OpenSpec change validation passed. The macOS preview bundle built successfully (40.30 MiB); the existing large-main-JavaScript chunk warning remains. No Rust, storage or network contract changed.

Native QA at the existing 1200 by 850 window: inspected light and dark card, meter, history and alert layouts, separate account screen, and performed real usage refresh. The refresh completed and updated percentages and observation times. Both connected accounts remained available. The attempted native window-edge resize did not change its size, so minimum-width native visual verification is unverified; the CSS one-column layout is implemented. Theme restored to the original light setting. No account secrets or stored monitoring data were rewritten by publication. Previous source/assets/app bundles were backed up under .local/backups/editorial-design-*.

Bundle byte sizes are build outputs, not a latency or runtime memory benchmark. CPU time, process-family peak memory and end-to-end token cost were not measured for this UI change. No real-provider generation request was issued; QA uses quota observation only.
