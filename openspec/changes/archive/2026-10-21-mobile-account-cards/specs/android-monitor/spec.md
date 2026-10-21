## ADDED Requirements

### Requirement: Compact mobile dashboard
Android SHALL present an account-card dashboard with identity, plan, state, period-specific remaining bars and reset times visible without expanding details. Collection settings SHALL be accessible through a menu. Per-account voucher details, observed history and alert settings SHALL remain accessible on demand. Unknown values SHALL remain unknown and stale/error observations SHALL be labeled. Mobile presentation SHALL NOT reinterpret provider quota or add desktop behavior changes.

#### Scenario: Scan accounts on a narrow screen
- **WHEN** the Android dashboard renders on a 360 CSS pixel screen
- **THEN** account identity and paired quota windows fit without horizontal scrolling, controls have at least 44 CSS pixel touch targets and details start collapsed.
