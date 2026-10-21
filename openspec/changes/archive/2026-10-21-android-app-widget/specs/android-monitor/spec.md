## ADDED Requirements

### Requirement: Independent Android monitor
Android SHALL reuse the Rust account service and quota/history interpretation without a desktop server. It SHALL support device-code login via an external browser and app-private credential storage. Desktop-only tray, single-instance and window-close behavior SHALL NOT be installed on mobile. Android backup and cleartext transport SHALL be disabled.

#### Scenario: Phone-only account
- **WHEN** a user connects an account on the phone
- **THEN** the app queries its own account using the existing service and shows quota, reset vouchers and locally observed history without PC synchronization.

### Requirement: Honest home-screen widget
A native widget SHALL receive a bounded, token-free Rust summary of up to four accounts with quota, reset time, voucher count and observation time. It SHALL label cached/error/paused/unknown observations and open the app on tap. Rendering SHALL NOT query the provider or promise polling while Android suspends the app. Account removal SHALL clear cached summaries on the next publication.

#### Scenario: App stopped
- **WHEN** Android suspends or stops the app
- **THEN** the widget retains the last observation timestamp and clearly indicates the need to open the app to refresh; it does not invent new usage.

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
