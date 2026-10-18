# project-site Specification

## Purpose
Provide an accurate, accessible project introduction and one GitHub Pages artifact containing both the landing page and reference documentation.

## Requirements

### Requirement: Public project introduction
The repository SHALL provide a responsive Korean static project introduction with product identity, implemented features, platform/build status, installation guidance, source/release links and upstream/design credits. Illustrative account observations SHALL be labeled as examples and SHALL NOT expose real credentials or account information. Primary navigation SHALL remain usable with keyboard and at mobile widths.

#### Scenario: Prospective user
- **WHEN** a visitor opens the project website on desktop or mobile
- **THEN** they can understand quota/voucher/history monitoring, find installation or build artifacts, distinguish platform support from runtime validation and reach provenance/source documentation.

### Requirement: Single GitHub Pages publication
One Pages workflow SHALL build the project introduction at the project root and the reference documentation under docs/ in the same artifact. Relative assets SHALL work under a repository base path. Publishing SHALL use GitHub Actions Pages permissions and SHALL NOT include desktop secrets, real account data or local generated installers.

#### Scenario: Project Pages deployment
- **WHEN** a verified main branch publication succeeds
- **THEN** the introduction and documentation are reachable below the repository Pages URL without independent deployments overwriting either section.

### Requirement: Current monitoring and release guidance
The introduction SHALL describe independent macOS account menu items, quota colors, 1/3/6-hour observed quota changes, 24-hour history and compact reset-voucher expiry warnings. Both platform download links SHALL target repository Releases and distinguish automated packaging from real-device verification. Installation guidance SHALL link to platform-specific documentation; stable-release promotion SHALL be documented without implying that publication has occurred.

#### Scenario: Current desktop visitor
- **WHEN** a visitor reviews monitoring features and download options
- **THEN** they can distinguish observed quota changes from token counts, find macOS and Windows releases, and reach installation and stable-promotion guidance.
