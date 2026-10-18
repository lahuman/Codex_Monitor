# Archive-only macOS packaging

## Why
Retained loose app bundles in versioned release directories appear as duplicate Codex Monitor entries in macOS app discovery.

## What Changes
- Keep only DMG, ZIP and checksum/metadata manifests after successful packaging.
- Remove packaging-owned temporary app copies and the verified build bundle only after publishing verified archives; standalone build remains available.
- Exercise signature and diagnostic tests against the actual archived app and assert archive-only output.
- Document ownership and retention; safely remove existing redundant local release bundles only after checking archive equivalence.

## Impact
macOS packaging, its tests, and release documentation. Installed apps, user-mounted volumes, runtime and account stores are outside cleanup scope.
