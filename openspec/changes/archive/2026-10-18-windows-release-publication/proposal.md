# Publish Windows desktop releases

## Why
The Windows workflow successfully uploads Actions artifacts but has no Releases publication step, so users cannot find an installer in public Releases.

## What Changes
A separate write-scoped job will consume the successful same-run Windows artifact on main push/manual runs and publish a prerelease under a dedicated desktop/version/architecture tag. Validate manifest/checksums before mutation, stage all assets in a draft before publication, preserve immutable commit identity and refuse conflicting existing tags/assets. Keep PR builds and build jobs read-only. No remote upload is performed by this local change.
