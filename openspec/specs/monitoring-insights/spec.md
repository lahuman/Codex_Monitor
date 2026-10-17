# monitoring-insights Specification

## Purpose
Show provider quota health, reset countdowns, polling freshness, account status, bounded local history and comparable quota changes in the monitoring-only desktop dashboard, with configurable per-account in-app low-quota alerts.

## Requirements

### Requirement: Observation history and alert preferences
The app MUST persist provider observations separately from credentials with bounded size and retention. It MUST record at most one history sample per account per five minutes, retain a rolling twenty-five hours for a twenty-four-hour graph, and preserve unknown quota values. Alert preferences MUST be independently configurable per account.

#### Scenario: Restart
- **WHEN** monitoring restarts
- **THEN** valid saved history and alert preferences are restored without modifying credential storage.

#### Scenario: Invalid history file
- **WHEN** the history file cannot be parsed or exceeds limits
- **THEN** it remains untouched and the app displays a storage issue.

### Requirement: Monitoring insight display
The dashboard MUST show reset countdowns, quota health summary, last/next poll status, plan/account status, observed history, comparable one-hour decrease and configurable low-quota in-app alerts. It MUST distinguish unknown, paused and stale accounts.

#### Scenario: Incomparable history
- **WHEN** history is insufficient or a quota reset/duration changes
- **THEN** one-hour decrease is unavailable and graphs do not connect across the reset.

#### Scenario: Configured low quota
- **WHEN** an active account has a fresh observed quota at or below its enabled threshold
- **THEN** an in-app alert identifies the account and threshold.
