## Implementation
- [x] Define platform packaging and project site contracts.
- [x] Fix platform-specific persistence and Windows tray visibility.
- [x] Add Windows installer packaging and native build/test workflow.
- [x] Build project landing page and integrate one Pages deployment.
- [x] Update support, build and publishing documentation.
## Local verification and handoff
- [x] Run shared desktop checks, packaging contract tests and site/link/responsive checks.
- [x] Validate OpenSpec, Actions syntax, Windows Tauri configuration and documentation build.
- [x] Back up and publish scoped changes to the actual checkout.
## User-owned publication and native verification
The user chose to upload/deploy themselves; these are not claimed as completed by local preparation.
- [ ] Upload the source and run Windows Actions; inspect the generated x64 installer and checksums.
- [ ] Verify installation, login, persistence, tray/reopen/quit and uninstall on a Windows PC.
- [ ] Enable GitHub Actions as the Pages source and verify the public introduction/docs URLs.

Keep this change active until native Windows verification is available; do not archive it as verified Windows support from Mac-only checks.
