# Validate macOS bundle signatures before distribution

## Why
The 0.1.0 DMG has correct checksums but contains a linker-only ad-hoc signature. `codesign --verify --deep --strict` rejects the bundle because resource sealing is missing. Local launch did not establish downloaded-app trust. Recipient error text and hardware are unknown.

## What Changes
- Configure full bundle ad-hoc signing by default, retaining explicit Developer ID selection through Apple's signing environment.
- Fail packaging on invalid source or copied bundle signatures and record actual signing/notarization/Gatekeeper results in release metadata.
- Verify the ZIP round-trip and read-only mounted DMG bundle, not just container checksums.
- Supply a read-only diagnostic command collecting architecture, OS version, signing and assessment results without reading account files, launching the app or modifying quarantine/security settings.
- Produce a distinct 0.1.1 Apple Silicon package and clarify ad-hoc vs notarized distributions.

## Impact
macOS build/signing configuration, packaging and diagnostics only. Bundle identifier and stored accounts are unchanged. Developer ID credentials, notarization and recipient-machine execution are not available and must not be claimed.
