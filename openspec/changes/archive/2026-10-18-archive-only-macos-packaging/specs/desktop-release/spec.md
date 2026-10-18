## MODIFIED Requirements

### Requirement: Repeatable macOS packaging
The release workflow SHALL build an optimized macOS app and create versioned, architecture-labeled DMG and ZIP artifacts with SHA-256 checksums. Packaging SHALL validate the app metadata and refuse to silently overwrite existing release output. DMG and ZIP contents SHALL include only the built app and installation material, never the working tree or account data. Successful packaging SHALL retain only DMG, ZIP, checksum and metadata manifests in the release directory and SHALL remove its temporary app copies and the build bundle after verified archives have been published. Cleanup SHALL NOT modify installed apps or user-mounted volumes. A standalone build SHALL remain available for developers who explicitly need an unpacked app.

#### Scenario: Local distribution build
- **WHEN** the packaging command completes
- **THEN** DMG and ZIP containing the distributable app, a checksum manifest and release metadata are available for the actual built architecture and configured version, with no unpacked app retained in the release or build bundle directory.

