# Refactoring decisions

Reference: https://github.com/cursor/plugins/tree/main/pstack . Read Subtract Before You Add, Model the Domain, and Migrate Callers Then Delete Legacy APIs. Applied by removing duplicate web/native quota scheduling, modeling each account poll as attempted time plus error under one Rust owner, and migrating both consumers to its snapshot in the same change. No plugin installation or model routing was performed.

## Contract and structure

Preserve account login/import, encrypted credentials and rotation ownership, explicit quota reads, per-account percentages, timestamps, stale/error display, pause/remove and colored menu bar. Before edits, UI9 tests and library16 tests passed.

UsageMonitor owns serialized provider reads, automatic attempt times and failures. Native worker calls refresh_due and both IPC and menu read its snapshot. The dashboard only polls local state every5 seconds. Automatic provider reads remain at least60 seconds apart per account. Manual reads use the same gate and update the same failure state. Removed window scheduling, mutable frontend error ownership, unused React Query/Tooltip providers, unused upstream account metadata/feature flags and repeated validation of already parsed account values. Chart/copy components are separated from application workflow.

Retired relay source moved to a conditional module. Default desktop dependency graph excludes Axum and async-stream; legacy-relay explicitly enables compatibility fixtures. Default dashboard snapshot does not copy retained request history. Encrypted Data structure, keys, records and vault paths are unchanged.

## Scope adjustment

Automatic approval rejected the initial combined large deletion/crate rename/storage-model rewrite. A source tar backup was created and the change reduced to preserving storage format and relay source while excluding unused execution and dependencies from the app. Broad source deletion and storage migration were not applied. Original upstream modules/dependencies needed by its frontend remain unchanged.

## Verification

UI9 tests, desktop4 tests (including real loopback HTTP failure/success and automatic-attempt throttling), library16 compatibility tests, desktop TypeScript, frontend lint, rustfmt, Clippy -D warnings and strict OpenSpec passed. New bundle39.84MiB versus baseline40.36MiB; main JS716.96kB versus747.08kB. These are artifact sizes, not runtime speed measurements. Vite still reports a chunk-size warning. Cold/warm runtime, process-family CPU/memory, and agent-token comparisons were not measured. No real model generation or credential file import was performed.

Native verification: published bundle launched with the same two accounts and observed quotas. Manual provider refresh completed and observation timestamps advanced through the shared Rust owner. Relay port2455 returned ECONNREFUSED(61). Existing app and every changed source were backed up under .local/backups/refactor-monitor-20261016-215859. System menu-bar pixels were not accessible through the available native UI surface; menu presentation is covered by its existing three tests.
