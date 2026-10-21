# ADDED Requirements

### Requirement: Readable responsive widget reset times
Horizontal quota reset timestamps SHALL use the full row width below their graphs. Ring timestamps SHALL wrap without ellipsis. Native layout measurement at the current density and font scale SHALL determine overview capacity. If one complete account cannot fit, the widget SHALL explicitly request a larger allocation instead of clipping reset information. Rendering SHALL remain cached and timer-free.

#### Scenario: Large phone text
- **WHEN** a widget renders at 180, 280 or 360 dp width with font scale 1.0, 1.3 or 1.5 and sufficient height
- **THEN** every displayed period's reset date and time are readable in full, with no ellipsis or clipping, and the update timestamp appears once in the upper-right header.

#### Scenario: Insufficient allocation
- **WHEN** the widget allocation cannot fit a complete account at the selected font scale
- **THEN** an explicit resize instruction replaces clipped quota rows, and opening the app remains available.
