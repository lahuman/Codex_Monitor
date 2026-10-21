## ADDED Requirements

### Requirement: Inline horizontal widget quota
Horizontal quota displays SHALL place the period, a color-matched decorative marker, a bar at least 12dp thick, and the remaining percentage on one row with the number after the bar. Unknown and zero SHALL remain distinct. Overview capacity SHALL account for each account's period count and preserve observation timestamps. The card SHALL remain content-sized, and rendering SHALL NOT add provider requests.

#### Scenario: Narrow single-period overview
- **WHEN** two accounts with one period each are shown at 280×180 dp
- **THEN** both fit with the percentage after its bar on the same baseline and no additional value row.
