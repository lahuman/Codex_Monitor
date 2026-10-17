# account-monitor Specification

## Purpose
Keep account quota observations and provider-read failures consistent between the desktop dashboard and macOS menu bar through one Rust monitoring owner, while preserving encrypted account storage and excluding relay execution from the default app.

## Requirements

### Requirement: Shared quota monitoring ownership
The desktop SHALL use one Rust owner for automatic quota scheduling, serialized manual refresh and failure state. The menu bar and dashboard SHALL read that same state. Automatic reads SHALL skip paused accounts and respect at least sixty seconds between attempts for each account. Legacy relay code SHALL be excluded from the desktop build without changing encrypted account storage.

#### Scenario: Manual and automatic refresh
- **WHEN** manual and automatic reads target an account
- **THEN** reads are serialized and the latest result is shared by both views.

#### Scenario: Failed refresh
- **WHEN** a provider read fails
- **THEN** the last observation remains available with the same failure in the menu and window until a successful read.
