# macOS installation trust guidance

## Why
Users mistake the unverified-malware Gatekeeper warning on ad-hoc releases for confirmed malware detection and cannot find first-run instructions before the blocked installer opens.

## What Changes
Ship a visible offline Korean/English HTML guide inside the DMG, before users open PKG/app, and use the same guide for Installer welcome/completion resources. Explain signing facts, official app-specific Open Anyway steps for a known trusted/unmodified release and when to stop. Keep the installer script-free, settings untouched and the payload app-only. Verify the packaged guide/resources and retain no unsupported trust claim.
