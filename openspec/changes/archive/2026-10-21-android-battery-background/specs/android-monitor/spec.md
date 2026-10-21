## ADDED Requirements

### Requirement: Battery-aware persistent collection
Android SHALL schedule one uniquely named periodic WorkManager job requiring network connectivity and battery-not-low. Background cadence SHALL be max(15, selected minutes), or absent when disabled or no active accounts. Work SHALL survive ordinary process reclamation and be restored by WorkManager after restart, without claiming execution during force-stop or exact timing under Doze.

#### Scenario: Process reclaimed
- **WHEN** Android reclaims the app process with automatic collection enabled
- **THEN** an eligible system job cold-starts collection and updates the widget without opening an Activity.

### Requirement: Shared Rust collection ownership
Foreground and background collection SHALL share one process-owned Rust service, monitor/history and request gate for the canonical app-data directory. Background work SHALL use generated bindings and SHALL NOT create a second token store or provider implementation. Automatic attempt timestamps SHALL survive process death to prevent early retries. Hidden UI timers SHALL be suspended.

#### Scenario: Overlapping UI and worker
- **WHEN** UI collection and a system job overlap or a failed request is followed by process restart
- **THEN** the common gate and persisted attempt time prevent duplicate automatic provider calls before the applicable interval.

### Requirement: Disabled and observable background behavior
Choosing disabled SHALL cancel periodic work and prevent new automatic requests. Widgets SHALL render cached data without their own periodic alarm. The app SHALL show selected foreground cadence, effective background cadence and last worker result/time. Explicit manual collection SHALL remain available regardless of automatic scheduling.

#### Scenario: Manual-only phone
- **WHEN** collection is disabled and the app restarts
- **THEN** no periodic job is scheduled and a manual request remains possible.

## MODIFIED Requirements

### Requirement: Honest home-screen widget
A native widget SHALL receive a bounded, token-free Rust summary of up to four accounts with quota, reset time, voucher count and observation time. It SHALL label cached/error/paused/unknown observations and open the app on tap. Rendering SHALL NOT query the provider. Background collection SHALL be independently scheduled and SHALL NOT promise exact execution while Android suspends the app. Account removal SHALL clear cached summaries on the next publication.

#### Scenario: App stopped
- **WHEN** Android suspends or stops the app
- **THEN** the widget retains the last observation timestamp and labels cached observations until a permitted worker or manual collection publishes new data; it does not invent new usage.

