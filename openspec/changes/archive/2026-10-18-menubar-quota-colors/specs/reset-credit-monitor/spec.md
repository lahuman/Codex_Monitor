## ADDED Requirements

### Requirement: Collapsed nearest voucher details
Dashboard and compact voucher panels SHALL show the provider total count and one available voucher with the nearest known future expiry by default. Remaining future, elapsed and undated available records SHALL remain accessible through an explicitly labeled expand/collapse button with expanded state. When no future expiry is known, historical/unknown details SHALL stay explicit without inventing a deadline. Switching accounts in the compact panel SHALL reset expansion. Expiry warnings, authoritative counts and missing/inconsistent/error notices SHALL remain intact.

#### Scenario: Several available vouchers
- **WHEN** several vouchers include future, elapsed and unknown expiry dates
- **THEN** the default row is the nearest future expiry, the provider total remains unchanged, and expanding exposes every detail before collapsing back to one row.

#### Scenario: Account switch
- **WHEN** a user expands details then selects another account
- **THEN** that account starts with one nearest-expiry row and retains its own count and warnings.

## MODIFIED Requirements

### Requirement: Menu bar voucher visibility and urgent labels
The compact menu-bar panel SHALL show the selected account's available reset-voucher count, expiry dates and remaining time using the existing detail presentation. Each native account nickname and the selected panel nickname SHALL appear red if at least one confirmed available voucher has a future expiry at or below 24 hours. Other account labels SHALL retain normal styling. Quota percentages SHALL follow the account-monitor quota percentage colors independently of voucher urgency. Native and panel label urgency SHALL consume the same Rust-derived account-scoped facts and preserve account-specific click behavior.

#### Scenario: One day or less remaining
- **WHEN** a fresh active account has an available voucher expiring in exactly 24 hours or less but still in the future
- **THEN** only that account's nickname becomes red, and its panel displays voucher count, expiry and countdown without opening the main dashboard or redeeming anything.

#### Scenario: Invalid or expired observations
- **WHEN** counts are zero/unknown, available details exceed the count, details have errors, the observation is missing/future-dated/older than 120 seconds, the account is paused, or all vouchers are unknown/redeemed/undated/elapsed
- **THEN** no current red-label warning is produced. Cached panel warnings SHALL stop at their observation-validity or voucher-expiry deadline even if IPC reads fail; existing unknown/history/error messages remain visible.

#### Scenario: Appearance changes
- **WHEN** an urgent account item is shown in a light or dark native menu-bar appearance
- **THEN** its nickname remains red and its larger quota row remains legible; normal accounts retain native foreground adaptation.


