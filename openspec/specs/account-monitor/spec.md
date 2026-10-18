# account-monitor Specification

## Purpose
Keep account quota observations and provider-read failures consistent between the desktop dashboard and macOS menu bar through one Rust monitoring owner, while preserving encrypted account storage and excluding relay execution from the default app.

## Requirements

### Requirement: Shared quota monitoring ownership
The desktop SHALL use one Rust owner for automatic quota scheduling, serialized manual refresh and failure state. The menu bar and dashboard SHALL read that same state. Automatic reads SHALL skip paused accounts and respect at least sixty seconds between attempts for each account. Legacy relay code SHALL be excluded from the desktop build without changing encrypted account storage.

#### Scenario: Manual and automatic refresh
- **WHEN** manual and automatic reads target an account
- **THEN** reads are serialized and the latest result is shared by both views.

#### Scenario: Failed refresh
- **WHEN** a provider read fails
- **THEN** the last observation remains available with the same failure in the menu and window until a successful read.

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

### Requirement: Readable menu bar typography
Each macOS account item SHALL render its nickname on a smaller regular upper row and quota percentages on a larger medium-weight lower row, without a decorative token prefix before the percentage. Native drawing SHALL use the final logical size without resizing a pre-rasterized text image, retaining sharp glyphs at standard and Retina backing scales. Meaningful unknown, paused, stale and error state indicators SHALL remain distinct. Font styling SHALL be applied at the native rendering owner, retaining independently clickable account items, normal foreground adaptation and red urgent nicknames.

#### Scenario: Two-row quota item
- **WHEN** an account has remaining quota values of 49% and 72%
- **THEN** its compact nickname appears above larger medium-weight 49%/72% values without a leading decorative icon, and the entire item retains its account-specific click target.

#### Scenario: Native backing scale
- **WHEN** an item draws at standard or Retina scale in a light or dark appearance
- **THEN** text draws directly at that backing scale in its final 22-point canvas, with only urgent nicknames colored red and no scaled bitmap text.


### Requirement: Quota percentage colors
macOS menu-bar percentages SHALL independently use green for remaining quota at or above 50%, yellow at or above 25%, orange at or above 10%, and red below 10%. Classification SHALL use the unrounded finite numeric observation within 0–100, never display-string parsing or averaging windows. Missing/invalid values, separators and status indicators SHALL retain neutral appearance. Account click identity, sharp native text, warning markers and independently red urgent nicknames SHALL remain intact in light and dark appearances.

#### Scenario: Independent quota windows
- **WHEN** an account has remaining windows of 69% and 8%
- **THEN** its lower row shows a green 69% and red 8% separated by a neutral slash, and only voucher urgency determines its nickname warning color.

#### Scenario: Boundaries and unknowns
- **WHEN** remaining quota is exactly 50%, 25%, 10%, 0%, missing or invalid
- **THEN** it is classified green, yellow, orange, red or neutral respectively, without changing the observed quota or removing stale/error/paused indicators.
