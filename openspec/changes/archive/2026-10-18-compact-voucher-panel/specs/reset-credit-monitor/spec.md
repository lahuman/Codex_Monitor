## ADDED Requirements

### Requirement: Space-efficient compact voucher card
The menu popup SHALL initially display exactly one nearest-expiry voucher detail when details exist, with other details rendered only after an explicit full-list action. Its compact card SHALL place total count, a short accessible warning badge and expand/collapse action in the heading, with one compact expiry/countdown row and no duplicate warning paragraph above or inside the card. Absolute expiry and remaining time SHALL stay visible. Error, paused, stale, unknown and inconsistent-count information SHALL remain accessible. Desktop dashboard detail formatting SHALL remain unchanged.

#### Scenario: Default popup view
- **WHEN** an account has three dated vouchers and normal monitoring history
- **THEN** the popup shows one voucher row, unchanged provider total and a full-list button, with the recent usage table and 24-hour chart visible without vertical scrolling in a 380×640 viewport for a normal one- or two-window fixture.

#### Scenario: Expanded and constrained views
- **WHEN** the user explicitly expands vouchers or errors/viewport constraints require more space
- **THEN** all details remain reachable through scrolling without clipping; collapsing or selecting another account restores one row, and warnings keep accessible descriptions.
