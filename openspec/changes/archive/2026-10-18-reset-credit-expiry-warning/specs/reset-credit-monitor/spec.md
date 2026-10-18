## ADDED Requirements

### Requirement: Reset voucher expiry warnings
The desktop dashboard SHALL display an account-scoped in-app warning for provider-available reset vouchers with a known future expiry less than seven days away, and SHALL emphasize deadlines at or below 24 hours as urgent. Individual voucher rows SHALL display the absolute expiry, remaining time and text labels distinguishing attention levels. The summary and rows SHALL use one projection of voucher/freshness facts. Warning counts SHALL refer only to confirmed qualifying vouchers and SHALL NOT alter the provider's available count or trigger redemption.

#### Scenario: Approaching expiry
- **WHEN** a fresh active account has available vouchers expiring in six days and six hours
- **THEN** its dashboard warning reports two approaching vouchers and identifies the nearest expiry as urgent, while each row retains its own expiry and remaining time.

#### Scenario: Invalid warning candidates
- **WHEN** the count is zero or unknown, details are missing/erroring, the observation is missing/future-dated/older than 120 seconds, the account is paused, or a voucher is redeemed/unknown/undated/already elapsed
- **THEN** those values SHALL NOT generate a current upcoming-expiry warning; known historical facts, missing information and refresh-needed labels remain explicit.

### Requirement: Live expiry and freshness classification
The visible dashboard SHALL advance its wall-clock-based remaining time and freshness classifications at the existing five-second UI interval and on focus, independently of whether local snapshot requests succeed. It SHALL NOT increase provider request frequency or create OS notifications for this feature.

#### Scenario: Snapshot failure during viewing
- **WHEN** local snapshot reads fail while time advances
- **THEN** the last observation becomes stale at its actual age and cannot retain a false fresh-expiry warning because a previous UI timestamp stopped advancing.
