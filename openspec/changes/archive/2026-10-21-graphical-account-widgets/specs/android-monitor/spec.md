## ADDED Requirements

### Requirement: Graphical configurable widgets
Each widget SHALL persist its own stable account selection or overview, ring/bar preference, system/light/dark theme and optional hidden names. Configuration and rendering SHALL use cached canonical quota only and SHALL NOT start provider collection. Overview SHALL show up to four accounts fitting the available size and disclose its visible/total count. Selected-account widgets SHALL NOT silently switch when that account disappears.

#### Scenario: Independent account widgets
- **WHEN** two widgets select different accounts or a selected account is removed
- **THEN** each retains its own selection and the removed selection displays an explicit unavailable state.

### Requirement: Honest cached graph rendering
Graphs SHALL preserve period labels, unknown versus zero, reset times and paused/error facts. A visible observation timestamp SHALL identify saved values. Rendering SHALL support resizes and light/dark themes with readable native text, bounded bitmaps and no additional recurring timers.

#### Scenario: Widget resized without collection
- **WHEN** the launcher resizes a cached widget
- **THEN** it adapts the visible rows and supporting details without provider requests or fabricated observations.

### Requirement: Widget configuration lifecycle
Picker configuration SHALL report canceled until saved. Pin requests SHALL persist selected settings only for the returned owned widget id. Deletion SHALL remove only that instance configuration; restore SHALL remap old widget ids to new ids. Existing unconfigured widgets SHALL default to overview.

#### Scenario: Cancel or restore configuration
- **WHEN** a user cancels configuration or Android restores widget ids
- **THEN** cancellation preserves previous settings and restore retains the matching instance settings.
