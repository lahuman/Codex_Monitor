## ADDED Requirements

### Requirement: Consistent readable application surfaces
Dashboard, account management, quick view and dialogs SHALL share readable typography, quota color tokens and clear action hierarchy. Core controls SHALL have visible keyboard focus. On phone layouts, buttons and fields SHALL have 44 CSS pixel touch height, dialogs SHALL remain reachable on short screens, and account identities SHALL wrap without page overflow.

#### Scenario: Manage an account on a phone
- **WHEN** account management or login opens at 360 CSS pixels wide
- **THEN** identity, quota and all actions remain readable and reachable without horizontal scrolling.

#### Scenario: Compare quotas between screens
- **WHEN** quota is shown on dashboard, account management or quick view
- **THEN** fresh values use the same green/yellow/orange/red thresholds, while stale/paused/error values remain labeled and muted and unknown values stay unknown.
