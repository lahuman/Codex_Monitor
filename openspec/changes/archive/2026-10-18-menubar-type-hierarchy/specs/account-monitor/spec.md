## ADDED Requirements

### Requirement: Readable menu bar typography
Each macOS account item SHALL render its nickname on a smaller regular upper row and quota percentages on a larger bold lower row, without a decorative token prefix before the percentage. Meaningful unknown, paused, stale and error state indicators SHALL remain distinct. Font styling SHALL be applied at the native rendering owner, retaining independently clickable account items and automatic foreground appearance adaptation.

#### Scenario: Two-row quota item
- **WHEN** an account has remaining quota values of 49% and 72%
- **THEN** its compact nickname appears above larger bold 49%/72% values without a leading decorative icon, and the entire item retains its account-specific click target.
