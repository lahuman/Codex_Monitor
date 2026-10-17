## Why

Deliver an installable desktop edition of codex-lb with a Rust application
host, a dedicated window and system tray, while preserving the full feature
set of upstream commit `f8ffbac2099a113fba54dfd8d77774f5bca80ffa`.

## What Changes

- Pin the upstream source and build a reproducible, source-derived inventory
  of route declarations, router registrations, configuration, specifications,
  migrations, frontend assets and tests.
- Preserve the upstream React interface and MIT attribution.
- Introduce a desktop lifecycle with explicit start, stop, show and quit actions.
- Validate protocol, authentication, routing, storage, dashboard and background
  behavior against the pinned upstream implementation.
- Track every unimplemented or unverified capability explicitly.

## Capabilities

### New Capabilities

- `desktop-full-compatibility`: desktop packaging and upstream parity gates.

## Impact

The desktop project is separate from REA. macOS arm64 is the initial build
target. Feature parity includes server-oriented capabilities, SQLite and
PostgreSQL; desktop packaging does not authorize silently dropping them.
The user selected a completely Rust backend: the final application SHALL NOT
bundle or start a Python interpreter or Python service. Python source remains
a development reference only. No compatibility claim is made yet.

## Non-goals

- Changing existing upstream feature semantics during the port.
- Treating a source inventory or successful compilation as behavioral parity.
- Reading or migrating real account credentials during development tests.
