## ADDED Requirements

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
