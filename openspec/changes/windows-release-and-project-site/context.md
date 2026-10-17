# Context

Windows builds use a native windows-2022 x64 runner with the repository Rust toolchain and NSIS. No Windows runtime is available on this Mac, so compilation/test/artifact evidence and interactive installation evidence must be reported separately. Windows has no tray title; an icon, tooltip and menu provide equivalent monitoring access. Atomic file replacement and file sync are shared; Unix-only parent directory sync must not fail an otherwise successful Windows save.

The Pages root introduces Codex Monitor. A separate /docs/ subtree retains MkDocs reference pages. A single deployment workflow owns both paths, avoiding two deployments overwriting each other. Static relative asset paths support /codex_Monitor/ project hosting. Preview uses fictional account labels and explicitly illustrative observations; it never requests authentication or calls the account backend.

Example: a Windows user installs the x64 setup executable, connects an account, closes the dashboard, and opens the notification-area icon to inspect remaining quota or reopen/quit the app. A website visitor sees an explicitly labeled 49% demo rather than any real user's account.

Existing macOS bundles/identifier/storage are preserved. Upstream automated Python releases must not run for this independently named fork. Source publication is limited to nonignored project sources, licenses and required icon assets; account storage and generated distributions remain excluded.

## User deployment decision

The user subsequently chose to upload the project themselves because GitHub authentication is unavailable in this environment. Commit/push, native Windows Actions execution and live Pages deployment are therefore outside this local handoff. Do not imply a generated Windows installer or live public website before the user runs those workflows.

## Local verification evidence

- Dashboard production build passed; desktop UI tests: 18 passed.
- Native macOS shared Rust tests: 8 desktop + 1 repeated vault-save/reload passed. These do not establish Windows execution.
- Cargo clippy for desktop/server all targets passed with warnings denied; frontend ESLint passed.
- PE/COFF packaging contracts: 2 passed; the Windows packaging command rejects macOS before writes.
- Windows configuration merged against the installed Tauri JSON Schema and generated ICO entry bounds passed.
- Actionlint v1.7.12 passed all workflows; strict OpenSpec: 74 specs passed and this change validated.
- MkDocs strict build passed; 78 source/document/image links and 17 built landing-page asset/document/fragment links checked.
- In-app browser: example period control updates 49/72 to 86/94 and back by keyboard; mobile 390px viewport has no horizontal overflow, and desktop layout was visually inspected.
- GitHub remote is currently empty and Pages is not enabled; no authentication was available. User elected to perform upload and deployment themselves. No git commit/push or public artifact was created here.
