## ADDED Requirements

### Requirement: Visible macOS trust-warning guidance
Each macOS DMG SHALL include an offline Korean/English installation guide readable before launching its app or installer. The same generated guide SHALL be embedded as native Installer welcome and completion resources. It SHALL accurately describe the verified app signing kind, notarization-ticket and Gatekeeper status, and the unsigned installer. It SHALL distinguish inability to verify malware absence from a detected-malware, revoked or damaged-app warning and SHALL NOT claim malware freedom from signature integrity alone. Trusted, unmodified releases MAY describe Apple's app-specific Privacy & Security / Open Anyway procedure and link to the official support article; detected-malware/damage/verification-failure cases SHALL instruct users to stop. No guide or installer SHALL automatically disable protections, remove quarantine, run the app or alter account stores.

#### Scenario: Installer is blocked before opening
- **WHEN** a recipient opens the DMG but Gatekeeper blocks the installer or app
- **THEN** the visible HTML guide remains readable without running the package and explains the warning, official conditional first-run steps and when to seek support instead of proceeding.

#### Scenario: Guided native installation
- **WHEN** the recipient opens the native package
- **THEN** welcome and completion pages reference embedded guide resources whose content matches the DMG guide, while the app-only payload and no-install-script constraints remain enforced.
