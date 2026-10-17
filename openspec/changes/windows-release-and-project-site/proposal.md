# Windows distribution and project website

## Why
Users need a Windows installation of the monitoring app and a GitHub Pages introduction that describes the current product rather than the inherited proxy service.

## What Changes
- Package Windows x64 with NSIS and WebView2 bootstrap installation; add ICO identity, a visible tray icon, tooltip/menu observations and platform-correct local persistence.
- Build and test on a native Windows Actions runner and retain checksummed installers.
- Add an accessible, responsive Korean project landing page with illustrative data, real source/release links and provenance; retain reference documentation under /docs/.
- Deploy one combined artifact to GitHub Pages and scope inherited upstream automation to its original repository.

## Impact
Desktop persistence and tray presentation, build scripts/config, native Windows CI, static website, docs/Pages workflow. No relay or external account data is introduced. Public source upload and deployment were explicitly authorized by the user.
