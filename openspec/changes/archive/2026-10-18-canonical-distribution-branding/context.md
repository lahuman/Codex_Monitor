# Context

Public checks observed lower-case /codex_Monitor/ returning 404 and /Codex_Monitor/ returning 200. Custom run 39123553175 deployed at 11:31:46 UTC, then dynamic branch Pages run 39123552946 deployed at 11:32:23 UTC and replaced the page. Canonical source links are fixed locally; remote settings/publication remain user-managed.

## Validation

0.1.11 Mac DMG and ZIP built successfully from app sources verified equal to the actual project. All six real macOS distribution tests passed: signature/tamper checks, read-only diagnostic, app-only PKG and matching embedded guidance. Eight guide/identity/publication contract tests passed. Strict MkDocs build, 94 source/doc/image references, actionlint and all 74 specs passed. Browser checks covered 320/390/768/1440px, no overflow, working sample controls, exact canonical URL and 13 built relative links/assets. Offline guide and download cards were visually inspected; NSIS BMP headers are validated at 150x57 and 164x314, 24-bit RGB. Pages source script accepts workflow and rejects legacy/unknown; actual remote settings/API access was not changed or verified. Windows native NSIS build/visual/install validation remains for Windows Actions and a recipient PC. No old artifact, installed app, account store, commit, push or public deployment was changed.
