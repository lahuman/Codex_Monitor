## Context

See proposal.md and context.md. The Tauri executable now delegates to the shared library used by desktop and Android. The existing Android preview is immutable and predates the canonical source upload. Desktop publication validates the tested commit against main before creating its prerelease.

## Goals / Non-Goals

Make native CI execute the real application tests and publish traceable desktop artifacts. Consolidate platform documentation and deploy the existing introduction and reference site together. Physical-device installation/login and production signing remain outside this automated release verification.

## Decisions

- Run desktop tests with `--lib`; executable tests would exercise an empty entry point. Run the server's persistence/login integration targets with `legacy-relay` enabled because `workflow` requires that feature. This affects the server test command, not the packaged desktop defaults.
- Run all of `src/desktop` so mobile/dashboard regressions are included instead of maintaining a partial historical file list.
- Preserve the Android preview tag and assets, documenting their historical source mismatch. Publish the new desktop release from committed source with immutable asset checks instead of replacing an existing release.
- Build the introduction and MkDocs output into one Pages artifact. Require Pages source `workflow` to prevent a branch deployment from replacing the site.

## Risks / Trade-offs

- An advanced main would invalidate the publisher's source guard → wait for publication before the archive commit.
- Unsigned Windows installers and ad-hoc, unnotarized Mac apps can trigger OS warnings → keep explicit platform installation guidance.
- Android scheduling and widget rendering vary across devices → distinguish emulator results from physical-device verification.
- Missing authenticated GitHub API access prevents changing Pages source → request the owner to change the source or sign in to the existing browser session; retain the failed run as evidence.

## Migration Plan

Back up baseline files, verify there are no concurrent changes, synchronize only prepared finalization files, review the complete source set, then commit/push under the user's explicit main exception. Verify both native jobs, release tag, uploaded sizes/digests and public Pages content. Only then complete tasks and archive. Failed or partial deployments leave the OpenSpec change active; never overwrite existing public tags or assets.
