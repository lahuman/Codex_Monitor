# Menu bar monitoring panel

## Why
Users need readable account labels and quota history without opening the full dashboard.

## What Changes
- macOS two-line menu bar display: nickname (otherwise first three grapheme clusters of email/account ID), then remaining quota. Preserve unknown/stale/paused/error distinctions and bounded account overflow.
- Persist editable account nicknames in the existing monitoring preference owner, backward-compatible with existing files.
- Left click toggles a compact anchored window; right click retains native controls. Panel hides on outside focus and Escape, without opening main dashboard.
- Account selection, recent 1/3/6-hour observed quota decrease in percentage points, 24-hour remaining quota chart, and next quota reset time/countdown.
- Reuse existing snapshot, sampling and chart segmentation; do not infer tokens or fabricate history. Insufficient coverage, resets, gaps and quota changes cannot produce misleading period totals.

## Impact
Rust desktop lifecycle/preferences/menu bar and embedded frontend. No relay or provider polling changes. Windows retains native tray fallback. Installed app/account credentials are not modified by verification.
