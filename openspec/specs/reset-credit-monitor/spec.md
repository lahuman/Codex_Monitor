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
