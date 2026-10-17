# Change: Monitor banked reset credits

## Why
Account monitoring needs available banked limit-reset voucher counts and expiry dates, distinct from paid usage credits and scheduled quota resets.

## What Changes
Read provider reset-credit detail alongside automatic/manual quota observation, preserve partial counts when detail fails, and show account-scoped counts and expiry dates. No redemption endpoint or control is introduced. Reuse authenticated read transport and existing scheduling; do not change credential or history schemas.

## Impact
Rust provider GET contract, in-memory monitor snapshot, frontend account card and regression coverage.
