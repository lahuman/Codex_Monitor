## ADDED Requirements

### Requirement: Compact menu bar account presentation
macOS SHALL show up to four independently clickable account items with an account nickname on the upper row and remaining quota on the lower row, retaining overflow, unknown, stale, paused and error indicators. Missing nicknames SHALL fall back to the first three Unicode grapheme clusters of the email or account ID. Account settings SHALL persist, edit and clear nicknames through the monitoring preference owner without changing account identity or existing histories. Existing preference files without nicknames SHALL remain readable.

#### Scenario: Nickname fallback and persistence
- **WHEN** a user saves or clears an account nickname and restarts
- **THEN** the stored nickname or three-grapheme default is used consistently by menu bar and panel while account identity and history remain unchanged.

### Requirement: Anchored monitoring panel
On macOS, left clicking the menu bar SHALL toggle a compact monitoring panel adjacent to the clicked item within the monitor work area, without showing the main dashboard. The panel SHALL support account selection, close on Escape or focus loss, and offer an explicit dashboard action. Right clicking SHALL retain native dashboard and quit controls. Panel reads SHALL share existing observations and SHALL NOT increase provider polling.

#### Scenario: Independently selected account
- **WHEN** the user clicks a displayed account item
- **THEN** the panel selects that account by immutable account ID; clicking another displayed account switches and reanchors the panel, while clicking the same account closes it. Removing/reordering/renaming accounts SHALL NOT leave another account bound to an old item, and overflow accounts remain selectable through the panel.

#### Scenario: Dashboard hidden
- **WHEN** the main dashboard is hidden and the user clicks the menu bar
- **THEN** the compact panel shows current shared observations and history, while the main window remains hidden.

### Requirement: Panel history and scheduled resets
The panel SHALL display a 24-hour remaining-quota observation chart and each quota window's reset timestamp and live countdown. It SHALL show observed quota decreases over 1, 3 and 6 hours in percentage points, only for fresh, active, error-free accounts with sufficient interval coverage. Gaps over fifteen minutes, unknown values, reset identity/duration changes or any intervening increase SHALL prevent an interval total. Missing or elapsed reset timestamps SHALL remain explicit and SHALL NOT predict a new quota balance. Histories shorter than 24 hours SHALL NOT imply full-day coverage or token counts.

#### Scenario: Reset or insufficient history
- **WHEN** a selected interval crosses a reset, quota increase, missing values or insufficient observations
- **THEN** the corresponding interval is unavailable with a reason, while known timestamps and separate chart segments remain visible.
