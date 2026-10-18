# Native installation progress

## Why
Finder owns drag-copy feedback and a small app can finish copying before its progress window appears. Users need an explicit visible installation flow.

## What Changes
- Preserve drag installation and add an optional native macOS Installer package inside the DMG.
- Native Installer provides installation stages, progress and completion instead of claiming to control Finder.
- Install only the app at /Applications, disable bundle relocation and package scripts, and preserve user data. Keep package signing status explicit.
- Verify expanded package payload, architecture/minimum OS, install location, version and resource sealing without performing a host installation.

## Impact
macOS packaging, release tests and installation docs. No actual /Applications installation or account changes occur during development/verification.
