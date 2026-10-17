# monitoring-design Specification

## Purpose
Provide a compact native monitoring interface where account identity, quota semantics and observation history remain clear across light and dark themes.

## Requirements

### Requirement: Account identity and semantic legends
The dashboard SHALL group monitoring information under a visible account header. A quota legend SHALL contain only remaining/used series labels and small swatches, without account identities or an oversized legend column. Unknown quota SHALL remain unknown, and privacy mode SHALL cover account identity.

#### Scenario: Account quota
- **WHEN** quota is displayed
- **THEN** account identity appears above its charts and the quota legend labels the remaining and used series only.

### Requirement: Desktop editorial design
The app SHALL use scoped warm cream, coral, ink and hairline tokens with a readable dark variant, native font fallbacks and compact responsive monitoring cards. Existing monitoring, history, alerts and account actions SHALL remain available.

#### Scenario: Theme and width
- **WHEN** a user changes theme or uses the supported minimum window width
- **THEN** data labels, controls and chart legends remain readable without horizontal page overflow.
