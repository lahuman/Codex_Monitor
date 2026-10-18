## ADDED Requirements

### Requirement: Automatic Windows desktop prerelease publication
After a successful Windows test/package job on a main-branch push or manual run in the project repository, a separate job SHALL download that same run's artifact and publish its verified x64 installer and platform-named checksum/metadata assets to GitHub Releases as a prerelease. Build and pull-request jobs SHALL retain read-only content permissions; only the eligible publication job SHALL have contents write permission. The publisher SHALL validate product, version, architecture, target, artifact filename/size/SHA-256 and checksum manifest against the checked-out configuration before any remote mutation. It SHALL require the run commit to remain the main head, bind a dedicated lightweight desktop version/architecture tag to that exact commit, and refuse another commit or an unowned existing release.

#### Scenario: Successful main build
- **WHEN** tests and Windows packaging succeed for the current main commit
- **THEN** the workflow retains the Actions artifact and creates a draft release, uploads and verifies all three Windows assets, then publishes the prerelease without marking it latest.

#### Scenario: Retry and conflicts
- **WHEN** a run retries after a partial draft upload
- **THEN** matching verified assets are reused and missing ones are completed before publication. A complete matching published release is a no-op. Conflicting tags/assets, unowned releases and incomplete already-published releases fail without replacing or deleting existing assets; a changed commit for a released version requires a version bump.

#### Scenario: Ineligible or failed build
- **WHEN** a PR, non-main run or failed package/test job executes
- **THEN** no public release publication is attempted, and a failure before all draft assets are verified leaves no newly published incomplete release.
