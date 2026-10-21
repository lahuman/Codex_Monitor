## ADDED Requirements

### Requirement: Widget update and period reset times
The widget SHALL show one update timestamp in its upper-right header, derived from the latest non-future observation among displayed accounts. Missing and future-only observations SHALL be explicit. Older displayed observations SHALL retain a mixed-age badge. Each quota period SHALL display its own canonical reset date/time, including compact layouts; absent reset times SHALL remain unknown. Rendering and configuration SHALL NOT collect data.

#### Scenario: Mixed account observations
- **WHEN** displayed account observations differ by more than 120 seconds
- **THEN** the header shows the most recent valid observation once and older accounts show an earlier-observation badge without repeating timestamps.

#### Scenario: Independent quota reset times
- **WHEN** five-hour and weekly quotas have different reset times
- **THEN** each graph displays its matching date/time, without conflating voucher expiry or widget render time.
