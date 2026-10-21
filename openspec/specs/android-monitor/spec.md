# android-monitor Specification

## Purpose
Provide an independent phone monitor and cached widget with user-controlled collection.

## Requirements

### Requirement: Independent Android monitor
Android SHALL reuse the Rust account service and quota/history interpretation without a desktop server. It SHALL support device-code login via an external browser and app-private credential storage. Desktop-only tray, single-instance and window-close behavior SHALL NOT be installed on mobile. Android backup and cleartext transport SHALL be disabled.

#### Scenario: Phone-only account
- **WHEN** a user connects an account on the phone
- **THEN** the app queries its own account using the existing service and shows quota, reset vouchers and locally observed history without PC synchronization.

### Requirement: Honest home-screen widget
A native widget SHALL receive a bounded, token-free Rust catalogue of up to 100 accounts, including stable internal selection identifiers with quota, reset time, voucher count and observation time. It SHALL label cached/error/paused/unknown observations and open the app on tap. Rendering SHALL NOT query the provider. Account removal SHALL clear cached summaries on the next publication.

#### Scenario: App stopped
- **WHEN** Android suspends or stops the app
- **THEN** the widget retains the last observation timestamp and labels cached observations until a permitted worker or manual collection publishes new data; it does not invent new usage.

### Requirement: Verifiable APK delivery
An APK SHALL have a verifiable signature, architecture/version metadata and SHA-256 manifest. Preview signing SHALL be labeled and SHALL NOT be confused with a stable update-signing identity.

#### Scenario: Install preview APK
- **WHEN** the Android package is produced
- **THEN** its package identity, launcher and widget receiver are verified from the packaged manifest and its signature is verified before delivery.

### Requirement: User-controlled collection cadence
Android SHALL persist a choice of disabled or 1,5,10,30,60,100 minutes, defaulting to 10 minutes. Disabled SHALL prevent automatic usage/voucher collection, including on launch. A visible manual collection button SHALL remain available with automatic collection disabled. Failed automatic attempts SHALL obey the selected minimum interval as well as successful observations. UI countdown and widget rendering SHALL NOT make provider requests.

#### Scenario: Manual-only phone
- **WHEN** the user selects automatic collection disabled and relaunches
- **THEN** no periodic usage request is issued and the explicit manual collection button can collect usage for active accounts.


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


### Requirement: Resumable external-browser login
Device authentication SHALL persist its pending flow and exchange progress in the existing encrypted app vault until expiry, cancellation or successful account storage. Reopening the app SHALL restore a valid pending login. Foreground return SHALL trigger an immediate status check subject to the provider interval. Transient transport failures SHALL preserve the login and display retry status. A manual check SHALL be available without creating a new code. Hidden UI polling SHALL pause.

#### Scenario: Browser succeeds after process reclamation
- **WHEN** browser authentication completes after Android reclaims the app process
- **THEN** reopening restores the same unexpired flow and can complete account storage without starting a new device login.

#### Scenario: Temporary network failure
- **WHEN** a status check fails temporarily
- **THEN** the existing code remains visible and a later automatic or manual check can finish the connection.


### Requirement: Compact mobile dashboard
Android SHALL present an account-card dashboard with identity, plan, state, period-specific remaining bars and reset times visible without expanding details. Collection settings SHALL be accessible through a menu. Per-account voucher details, observed history and alert settings SHALL remain accessible on demand. Unknown values SHALL remain unknown and stale/error observations SHALL be labeled. Mobile presentation SHALL NOT reinterpret provider quota or add desktop behavior changes.

#### Scenario: Scan accounts on a narrow screen
- **WHEN** the Android dashboard renders on a 360 CSS pixel screen
- **THEN** account identity and paired quota windows fit without horizontal scrolling, controls have at least 44 CSS pixel touch targets and details start collapsed.


### Requirement: Graphical configurable widgets
Each widget SHALL persist its own stable account selection or overview, ring/bar preference, system/light/dark theme and optional hidden names. Configuration and rendering SHALL use cached canonical quota only and SHALL NOT start provider collection. Overview SHALL show up to four accounts fitting the available size and disclose its visible/total count. Selected-account widgets SHALL NOT silently switch when that account disappears.

#### Scenario: Independent account widgets
- **WHEN** two widgets select different accounts or a selected account is removed
- **THEN** each retains its own selection and the removed selection displays an explicit unavailable state.

### Requirement: Honest cached graph rendering
Graphs SHALL preserve period labels, unknown versus zero, reset times and paused/error facts. A visible observation timestamp SHALL identify saved values. Rendering SHALL support resizes and light/dark themes with readable native text, bounded bitmaps and no additional recurring timers.

#### Scenario: Widget resized without collection
- **WHEN** the launcher resizes a cached widget
- **THEN** it adapts the visible rows and supporting details without provider requests or fabricated observations.

### Requirement: Widget configuration lifecycle
Picker configuration SHALL report canceled until saved. Pin requests SHALL persist selected settings only for the returned owned widget id. Deletion SHALL remove only that instance configuration; restore SHALL remap old widget ids to new ids. Existing unconfigured widgets SHALL default to overview.

#### Scenario: Cancel or restore configuration
- **WHEN** a user cancels configuration or Android restores widget ids
- **THEN** cancellation preserves previous settings and restore retains the matching instance settings.


### Requirement: Content-sized compact widget
The visible widget card SHALL size to its content at the top of its launcher allocation without distributing unused height between header, account rows and footer. The launcher default SHALL request four columns and two rows. Two one-window accounts SHALL fit within a 280×180 dp widget at normal font scale, retaining names, quota labels, percentages, bars and observation timestamps. Rendering SHALL NOT add collection or change per-widget settings.

#### Scenario: Two accounts in an oversized allocation
- **WHEN** an overview with two one-window accounts is rendered at 280×180 or 280×320 dp
- **THEN** both are shown with the same compact card height and no centered blank bands.


### Requirement: Inline horizontal widget quota
Horizontal quota displays SHALL place the period, a color-matched decorative marker, a bar at least 12dp thick, and the remaining percentage on one row with the number after the bar. Unknown and zero SHALL remain distinct. Overview capacity SHALL account for each account's period count and preserve observation timestamps. The card SHALL remain content-sized, and rendering SHALL NOT add provider requests.

#### Scenario: Narrow single-period overview
- **WHEN** two accounts with one period each are shown at 280×180 dp
- **THEN** both fit with the percentage after its bar on the same baseline and no additional value row.


### Requirement: Widget update and period reset times
The widget SHALL show one update timestamp in its upper-right header, derived from the latest non-future observation among displayed accounts. Missing and future-only observations SHALL be explicit. Older displayed observations SHALL retain a mixed-age badge. Each quota period SHALL display its own canonical reset date/time, including compact layouts; absent reset times SHALL remain unknown. Rendering and configuration SHALL NOT collect data.

#### Scenario: Mixed account observations
- **WHEN** displayed account observations differ by more than 120 seconds
- **THEN** the header shows the most recent valid observation once and older accounts show an earlier-observation badge without repeating timestamps.

#### Scenario: Independent quota reset times
- **WHEN** five-hour and weekly quotas have different reset times
- **THEN** each graph displays its matching date/time, without conflating voucher expiry or widget render time.


### Requirement: Readable responsive widget reset times
Horizontal quota reset timestamps SHALL use the full row width below their graphs. Ring timestamps SHALL wrap without ellipsis. Native layout measurement at the current density and font scale SHALL determine overview capacity. If one complete account cannot fit, the widget SHALL explicitly request a larger allocation instead of clipping reset information. Rendering SHALL remain cached and timer-free.

#### Scenario: Large phone text
- **WHEN** a widget renders at 180, 280 or 360 dp width with font scale 1.0, 1.3 or 1.5 and sufficient height
- **THEN** every displayed period's reset date and time are readable in full, with no ellipsis or clipping, and the update timestamp appears once in the upper-right header.

#### Scenario: Insufficient allocation
- **WHEN** the widget allocation cannot fit a complete account at the selected font scale
- **THEN** an explicit resize instruction replaces clipped quota rows, and opening the app remains available.
