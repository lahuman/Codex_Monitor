# desktop-release Specification

## Purpose
Provide a consistent desktop product identity and repeatable architecture-labeled desktop distribution artifacts while preserving existing account data.

## Requirements

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

### Requirement: Native Windows distribution
The application SHALL support building a Windows x64 NSIS installer on a native Windows runner using the pinned toolchain and locked dependencies. Packaging SHALL verify the built executable architecture, preserve the product identity, include WebView2 installation when required, and emit versioned artifacts with SHA-256 checksums without overwriting existing release output. Windows code signing SHALL NOT be claimed unless performed.

#### Scenario: Windows build
- **WHEN** the Windows packaging command succeeds
- **THEN** the versioned output contains an x64 setup executable and checksum/metadata manifests, and native Rust tests have a distinct recorded result.

### Requirement: Windows monitoring lifecycle
The Windows application SHALL provide a visible notification-area icon, account quota observations in its menu and tooltip, and commands to reopen or quit. Closing the window SHALL retain monitoring. Local account/history writes SHALL preserve atomic replacement and file synchronization without attempting Unix-only parent directory synchronization on Windows.

#### Scenario: Repeated save and hidden window
- **WHEN** a Windows user updates account/history state more than once and closes the dashboard
- **THEN** saving succeeds, persisted state can be reloaded, and the tray remains available to reopen or quit the application.
