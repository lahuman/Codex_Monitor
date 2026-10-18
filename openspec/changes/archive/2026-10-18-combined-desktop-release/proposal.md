# Combined macOS and Windows releases

## Why
Users need the macOS archives and Windows installer on the same versioned GitHub Release. The existing publisher and workflow only support Windows.

## What Changes
Build Windows x64 and macOS Apple Silicon independently in the same workflow, then validate and publish all same-run platform files to one desktop version prerelease after both jobs succeed. Refactor the Windows-only publisher into one desktop publication owner with platform-specific validation and signing notes. Preserve immutable source identity, draft staging and retry behavior; existing Windows-only releases are not changed.
