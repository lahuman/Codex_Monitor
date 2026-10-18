# Menu bar voucher details and urgent account labels

## Why
Users need voucher count/expiry information in the compact menu-bar panel and an account-specific red name when an available voucher expires within one day.

## What Changes
- Reuse the existing voucher detail component in a compact panel section.
- Derive menu/panel label urgency once in Rust from existing voucher observations; serialize validity/deadline facts for the panel to expire cached warnings safely.
- Color only the affected native account nickname red for future deadlines <=24h, preserving larger normal quota text, account-specific clicks and native appearance contrast.
- Suppress current alerts for zero/unknown counts, inconsistent detail counts, failed/stale/future observations, paused accounts and unavailable/undated/elapsed vouchers. Known partial details may warn.

## Impact
Desktop monitor projection, native presentation and compact panel. No redemption, notifications, provider requests, credential changes or automatic installation.
