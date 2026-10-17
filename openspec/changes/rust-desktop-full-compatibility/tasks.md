## 1. Baseline and decisions

- [x] 1.1 Pin upstream source commit and retain its license and frontend.
- [x] 1.2 Generate and verify a reproducible source inventory.
- [x] 1.3 Confirm Rust backend versus bundled original backend architecture.
- [x] 1.4 Validate this OpenSpec change.

## 2. Desktop application

- [x] 2.1 Add Tauri host, application identity, window and system tray.
- [x] 2.2 Implement owned service start/stop, port-conflict handling and drain.
- [x] 2.5 Verify automatic launch, single-instance reopen and in-app failure diagnostics.
- [x] 2.3 Integrate the existing dashboard components and external-browser authentication (desktop working slice; full frontend parity remains 3.8).
- [x] 2.4 Build and exercise a macOS development preview bundle (full product packaging remains in section 4).

## 3. Full feature compatibility

- [ ] 3.1 Configuration, encrypted storage, SQLite/PostgreSQL and migrations.
- [ ] 3.2 Account import/export, OAuth, refresh, usage and quota scheduling.
- [ ] 3.3 Selection, affinity, failover, reservations and graceful cancellation.
- [ ] 3.4 Responses, compact, Chat Completions, models, HTTP/SSE/WebSocket.
- [ ] 3.5 Files, images, audio, realtime and upstream control endpoints.
- [ ] 3.6 API keys, limits, firewall, dashboard sessions, roles, OIDC and SCIM.
- [ ] 3.7 Logs, reports, archives, automations, fleet, telemetry and maintenance.
- [ ] 3.8 Existing frontend flows, permission rules and settings behavior.

## 4. Verification and release

- [ ] 4.1 Isolated reference/candidate protocol and persistence comparisons.
- [ ] 4.2 Cancellation, malformed data, permissions, capacity and identity tests.
- [ ] 4.3 Real-provider checks with explicit test scope and test accounts.
- [ ] 4.4 Cold/warm task measurements: elapsed, CPU, peak memory and tokens.
- [ ] 4.5 Installation, restart, upgrade, rollback and uninstall checks.
- [ ] 4.6 Release only when all capability gates have evidence.

## 5. Desktop account / usage / proxy working slice

- [x] 5.1 Implement explicit Codex auth JSON import, seat-aware identity, pause/remove, encrypted independent app persistence.
- [x] 5.2 Implement device login polling, code exchange and serialized, owned token refresh.
- [x] 5.3 Fetch provider quota snapshots on demand with observation timestamps.
- [x] 5.4 Implement authenticated HTTP Responses/SSE and compact, bounded concurrency, pinned continuation, cancellation and durable token accounting.
- [x] 5.5 Wire desktop IPC and operational account/usage/request views.
- [x] 5.6 Validate local upstream workflows, failure/cancellation/storage cases, Clippy and strict OpenSpec.
- [x] 5.7 Verify packaged native UI and publish updated development app.
- [ ] 5.8 Verify device login, quota and generation against a user-selected real provider account.
