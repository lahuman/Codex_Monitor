## ADDED Requirements

### Requirement: Resumable external-browser login
Device authentication SHALL persist its pending flow and exchange progress in the existing encrypted app vault until expiry, cancellation or successful account storage. Reopening the app SHALL restore a valid pending login. Foreground return SHALL trigger an immediate status check subject to the provider interval. Transient transport failures SHALL preserve the login and display retry status. A manual check SHALL be available without creating a new code. Hidden UI polling SHALL pause.

#### Scenario: Browser succeeds after process reclamation
- **WHEN** browser authentication completes after Android reclaims the app process
- **THEN** reopening restores the same unexpired flow and can complete account storage without starting a new device login.

#### Scenario: Temporary network failure
- **WHEN** a status check fails temporarily
- **THEN** the existing code remains visible and a later automatic or manual check can finish the connection.
