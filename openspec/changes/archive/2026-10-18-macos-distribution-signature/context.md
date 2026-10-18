# Context

The original 0.1.0 app and read-only DMG copy both fail strict codesign verification with `code has no resources but signature indicates they must be present`. A temporary full-bundle ad-hoc signing experiment passes strict verification but Gatekeeper still rejects it. Thus resource sealing and downloaded-app trust are separate outcomes. Checksums and hdiutil verification alone did not cover the defect.

The repair belongs at the producer: tell Tauri to sign the full bundle, then verify rather than silently re-signing an invalid artifact downstream. Developer ID identity selection must remain explicit; no certificate or Apple credentials are collected. Ad-hoc metadata must not imply notarized external distribution. The release retains the legacy identifier for stored-account continuity.

Example: a recipient can run the supplied .command file and drag the app into Terminal. Its report prints arm64/x86_64 compatibility and signature/Gatekeeper results, but never loads the app's vault, account data or environment. Missing recipient evidence remains unknown.

## Verified outcome

The 0.1.1 arm64 optimized build completed. Tauri logged complete executable and app signing with identity `-`. Strict verification passed for the original app, copied app, extracted ZIP and read-only mounted DMG. The regression test modifies a real built-app copy and confirms verification fails; another test runs the recipient diagnostic and confirms the built app still verifies. Both tests passed. Checksums passed for the generated DMG (5,440,886 bytes) and ZIP (4,941,878 bytes).

The recorded signing kind is ad-hoc, identifier local.codex-lb.desktop.preview, no TeamIdentifier, no stapled notarization ticket (exit 65), and Gatekeeper rejected (exit 3). This verifies the resource-sealing fix; it does not establish downloaded-app trust or execution on the recipient's unknown machine. Developer ID credentials/notarization are unconfigured. The original 0.1.0 artifacts and the user's installed app remain untouched.

Frontend about-dialog testing exposed a hardcoded 0.1.0 expectation; the assertion now reads the version from the owning Tauri configuration so subsequent release bumps do not require repeated literal repairs. The actual UI was already displaying 0.1.1 correctly. Final frontend tests passed, as did the installed Tauri configuration schema, all 84 local documentation/source links and strict MkDocs build.
