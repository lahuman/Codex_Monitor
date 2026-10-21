# Battery-aware Android background collection

## Why
The first Android widget retained observations but the Activity-owned collector could not cold-start after Android reclaimed the process. Users requested persistent collection with battery-efficient execution.

## What Changes
Use constrained unique periodic WorkManager jobs and a generated UniFFI boundary into the existing Rust monitor. Share a single process-owned account service/history/gate with the UI, pause foreground timers when hidden, persist automatic attempt times and deduplicate wakeups. Preserve disabled/manual semantics and display the Android 15-minute background minimum. Produce a new signed preview APK.

## Scope
No foreground service, exact alarms, battery-optimization exemptions, duplicate credentials/provider implementation or promises after force-stop. Phone download remains pending network/hosting choice from the interrupted transfer request.
