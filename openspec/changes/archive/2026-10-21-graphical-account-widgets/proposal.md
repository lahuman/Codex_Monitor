# Graphical account widgets

## Why
The current home widget concatenates long account text and cannot select an account. Graphical quota summaries and independent widget configuration improve scanning without extra provider requests.

## What Changes
Add per-widget account selection, rings/bars, system/light/dark themes and hidden-name mode. Summary displays up to four accounts according to available height. Persist stable account identity, handle removal and widget restore, and use native configuration/pin flows. Extend token-free snapshot to bounded 100-account catalogue matching the service account limit.

## Impact
Android native widget presentation and Rust widget projection; no new collection scheduling, dependencies, credentials or provider transport.
