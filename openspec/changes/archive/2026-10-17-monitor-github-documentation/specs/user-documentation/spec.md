## MODIFIED Requirements

### Requirement: README stays a quickstart

`README.md` SHALL be the concise Codex Monitor desktop entry point, linking feature, build and provenance guides and stating platform verification status. Detailed desktop guidance SHALL live under `docs/monitor/`. The inherited codex-lb quickstart and generated all-contributors block SHALL remain unchanged in `README.upstream.md`. `README.zh-CN.md` SHALL identify itself as inherited upstream documentation and link the monitor entry point.

#### Scenario: Moved content is reachable from the README
- **WHEN** a reader looks for upstream service operational content
- **THEN** the monitor README links to the preserved upstream README and identifies its separate scope.

#### Scenario: Contributors block survives the diet
- **WHEN** the original contributor acknowledgments are inspected
- **THEN** their original generated markers and content remain available in `README.upstream.md`.

