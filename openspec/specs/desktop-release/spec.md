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
The release workflow SHALL build an optimized macOS app and create versioned, architecture-labeled DMG and ZIP artifacts with SHA-256 checksums. Packaging SHALL validate the app metadata and refuse to silently overwrite existing release output. DMG and ZIP contents SHALL include only the built app and installation material, never the working tree or account data. Successful packaging SHALL retain only DMG, ZIP, checksum and metadata manifests in the release directory and SHALL remove its temporary app copies and the build bundle after verified archives have been published. Cleanup SHALL NOT modify installed apps or user-mounted volumes. A standalone build SHALL remain available for developers who explicitly need an unpacked app.

#### Scenario: Local distribution build
- **WHEN** the packaging command completes
- **THEN** DMG and ZIP containing the distributable app, a checksum manifest and release metadata are available for the actual built architecture and configured version, with no unpacked app retained in the release or build bundle directory.

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

### Requirement: Verified macOS bundle sealing
The macOS build SHALL sign the complete application bundle, using an ad-hoc identity unless an explicit signing identity is selected. Packaging SHALL fail on invalid strict bundle signatures before creating release artifacts. It SHALL verify signatures after copying, ZIP round-trip and mounting the DMG read-only. Metadata SHALL distinguish valid resource sealing from developer identity, notarization ticket and Gatekeeper acceptance. A non-notarized ad-hoc build SHALL NOT be described as universally trusted.

#### Scenario: Invalid or modified bundle
- **WHEN** an unsealed or modified app is passed to distribution verification
- **THEN** verification fails and no valid release status is reported for that app.

#### Scenario: Ad-hoc package
- **WHEN** a locally ad-hoc signed package is generated
- **THEN** its app signatures pass verification in the source, ZIP and DMG, while metadata preserves Gatekeeper rejection and lack of notarization if present.

### Requirement: Read-only installation diagnostics
A recipient diagnostic command SHALL report host macOS version/architecture, app version/minimum OS/executable architectures, app quarantine presence, strict signing verification, notarization-ticket validation and Gatekeeper assessment. It SHALL NOT launch or install the app, modify system security or quarantine, access account stores, or upload results.

#### Scenario: Recipient installation failure
- **WHEN** a user runs diagnostics against an app path
- **THEN** a local report explains compatibility and distribution checks without needing account credentials or executing the application.

### Requirement: Visible native installation workflow
The macOS DMG SHALL offer an optional Installer-compatible package alongside the app and Applications shortcut. Launching the package SHALL use the native macOS Installer's installation stages, progress and completion interface. Documentation SHALL distinguish this flow from Finder-controlled drag-copy feedback. The package SHALL contain only the verified app, target /Applications, disable bundle relocation and custom install scripts, and retain existing account data outside the app bundle. Packaging SHALL verify expanded payload identity, version, destination, architecture/minimum OS constraints and strict app signatures. Package signing SHALL be reported accurately and SHALL NOT be inferred from the app signature.

#### Scenario: User wants installation progress
- **WHEN** the user opens the package inside the DMG
- **THEN** macOS Installer presents installation progress and completion for the app, while ordinary drag installation remains available.

#### Scenario: Release verification
- **WHEN** a native installation package is built
- **THEN** its expanded app matches the verified release app and only /Applications is targeted, with no custom scripts, relocation search, account payload or false package-signature claim; verification does not install on the host.


### Requirement: Visible macOS trust-warning guidance
Each macOS DMG SHALL include an offline Korean/English installation guide readable before launching its app or installer. The same generated guide SHALL be embedded as native Installer welcome and completion resources. It SHALL accurately describe the verified app signing kind, notarization-ticket and Gatekeeper status, and the unsigned installer. It SHALL distinguish inability to verify malware absence from a detected-malware, revoked or damaged-app warning and SHALL NOT claim malware freedom from signature integrity alone. Trusted, unmodified releases MAY describe Apple's app-specific Privacy & Security / Open Anyway procedure and link to the official support article; detected-malware/damage/verification-failure cases SHALL instruct users to stop. No guide or installer SHALL automatically disable protections, remove quarantine, run the app or alter account stores.

#### Scenario: Installer is blocked before opening
- **WHEN** a recipient opens the DMG but Gatekeeper blocks the installer or app
- **THEN** the visible HTML guide remains readable without running the package and explains the warning, official conditional first-run steps and when to seek support instead of proceeding.

#### Scenario: Guided native installation
- **WHEN** the recipient opens the native package
- **THEN** welcome and completion pages reference embedded guide resources whose content matches the DMG guide, while the app-only payload and no-install-script constraints remain enforced.


### Requirement: Automatic Windows desktop prerelease publication
After a successful Windows test/package job on a main-branch push or manual run in the project repository, a separate job SHALL download that same run's artifact and publish its verified x64 installer and platform-named checksum/metadata assets to GitHub Releases as a prerelease. Build and pull-request jobs SHALL retain read-only content permissions; only the eligible publication job SHALL have contents write permission. The publisher SHALL validate product, version, architecture, target, artifact filename/size/SHA-256 and checksum manifest against the checked-out configuration before any remote mutation. It SHALL require the run commit to remain the main head, bind a dedicated lightweight desktop version/architecture tag to that exact commit, and refuse another commit or an unowned existing release.

#### Scenario: Successful main build
- **WHEN** tests and Windows packaging succeed for the current main commit
- **THEN** the workflow retains the Actions artifact and creates a draft release, uploads and verifies all three Windows assets, then publishes the prerelease without marking it latest.

#### Scenario: Retry and conflicts
- **WHEN** a run retries after a partial draft upload
- **THEN** matching verified assets are reused and missing ones are completed before publication. A complete matching published release is a no-op. Conflicting tags/assets, unowned releases and incomplete already-published releases fail without replacing or deleting existing assets; a changed commit for a released version requires a version bump.

#### Scenario: Ineligible or failed build
- **WHEN** a PR, non-main run or failed package/test job executes
- **THEN** no public release publication is attempted, and a failure before all draft assets are verified leaves no newly published incomplete release.
