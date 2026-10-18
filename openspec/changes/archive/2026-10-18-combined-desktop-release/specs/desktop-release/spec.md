## RENAMED Requirements

- FROM: `### Requirement: Automatic Windows desktop prerelease publication`
- TO: `### Requirement: Automatic desktop prerelease publication`

## MODIFIED Requirements

### Requirement: Automatic desktop prerelease publication
After successful Windows x64 and macOS arm64 test/package jobs on a main-branch push or manual run in the project repository, a separate job SHALL download both artifacts from that same run and publish them together as one desktop prerelease under a shared desktop version tag. It SHALL validate each platform's product, matching configured version, architecture, expected artifact filenames/sizes/SHA-256, exact file set and checksum manifest before remote mutation. macOS metadata SHALL preserve strict signature/container/installer verification and actual signing/notarization/Gatekeeper status. Release assets SHALL include the Windows installer, macOS DMG/ZIP and separately named platform checksum/metadata documents. Build and PR jobs SHALL retain read-only content permissions; only eligible publication SHALL receive contents write. The publisher SHALL require the run commit to remain main head, bind the shared lightweight desktop tag to that exact commit, and refuse another commit or an unowned existing release.

#### Scenario: Both platforms succeed
- **WHEN** tests and native packaging succeed for Windows x64 and macOS arm64 on the current main commit
- **THEN** both Actions artifacts remain available, and one draft release receives all seven verified assets before publication as a prerelease without marking it latest. Notes accurately describe each platform's signing state and Apple Silicon support.

#### Scenario: Retry and existing releases
- **WHEN** a shared-release upload is retried on the same commit
- **THEN** matching assets are reused, missing draft assets are completed and verified before publication, and a complete matching public release is a no-op. Conflicting tags/assets or incomplete public releases fail without replacement/deletion. Historical Windows-only tags/releases remain untouched.

#### Scenario: Failed, missing or mismatched platform
- **WHEN** either native job fails, a platform artifact is missing/corrupt, versions/architectures disagree, or a PR/non-main/fork run executes
- **THEN** no new shared public release is published. Mac-only or Windows-only partial publication SHALL NOT occur, and modified files for an already released shared version require a desktop version bump.
