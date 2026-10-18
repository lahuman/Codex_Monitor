## ADDED Requirements

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
