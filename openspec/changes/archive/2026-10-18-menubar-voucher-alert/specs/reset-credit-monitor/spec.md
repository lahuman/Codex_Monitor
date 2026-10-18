## ADDED Requirements

### Requirement: Menu bar voucher visibility and urgent labels
The compact menu-bar panel SHALL show the selected account's available reset-voucher count, expiry dates and remaining time using the existing detail presentation. Each native account nickname and the selected panel nickname SHALL appear red if at least one confirmed available voucher has a future expiry at or below 24 hours. Other account labels and quota percentages SHALL retain normal styling. Native and panel label urgency SHALL consume the same Rust-derived account-scoped facts and preserve account-specific click behavior.

#### Scenario: One day or less remaining
- **WHEN** a fresh active account has an available voucher expiring in exactly 24 hours or less but still in the future
- **THEN** only that account's nickname becomes red, and its panel displays voucher count, expiry and countdown without opening the main dashboard or redeeming anything.

#### Scenario: Invalid or expired observations
- **WHEN** counts are zero/unknown, available details exceed the count, details have errors, the observation is missing/future-dated/older than 120 seconds, the account is paused, or all vouchers are unknown/redeemed/undated/elapsed
- **THEN** no current red-label warning is produced. Cached panel warnings SHALL stop at their observation-validity or voucher-expiry deadline even if IPC reads fail; existing unknown/history/error messages remain visible.

#### Scenario: Appearance changes
- **WHEN** an urgent account item is shown in a light or dark native menu-bar appearance
- **THEN** its nickname remains red and its larger quota row remains legible; normal accounts retain native foreground adaptation.
