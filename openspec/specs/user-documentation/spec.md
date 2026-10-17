# user-documentation Specification

## Purpose
Contracts for user-facing documentation: the published mkdocs-material site (strict builds, deploy from `main`, spec backlinks on behavior pages) and the entry-point documents — a README that stays a quickstart and a fully commented, zero-drift `.env.example` — so detailed material lives on the docs site instead of re-growing the README. OpenSpec remains the normative SSOT; docs pages render behavior, they do not define it.

## Requirements

### Requirement: Documentation site builds strictly and deploys from main

The repository SHALL contain a mkdocs-material documentation site (`mkdocs.yml` with `docs_dir: docs`) published at https://soju06.github.io/codex-lb/. A dedicated GitHub Actions workflow SHALL build the site with `mkdocs build --strict` on every pull request that touches docs inputs and on pushes to `main`, and SHALL deploy to GitHub Pages only for non-pull-request events on `main`. The deploy job MUST use least-privilege permissions (`pages: write`, `id-token: write` scoped to the deploy job) and MUST NOT cancel in-flight deploys.

#### Scenario: PR with a broken internal docs link fails the build

- **GIVEN** a pull request editing a page under `docs/` with a link to a nonexistent page or anchor
- **WHEN** the Docs workflow runs
- **THEN** `mkdocs build --strict` fails the build check
- **AND** no Pages deploy is attempted for the pull request

#### Scenario: Push to main deploys the site

- **WHEN** a commit touching `docs/**` or `mkdocs.yml` lands on `main`
- **THEN** the workflow builds the site strictly, uploads the Pages artifact, and deploys it to the `github-pages` environment

### Requirement: Docs pages link their governing OpenSpec capability

OpenSpec remains the normative source of truth. Every docs page that documents spec-governed behavior SHALL carry a link to the governing `openspec/specs/<capability>/` location on GitHub, and docs pages MUST NOT introduce requirements or behavior claims absent from OpenSpec.

#### Scenario: Behavior page carries a spec link

- **WHEN** a reader opens a docs page describing spec-governed behavior (e.g. routing strategies)
- **THEN** the page contains a link to the governing capability under `openspec/specs/` on GitHub

### Requirement: README stays a quickstart

`README.md` SHALL be the concise Codex Monitor desktop entry point, linking feature, build and provenance guides and stating platform verification status. Detailed desktop guidance SHALL live under `docs/monitor/`. The inherited codex-lb quickstart and generated all-contributors block SHALL remain unchanged in `README.upstream.md`. `README.zh-CN.md` SHALL identify itself as inherited upstream documentation and link the monitor entry point.

#### Scenario: Moved content is reachable from the README
- **WHEN** a reader looks for upstream service operational content
- **THEN** the monitor README links to the preserved upstream README and identifies its separate scope.

#### Scenario: Contributors block survives the diet
- **WHEN** the original contributor acknowledgments are inspected
- **THEN** their original generated markers and content remain available in `README.upstream.md`.

### Requirement: .env.example is a commented zero-drift sample

`.env.example` SHALL contain only commented-out values, SHALL NOT state values that contradict the code defaults in `app/core/config/settings.py`, and SHALL retain the commented `# CODEX_LB_LEADER_ELECTION_ENABLED=false` single-instance escape hatch. Copying the file verbatim MUST yield the same behavior as running with no configuration.

#### Scenario: Copying the sample changes nothing

- **GIVEN** a fresh install
- **WHEN** the operator copies `.env.example` to `.env.local` without uncommenting anything
- **THEN** the application starts with identical effective settings to a no-.env install
- **AND** leader election remains enabled

#### Scenario: Leader-election escape hatch stays documented

- **WHEN** `.env.example` is read
- **THEN** it contains the commented line `# CODEX_LB_LEADER_ELECTION_ENABLED=false`
- **AND** no active (uncommented) assignment disables leader election

### Requirement: Generated settings reference stays in sync with the code

The documentation site SHALL include a settings reference page
(`docs/reference/settings.md`) generated from `Settings.model_fields` by
`scripts/generate_settings_reference.py`. The page SHALL list, for every
setting, its environment variable name — the `CODEX_LB_`-prefixed name, or,
for a setting declared with explicit validation aliases, the primary alias
followed by the remaining aliases — its type, and its default
(environment-derived defaults rendered symbolically), grouped by functional
area; it SHALL document the bare `PORT` special case, the
`CODEX_LB_ENV_FILE` bootstrap variable, and the `CODEX_LB_WORKERS_PER_INSTANCE`
startup guard (which is not a setting), SHALL list the process-level
environment variables codex-lb honors without making them settings
(third-party or POSIX conventions read by the launcher, libraries, or frozen
migrations), and SHALL list the removed (`_REMOVED_SETTINGS`) env names
sourced from the code. The generated page SHALL be
checked into the repository so the strict docs build stays hermetic, SHALL
carry a header identifying it as generated, and SHALL link the owning
OpenSpec capability. CI unit tests MUST fail when the checked-in page differs
from regenerated output, when the settings surface exceeds its ratchet
(lower-only without a simplicity-budget decision), or when an uncommented
`.env.example` assignment differs from the code default.

#### Scenario: Settings change without regeneration fails CI
- **GIVEN** a change to `Settings` fields in `app/core/config/settings.py`
- **WHEN** the unit test suite runs without regenerating `docs/reference/settings.md`
- **THEN** the regenerate-and-diff test fails until the page is regenerated and committed

#### Scenario: Reference page is reachable and generated
- **WHEN** a reader opens the published settings reference page
- **THEN** it is in the site navigation and linked from the Configuration page
- **AND** it identifies itself as generated from `scripts/generate_settings_reference.py`
- **AND** it links the owning OpenSpec capability

#### Scenario: Settings surface growth trips the ratchet
- **WHEN** the number of `Settings` fields exceeds the ratchet value
- **THEN** the ratchet unit test fails, forcing a simplicity-budget discussion before the surface grows

#### Scenario: Aliased setting renders every env name
- **WHEN** a setting is declared with validation aliases (for example `forwarded_allow_ips`)
- **THEN** the reference row shows the primary env name and each alias
- **AND** an operator can find the setting by either name

#### Scenario: Process-level conventions are documented but not settings
- **WHEN** codex-lb honors an environment variable that is a third-party or POSIX convention
- **THEN** the reference lists it in the process-level section with its consumer
- **AND** it is not counted toward the settings ratchet

#### Scenario: Removed names are listed without a deprecated-alias section

- **WHEN** the reference page is regenerated
- **THEN** its "Removed" section lists exactly the names in `_REMOVED_SETTINGS`
- **AND** the page has no deprecated-env-alias list
