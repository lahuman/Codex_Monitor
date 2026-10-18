# reset-credit-monitor Specification

## Purpose
Provide account-scoped observation of banked rate-limit reset voucher counts and expiry dates while preserving unknowns and partial provider failures.

## Requirements

### Requirement: Read-only reset-credit observation
The desktop monitor SHALL fetch reset-credit details using an account-authenticated GET during manual and automatic usage observation. It SHALL preserve a known usage-summary count when the details request fails, distinguish unknown from zero, and expose detail errors independently of quota failures. It SHALL NOT redeem or consume reset credits.

#### Scenario: Partial provider failure
- **WHEN** quota observation provides a reset-credit count and the detail request fails
- **THEN** the known count and observation time remain visible while expiry details are marked unavailable and the detail error is exposed.

### Requirement: Account voucher counts and expiry dates
Each account card SHALL display the available reset-credit count and expiry dates for available credits, ordered earliest first with undated entries last. It SHALL distinguish absent dates from unlimited validity, preserve unknown statuses without counting them as available, and label stale or paused observations.

#### Scenario: Multiple vouchers
- **WHEN** available vouchers have different expiry dates
- **THEN** the card shows their available count and their individual expiry dates in chronological order using the local time zone.

#### Scenario: Unknown and zero
- **WHEN** no usable observation exists or the provider returns an available count of zero
- **THEN** the UI distinguishes an unconfirmed count from a confirmed zero and never invents an expiry date.

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


### Requirement: Collapsed nearest voucher details
Dashboard and compact voucher panels SHALL show the provider total count and one available voucher with the nearest known future expiry by default. Remaining future, elapsed and undated available records SHALL remain accessible through an explicitly labeled expand/collapse button with expanded state. When no future expiry is known, historical/unknown details SHALL stay explicit without inventing a deadline. Switching accounts in the compact panel SHALL reset expansion. Expiry warnings, authoritative counts and missing/inconsistent/error notices SHALL remain intact.

#### Scenario: Several available vouchers
- **WHEN** several vouchers include future, elapsed and unknown expiry dates
- **THEN** the default row is the nearest future expiry, the provider total remains unchanged, and expanding exposes every detail before collapsing back to one row.

#### Scenario: Account switch
- **WHEN** a user expands details then selects another account
- **THEN** that account starts with one nearest-expiry row and retains its own count and warnings.


### Requirement: Space-efficient compact voucher card
The menu popup SHALL initially display exactly one nearest-expiry voucher detail when details exist, with other details rendered only after an explicit full-list action. Its compact card SHALL place total count, a short accessible warning badge and expand/collapse action in the heading, with one compact expiry/countdown row and no duplicate warning paragraph above or inside the card. Absolute expiry and remaining time SHALL stay visible. Error, paused, stale, unknown and inconsistent-count information SHALL remain accessible. Desktop dashboard detail formatting SHALL remain unchanged.

#### Scenario: Default popup view
- **WHEN** an account has three dated vouchers and normal monitoring history
- **THEN** the popup shows one voucher row, unchanged provider total and a full-list button, with the recent usage table and 24-hour chart visible without vertical scrolling in a 380×640 viewport for a normal one- or two-window fixture.

#### Scenario: Expanded and constrained views
- **WHEN** the user explicitly expands vouchers or errors/viewport constraints require more space
- **THEN** all details remain reachable through scrolling without clipping; collapsing or selecting another account restores one row, and warnings keep accessible descriptions.
