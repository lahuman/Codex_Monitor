# Verification: finalize-monitor-multiplatform-release

Source commit: `6f5c1149` (main, 2026-10-22 Asia/Seoul).

## Completeness

All four tasks are complete. All three requirements are implemented and verified. Both native builds, common prerelease publication, and Pages deployment succeeded.

## Correctness

| Requirement | Evidence |
| --- | --- |
| Native tests follow the shared application library | `.github/workflows/desktop-windows.yml` runs desktop `--lib`, server library/device_login/workflow with the required legacy-relay test feature, and complete `src/desktop` UI tests on both native platforms. Both jobs gate publication. |
| Consolidated multiplatform work documentation | `docs/monitor/releases.md` links platform guides, canonical requirements and immutable Android preview provenance. Korean/English README and development/publishing guides reflect the completed source. |
| Android introduction and download guidance | `website/index.html` includes the Android preview card, setup guide and cached widget illustration. Signing/background limits and illustrative data are disclosed. |

Local checks passed:

- Desktop/server default Rust suites: 22 tests; explicit legacy-relay server library/login/workflow suites: 13 tests.
- Desktop/mobile UI: 67 tests across six files; ESLint, TypeScript and Vite production build.
- Packaging/publication/macOS installation-guide contracts: 10 tests.
- Cargo Clippy with warnings denied; Cargo formatting.
- OpenSpec strict validation: 75/75 specs.
- MkDocs strict build; no missing local links in the introduction and monitor guides.
- Headless Chrome screenshots at 390px and 1440px: no horizontal overflow, all images loaded, platform cards and widget content visible.

## Coherence

Main specs already contain all three delta requirements. Shared platform detection lives in `frontend/src/desktop/platform.ts`; native application tests target the shared library rather than the delegating executable. The immutable publisher and signing limitations are preserved.

## Remote evidence

- Source push confirmed to main.
- Native release run: https://github.com/lahuman/Codex_Monitor/actions/runs/39691158406
- Pages run: https://github.com/lahuman/Codex_Monitor/actions/runs/39691158289
- Pages attempt 1 correctly rejected branch-based configuration. Switched Pages source to GitHub Actions in the authenticated owner browser; attempt 2 built and deployed successfully.
- Public introduction, work/release summary and Android guide returned HTTP 200 with new content. Live Chrome checks at 390px and 1440px found no horizontal overflow and all images loaded.

## Publication verification

Release: https://github.com/lahuman/Codex_Monitor/releases/tag/desktop-v0.1.21

Windows x64, macOS Apple Silicon and publish jobs all succeeded. The tag resolves to `6f5c114971e3159f80f0acaab1f75400d4dd0a7a`. Downloaded all seven public assets and matched every size and SHA-256 against GitHub digests; both platform metadata/checksum manifests match the three downloaded installers/archives.

Pages publication is verified at https://lahuman.github.io/Codex_Monitor/ and https://lahuman.github.io/Codex_Monitor/docs/monitor/releases/.

Physical-device installation/login and production signing are outside these automated checks and are explicitly distinguished in the documentation.

## Downloaded asset evidence

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| Codex-Monitor-0.1.21-macos-arm64.dmg | 10968979 | `98f5d7235d97123333496286fa9cf9e373ac2acdfa3b84546cd9b1ccd44b7149` |
| Codex-Monitor-0.1.21-macos-arm64.zip | 5130896 | `b20b9ea3b6459453132108d9667f811fd63febb05ee5e2fd532ead2c6d1c5972` |
| Codex-Monitor-0.1.21-windows-x64-setup.exe | 4081179 | `1458318f3de78cdc975de44ae009391ac21d521a1ffcec43d01d9f7780f0e571` |
| release-macos-arm64.json | 1124 | `f845ac7cb177577bf7885d55c370ba8eac3ddb208363de69bd665f97719078ee` |
| release-windows-x64.json | 481 | `9cd84ccf9fdc253ecf45dba8b87103f64577541008e343c9e1501d5b8f2fad5d` |
| SHA256SUMS-macos-arm64.txt | 206 | `45d6e0c5d1c2a70d76d3f0f3209efe3920da41fe86ff8fc4e098759c7124c3f2` |
| SHA256SUMS-windows-x64.txt | 109 | `2771e804002378dfef4970b4c410c373fd129043741474299072b006117e8edc` |

No critical issues or correctness warnings remain for this change. All delta requirements were already synchronized to the three main capability specs before publication.
