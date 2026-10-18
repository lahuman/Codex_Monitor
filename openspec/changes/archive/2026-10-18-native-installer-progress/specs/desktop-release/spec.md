## ADDED Requirements

### Requirement: Visible native installation workflow
The macOS DMG SHALL offer an optional Installer-compatible package alongside the app and Applications shortcut. Launching the package SHALL use the native macOS Installer's installation stages, progress and completion interface. Documentation SHALL distinguish this flow from Finder-controlled drag-copy feedback. The package SHALL contain only the verified app, target /Applications, disable bundle relocation and custom install scripts, and retain existing account data outside the app bundle. Packaging SHALL verify expanded payload identity, version, destination, architecture/minimum OS constraints and strict app signatures. Package signing SHALL be reported accurately and SHALL NOT be inferred from the app signature.

#### Scenario: User wants installation progress
- **WHEN** the user opens the package inside the DMG
- **THEN** macOS Installer presents installation progress and completion for the app, while ordinary drag installation remains available.

#### Scenario: Release verification
- **WHEN** a native installation package is built
- **THEN** its expanded app matches the verified release app and only /Applications is targeted, with no custom scripts, relocation search, account payload or false package-signature claim; verification does not install on the host.
