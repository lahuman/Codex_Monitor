# Monitoring insight scope

Added the seven agreed candidates: reset countdown, quota health summary, observation/poll status, plan and account status, observed 24-hour graph, comparable roughly one-hour quota decrease, and per-account configurable low-quota alerts. Alerts appear inside the app; no OS notification delivery or permission is added. Defaults enable alerts at ten percent remaining, and the UI offers five/ten/twenty/thirty percent with persisted preferences. Health summary uses a separate fixed twenty-percent low-quota definition.

## Data ownership

The Rust UsageMonitor owns reads and polling metadata. A separate monitoring.json contains only versioned account IDs, window observations and alert preferences, never tokens or emails. Credential storage is unchanged. History records at most one sample per account per five minutes and retains twenty-five hours to support a twenty-four-hour graph and boundary comparisons. Limits are one hundred account histories/preferences, three hundred two samples per account, thirty-two thousand total samples and eight MiB on disk. Files are created with0600 on macOS and replaced atomically through an owned pending file. Failed cleanup paths remain owned for retry. Malformed/oversized files remain untouched with a visible issue.

Current observations are shown immediately alongside saved samples. One-hour decrease requires a nearby one-hour baseline, fresh latest observation, the same duration/reset identity, no unknown samples, and no gap exceeding fifteen minutes. It is percentage points, never inferred token counts. Graph lines break at resets, increases, duration changes and gaps. Insufficient data remains unavailable. Paused/stale/unknown accounts do not trigger low-quota alerts.

## Verification

UI14 tests and Rust7 tests pass, including persistence/restart, unknowns, sample/retention limits, malformed/oversized file preservation, reset/gap behavior, summary/countdown/history, IPC alert preference update and poll throttling. TypeScript, frontend lint, Clippy -D warnings, rustfmt and strict OpenSpec pass. App40.45MiB versus39.84MiB baseline; main JS724.75kB versus716.96kB. These are artifact sizes, not runtime speed measurements. Chunk-size warning remains. Runtime CPU, process-family memory and cold/warm timing comparisons are unmeasured.

Native validation: existing two accounts remained intact. Health summary, real quota warning, reset countdown, plan/status, last/next polling display and alert controls rendered with actual data. A manual read wrote two account samples to the independent monitoring file with0600 permissions; no credential file was inspected. Port2455 remains closed. Native validation exposed second/millisecond precision duplication, now normalized to epoch seconds and covered by a regression test. The graph uses saved samples plus a distinct current observation only.

Final native verification: restart restored the existing observation history. Real per-account graph, countdown, next-poll timer, plan/status and alert threshold controls were visually checked. The low-quota alert rendered for an actually observed account below the default threshold. Approximate one-hour decrease correctly stayed unavailable because only a few minutes had been collected. No user alert preference was changed during native validation.
