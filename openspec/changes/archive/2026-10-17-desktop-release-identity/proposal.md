# Change: Desktop identity and release packaging

## Why
The monitoring app still presents prototype naming and no application icon. Users need a recognizable app, version information and repeatable distributable artifacts.

## What Changes
Adopt Codex Monitor as the visible product name, use an original vector quota-meter icon, add an about dialog and release metadata, and provide repeatable native macOS app/DMG/ZIP packaging with checksums. Preserve the existing bundle identifier, credential storage and menu-bar usage presentation. Security-review remediation and public publication are outside this change.

## Impact
Desktop branding assets, Tauri packaging configuration, React presentation, packaging script and focused validation.
