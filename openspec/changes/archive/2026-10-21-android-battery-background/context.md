# Context

WorkManager batches requests under OS power management; foreground 1/5/10-minute choices use a 15-minute background floor. Current cache-only APK 0.1.12 stays preserved. A headless generated Rust bridge must first prove that it can run before an Activity exists; an Activity-only service is not sufficient. Force-stop is distinct from am kill/process reclamation.


## Verification (2026-10-21)
- Rust library: 20 tests passed; durable failed-attempt cooldown survives reopening and overlapping automatic tasks; disabled blocks automatic but permits manual collection.
- Dashboard: 58 tests passed, including selected/effective cadence and worker outcome.
- Android 16 ARM64 dedicated empty emulator: 4 instrumentation tests passed. No Activity/WebView launch was required for native Worker collection. Constraints, one unique periodic job, 15-minute minimum, UPDATE identity, cancellation and disabled no-op were verified.
- Production Worker was scheduled as a QA one-shot (10-second delay), app reclaimed with am kill, PID absent, then Android cold-started a new PID and persisted completed/time without an Activity. The periodic 15-minute interval was inspected, not waited out; no real account was used.
- New Android specification/change strict validation and strict MkDocs build passed. Existing broader spec validation has 62 inherited failures under the current validator; Android changes add no failures.
- Battery savings are structural (hidden timers off, widget alarm off, network/battery constraints, deduplication). Device energy draw, authenticated provider traffic, manufacturer-specific scheduling, CPU time and peak memory were not measured.
- Repository packaging fix: native Android sources were hidden by the parent gen/ ignore. Keep Android source visible while excluding local build outputs and Tauri-generated assets.
