# monitor-documentation Specification

## Purpose
Provide accurate Codex Monitor introductions, feature/build guidance and traceable provenance while preserving upstream credits and distinguishing verified support from future work.

## Requirements

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


### Requirement: Consolidated multiplatform work documentation
Project documentation SHALL summarize completed desktop and Android work, link to platform installation/build guidance and canonical source contracts, and distinguish native CI/emulator verification from physical-device installation and login. It SHALL preserve upstream credits and explain the historical Android preview source-tag limitation.

#### Scenario: Reader audits the completed work
- **WHEN** a reader opens the work summary
- **THEN** they can trace desktop, mobile, background and widget behavior, find downloads and understand remaining physical-device/signing limitations.
