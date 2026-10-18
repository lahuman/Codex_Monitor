## ADDED Requirements

### Requirement: Quota percentage colors
macOS menu-bar percentages SHALL independently use green for remaining quota at or above 50%, yellow at or above 25%, orange at or above 10%, and red below 10%. Classification SHALL use the unrounded finite numeric observation within 0–100, never display-string parsing or averaging windows. Missing/invalid values, separators and status indicators SHALL retain neutral appearance. Account click identity, sharp native text, warning markers and independently red urgent nicknames SHALL remain intact in light and dark appearances.

#### Scenario: Independent quota windows
- **WHEN** an account has remaining windows of 69% and 8%
- **THEN** its lower row shows a green 69% and red 8% separated by a neutral slash, and only voucher urgency determines its nickname warning color.

#### Scenario: Boundaries and unknowns
- **WHEN** remaining quota is exactly 50%, 25%, 10%, 0%, missing or invalid
- **THEN** it is classified green, yellow, orange, red or neutral respectively, without changing the observed quota or removing stale/error/paused indicators.
