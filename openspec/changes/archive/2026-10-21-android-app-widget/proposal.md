# Android independent monitor and widget

## Why
Users need a directly installable Android app and home-screen widget without a running desktop companion.

## What Changes
Add an Android target reusing the Rust service and responsive dashboard, device-code browser login and app-private encrypted storage. Add a native last-observation widget with remaining quota, reset time, voucher count, freshness and tap-to-open. Keep desktop lifecycle and tray behavior unchanged. Produce and verify an installable APK; clearly distinguish preview signing from stable distribution signing.

## Scope
No PC sync, relay, automatic voucher spending or unverified background polling promises. Android may suspend the process; widgets label cached observations and open the app to refresh.
