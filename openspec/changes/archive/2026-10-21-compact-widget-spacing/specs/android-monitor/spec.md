## ADDED Requirements

### Requirement: Content-sized compact widget
The visible widget card SHALL size to its content at the top of its launcher allocation without distributing unused height between header, account rows and footer. The launcher default SHALL request four columns and two rows. Two one-window accounts SHALL fit within a 280×180 dp widget at normal font scale, retaining names, quota labels, percentages, bars and observation timestamps. Rendering SHALL NOT add collection or change per-widget settings.

#### Scenario: Two accounts in an oversized allocation
- **WHEN** an overview with two one-window accounts is rendered at 280×180 or 280×320 dp
- **THEN** both are shown with the same compact card height and no centered blank bands.
