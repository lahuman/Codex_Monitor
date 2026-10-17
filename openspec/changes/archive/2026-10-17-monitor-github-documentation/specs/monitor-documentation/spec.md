## ADDED Requirements

### Requirement: Accurate GitHub entry points
The repository SHALL provide Korean and English introductions for Codex Monitor describing implemented monitoring functionality, verified macOS architecture and unverified Windows/Intel status. Build/install guidance SHALL match the desktop scripts and SHALL distinguish locally generated artifacts from published Releases.

#### Scenario: New reader
- **WHEN** a reader opens the root README
- **THEN** they find the monitoring scope, supported platform, build entry point and links to detailed guides without treating upstream proxy features as desktop functionality.

### Requirement: Provenance and preserved credits
Documentation SHALL identify Soju06/codex-lb as the source basis and dashboard inspiration, distinguish reused frontend code from Rust desktop additions, and identify design/workflow references without claiming those tools are runtime dependencies. The upstream MIT notice and original README/contributor acknowledgments SHALL be preserved.

#### Scenario: Attribution
- **WHEN** a reader opens the provenance guide
- **THEN** they can trace source code, visual inspiration and development references separately and access the original license and README.
