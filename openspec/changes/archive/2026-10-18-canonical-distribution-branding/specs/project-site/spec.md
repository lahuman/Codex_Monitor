## ADDED Requirements

### Requirement: Canonical Pages identity and source
Site metadata and current project documentation SHALL use the exact Codex_Monitor Pages base path. Platform download cards SHALL distinguish architecture, package format and signing limitations. The Pages publication workflow SHALL reject a branch-based Pages source with an actionable instruction to select GitHub Actions, preventing a successful custom deployment from being reported while a conflicting legacy source is enabled.

#### Scenario: Legacy Pages source
- **WHEN** the repository Pages source remains branch-based during a main publication
- **THEN** the workflow reports the required Settings > Pages > GitHub Actions change before deploying.
