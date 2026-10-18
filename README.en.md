<p align="center"><img src="desktop/src-tauri/icons/128x128.png" width="96" alt="Codex Monitor icon" /></p>

# Codex Monitor

**A desktop dashboard for monitoring quota and banked reset vouchers across Codex accounts.**

[한국어](README.md) | English

This project is derived from [Soju06/codex-lb](https://github.com/Soju06/codex-lb), reusing its frontend foundation and dashboard ideas while adding a Rust/Tauri desktop service and a monitoring-focused UI. [Provenance and credits](docs/monitor/provenance.md)

## Features

- Per-account remaining quota, reset times, plan and monitoring status.
- Banked reset-voucher counts, expiry dates/countdowns and in-app warnings for less than seven days remaining, with urgent emphasis at 24 hours or less.
- Independent two-row account nickname/quota items and a compact chart panel in the macOS menu bar, or a Windows tray icon with quota tooltip/menu; monitoring continues when the window is closed.
- Automatic provider reads at least 60 seconds apart per account, plus manual refresh.
- Up to 24 hours of observed quota history and comparable 1/3/6-hour changes in percentage points.
- Configurable per-account, in-app low-quota alerts.
- Device-code login with copyable URL/code, user-selected auth.json import, pause/resume and disconnect.
- Light/dark themes and an app-information dialog.

Quota observations are not token counts or billing totals. Unknown values remain unknown. The desktop app does not provide request relay, load balancing or a reset-voucher redemption control. [Feature semantics](docs/monitor/features.md)

## Platform status

| Target | Status |
| --- | --- |
| macOS Apple Silicon | App launch and DMG/ZIP packaging verified |
| macOS Intel | Build path available; no binary produced or runtime verification in this work |
| Windows 10 / 11 x64 | NSIS packaging and native CI configured; native CI execution and interactive PC verification pending |
| Linux | No current distribution or runtime verification |

Current app version: **0.1.10**. Configured minimum: **macOS 13.3**. Version 0.1.1 adds full-bundle ad-hoc signing. These artifacts are not Developer ID signed/notarized releases and may still require first-launch approval. [Mac installation diagnostics](docs/monitor/macos-installation.md)

## Install or build

If a matching artifact has been published on [Releases](https://github.com/lahuman/Codex_Monitor/releases), quit an older running copy and drag the app from the DMG to Applications. For ZIP, extract and copy the app. Connect accounts from the app's Accounts page; you can copy the login URL into Chrome or another browser.

The following commands are for macOS. See the [Windows guide](docs/monitor/windows.md) for C++ Build Tools, WebView2 and NASM prerequisites.

Source prerequisites: Rust 1.96.0, Node.js >=22.12 (or 20.x >=20.19), Bun 1.3.14 and Xcode Command Line Tools. A Python server and Docker are not required to run the desktop app.

```sh
git clone https://github.com/lahuman/Codex_Monitor.git
cd codex_Monitor/frontend
bun install --frozen-lockfile
cd ../desktop
npm ci
npm run dev
```

To create a local optimized app, DMG, ZIP and SHA-256 checksums:

```sh
cd desktop
npm run package:macos
```

Output: `desktop/releases/<version>/macos-<architecture>/`. Existing release folders are not overwritten. [Development and tests](docs/monitor/development.md) · [Publishing guide](docs/monitor/publishing.md)

## Scope, attribution and license

The repository retains upstream Python/service code and documentation; the default desktop build does not enable `legacy-relay`. The original server quickstart and contributor acknowledgments are preserved in [README.upstream.md](README.upstream.md).

Source basis and dashboard inspiration: **codex-lb**. Visual direction: a user-supplied **Claude.com editorial design reference**. Refactoring principles: **Cursor pstack**. These roles are documented separately in [Provenance](docs/monitor/provenance.md). This is an independent project, with no implied endorsement by OpenAI, Anthropic or Cursor.

[MIT License](LICENSE); the original `Copyright (c) 2025 Soju06` notice is retained. [Documentation index](docs/monitor/index.md)

Windows: [installation and native build](docs/monitor/windows.md). Project website: [GitHub Pages deployment](docs/monitor/website.md). The website becomes public after the Pages workflow is run in your repository.
