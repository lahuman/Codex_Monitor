## ADDED Requirements

### Requirement: Rust-only production backend

The final desktop artifact SHALL execute all backend services in Rust and SHALL
NOT bundle or start a Python interpreter or Python server. The upstream Python
implementation MAY be used as a development reference and test oracle only.

#### Scenario: Production runtime dependency audit

- **WHEN** the final application is installed and launched without Python
- **THEN** all migrated application features operate without invoking Python

### Requirement: Pinned full compatibility baseline

The desktop edition SHALL pin upstream repository identity and commit and SHALL
retain an inventory of the original specifications, source route declarations,
router registrations, settings, migrations, frontend files and verification
assets. Static declarations SHALL NOT be described as runtime route coverage.
Unresolved source expressions SHALL be recorded explicitly.

#### Scenario: Repeatable source inventory

- **WHEN** the baseline generator runs twice against the pinned Git commit
- **THEN** it emits identical inventory bytes independent of working-tree edits

### Requirement: Full upstream behavior remains in scope

All upstream user-visible capabilities SHALL remain in scope, including HTTP,
SSE and WebSocket proxying, model sources, account pooling and affinity,
OAuth and token refresh, API keys and limits, dashboard identity and roles,
OIDC and SCIM, reports and usage, file/image/audio operations, background jobs,
firewall, audit, telemetry preferences, SQLite and PostgreSQL, bridge
coordination, configuration and data migration.

#### Scenario: Incomplete port

- **WHEN** any baseline capability lacks implementation or verification
- **THEN** the edition is marked incomplete and SHALL NOT be released as fully compatible

### Requirement: Desktop lifecycle owns its resources

The desktop host SHALL start its internal Rust services automatically on launch.
It SHALL expose show-window and quit actions from its tray, without separate
server start/stop controls or a port input in the normal application workflow.
Closing the window SHALL keep a running service available
in the tray. Quit SHALL drain owned work and release listeners. A port conflict
SHALL be shown as a startup failure without attaching to or stopping an
unverified external process.

#### Scenario: Launch requires no server operation

- **WHEN** the user launches the desktop app
- **THEN** the internal service starts without clicking a server control
- **AND** startup failure remains visible even if it occurs before the UI loads

#### Scenario: Reopen a running app

- **WHEN** the user launches a second instance
- **THEN** the existing window is shown without starting a second listener

#### Scenario: Existing listener

- **GIVEN** another process owns the configured service port
- **WHEN** the desktop service starts
- **THEN** it reports the conflict without terminating the other process

### Requirement: Behavioral parity is measured

The project SHALL compare the candidate to the pinned reference with isolated
data and deterministic upstream fixtures. Assertions SHALL cover status,
headers, body schemas, stream ordering, cancellation, failover, authentication,
authorization, persistence and restart. Existing React flows SHALL be checked
against the candidate. Real-provider verification SHALL be reported separately.

#### Scenario: Shared incorrect result

- **WHEN** a differential fixture compares two responses
- **THEN** the expected protocol contract is checked in addition to equality

### Requirement: Existing data is preserved

Migration SHALL use explicit input selection and backups, preserve encryption
and schema compatibility, and fail before writes when compatibility is unknown.
Development tests SHALL use disposable data rather than ambient user accounts.

#### Scenario: Unsupported database revision

- **WHEN** the selected database revision is not supported
- **THEN** migration reports the revision and leaves the input unchanged

### Requirement: Desktop account and Responses workflow
The desktop MUST support explicit Codex auth JSON import and device authorization, persist credentials encrypted in its own application directory, and expose only account summaries through normal UI reads. It MUST serialize token rotation, retain rotated tokens when persistence fails, and prohibit request dispatch until credentials are durable. Imported JWT claims are display/routing metadata, not verified authentication.

#### Scenario: Connect and restart
- **WHEN** an operator imports valid credential fields or completes device authorization
- **THEN** the account is available after restart without storing plaintext credentials, and can be paused or removed in the app.

### Requirement: Desktop usage and HTTP proxy
The desktop MUST fetch upstream quota snapshots on explicit refresh and show their observation time. It MUST proxy Responses HTTP/SSE and compact through a selected account, require a generated local bearer key, preserve terminal usage, and record failures and cancellation without recording prompts or credentials. Unknown usage MUST remain unknown.

#### Scenario: Streaming response and usage
- **WHEN** an authenticated client submits a supported Responses request
- **THEN** the app forwards it with the selected account credentials, streams the response, and persists the terminal token counts and outcome.

#### Scenario: Unauthenticated or interrupted request
- **WHEN** authorization is missing or the downstream disconnects
- **THEN** unauthorized requests never reach upstream and interrupted streams release their owned upstream request and are recorded as cancelled or incomplete.

### Requirement: Bounded desktop dispatch
The desktop MUST NOT retry a dispatched generation on another account. Stateful continuation requests MUST require an explicit account pin until automatic affinity is implemented. Resource limits MUST bound concurrent requests, body sizes and retained history.

#### Scenario: Unpinned continuation
- **WHEN** a client sends a stateful continuation without an account pin
- **THEN** the app rejects it before upstream dispatch.

#### Scenario: Resource capacity
- **WHEN** concurrent requests, body size or retained history reaches the defined limit
- **THEN** the app enforces the limit without unbounded allocation or retaining unbounded records.

### Requirement: Browser-independent device login
The desktop MUST display the provider verification URL, device code and expiration, with copy controls, before any external browser is opened. Opening the default browser MUST be optional and MUST NOT cancel the device flow on failure. The operator MUST be able to paste the URL into any browser and finish the same pending device flow.

#### Scenario: Use a selected browser
- **WHEN** the operator starts account login
- **THEN** the app shows the URL and code, polls for completion, and opens an external browser only when explicitly requested.

#### Scenario: Default browser fails to open
- **WHEN** the optional browser action fails
- **THEN** the existing code and URL remain usable until cancellation or expiration.

### Requirement: Embedded original dashboard components
The app MUST render a locally bundled dashboard using the upstream React dashboard presentation components, including statistics, account quota cards, donut charts and request history. Data MUST come from the desktop Rust service through local IPC. The desktop MUST retain account import/device login, optional external browser opening, usage refresh and proxy connection settings. It MUST NOT load a hosted documentation page as the dashboard or fabricate unknown costs, quota or usage.

#### Scenario: Observe relayed requests
- **WHEN** a request is relayed by the Rust service
- **THEN** the embedded dashboard displays its actual outcome and reported usage on the next refresh, with functional filtering and pagination.

#### Scenario: No account or quota observations
- **WHEN** accounts or provider quota observations are absent
- **THEN** the app presents the corresponding empty or unknown state, offers account connection, and does not report zero available quota as an observation.

### Requirement: Unscaled account quota display
The desktop MUST display each account's observed remaining percentage without dividing it by account count. Each quota chart MUST identify its account, period and observation time. Unknown observations MUST remain unknown.

#### Scenario: Multiple accounts
- **WHEN** two accounts have 49% and 16% remaining
- **THEN** their quota charts show 49% and 16%, respectively, rather than their contribution to an average.

#### Scenario: Refresh provider quota
- **WHEN** the operator refreshes quota
- **THEN** successful observations replace the displayed percentages and observation times, and failures remain visible.

### Requirement: Dashboard-focused desktop navigation
The desktop MUST expose dashboard and account management navigation without a connection settings screen or local key disclosure IPC. Removing connection settings MUST preserve automatic Rust proxy operation and account login.

#### Scenario: Simplified navigation
- **WHEN** the user opens the app or an obsolete connection route
- **THEN** dashboard and account management remain available, and connection settings are not displayed.

### Requirement: Quota monitoring dashboard
The dashboard MUST omit connection actions and setup details. It MUST show quota health, reset times, observation freshness and refresh failures. While visible it MUST refresh active accounts whose observations are at least sixty seconds old, with serialized bounded requests and at least sixty seconds between automatic attempts per account. Failed reads MUST preserve prior observations and remain visible until a successful read.

#### Scenario: Stale quota
- **WHEN** a visible dashboard observes an active account with missing or old quota
- **THEN** it attempts a new provider read, displays failures, and marks observations older than two minutes as stale.

#### Scenario: Low remaining quota
- **WHEN** any observed quota window has twenty percent or less remaining
- **THEN** the dashboard identifies the account and the low remaining quota.

### Requirement: macOS menu bar quota monitoring
The desktop MUST show per-account remaining quota in the macOS menu bar and detailed usage, observation time and freshness in its menu. Unknown quota MUST remain unknown and multiple accounts MUST NOT be averaged. The title MUST remain bounded; the menu MUST retain every account. While the window is hidden, a single owned monitor MUST refresh stale active accounts no more than once per minute per account. Closing the window MUST preserve monitoring; quitting MUST stop it.

#### Scenario: Two accounts
- **WHEN** accounts have 49% and 14% remaining
- **THEN** the menu bar identifies both percentages separately, with full account labels in its menu.

#### Scenario: Missing or old observation
- **WHEN** quota is unavailable, old or refresh fails
- **THEN** the menu reports the unknown/stale/failure state and preserves the prior observation.

### Requirement: Color-coded menu bar identities
The menu bar MUST use a token icon instead of the remaining-text prefix and colored circles instead of account numbers. The detailed menu MUST repeat each circle beside its account name so the user can identify the account.

#### Scenario: Two accounts
- **WHEN** two accounts have 49% and 14% remaining
- **THEN** the title shows a token icon with blue-circle 49% and green-circle 14%, and the menu associates those circles with their account names.

### Requirement: Monitoring-only desktop application
The current desktop MUST only monitor provider account quota and manage those accounts. It MUST NOT start an HTTP relay listener or expose relay lifecycle IPC. It MUST NOT display request/token/cost/error-rate cards, request history or relay setup headers. These monitoring-only requirements supersede previous desktop relay integration requirements; original upstream library code and stored user data remain preserved.

#### Scenario: App launch
- **WHEN** the desktop launches
- **THEN** it opens its account storage and quota monitor without binding a proxy port.

#### Scenario: Dashboard
- **WHEN** the user opens the dashboard or account detail
- **THEN** only provider quota monitoring and account management appear, with no relay statistics or setup.
