## ADDED Requirements

### Requirement: Consistent desktop identity
The application SHALL present Codex Monitor with an original icon in its native bundle and embedded UI. Its about dialog SHALL show the product name and configured version. Rebranding SHALL preserve the existing bundle identifier and stored accounts.

#### Scenario: Existing installation
- **WHEN** the rebranded app opens
- **THEN** existing accounts remain available and the UI and native window display the new name and version consistently.

### Requirement: Repeatable macOS packaging
The release workflow SHALL build an optimized macOS app and create versioned, architecture-labeled DMG and ZIP artifacts with SHA-256 checksums. Packaging SHALL validate the app metadata and refuse to silently overwrite existing release output. Artifacts SHALL include only the built app and installation material, never the working tree or account data.

#### Scenario: Local distribution build
- **WHEN** the packaging command completes
- **THEN** a distributable app, DMG, ZIP and checksum manifest are available for the actual built architecture and configured version.
