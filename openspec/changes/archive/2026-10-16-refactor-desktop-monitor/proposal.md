# Monitoring ownership cleanup

## Why
The monitoring app retained compiled relay code and duplicated automatic quota scheduling and error state between its window and native menu.

## What Changes
Exclude retired relay code and dependencies from the desktop build behind an explicit legacy-relay compatibility feature. Put quota scheduling, manual refresh serialization and failure state under one Rust owner. Remove duplicated web scheduling, unused context providers and unrelated account fields. Preserve the current encrypted storage schema and records.
