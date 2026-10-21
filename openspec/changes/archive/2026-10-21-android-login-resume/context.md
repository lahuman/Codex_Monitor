# Verification and limits

The screenshot establishes browser-side authorization success, not app token exchange/storage. The old service retained DeviceFlow only in process memory and the UI erased it after any IPC error. These are verified loss paths; the user's exact phone-side error was not available.

0.1.14 persists Waiting/Exchange/Tokens in the existing encrypted vault, restores pending_login through registered Android/desktop IPC, checks on foreground return, pauses hidden polling and retains the code on transient errors. Manual checking and errors are visible inside the login dialog. Cancellation clears durable state. There is no phone loopback redirect requirement.

Validation: 20 Rust desktop tests; 11 existing provider workflow tests; 1 new real HTTP boundary test covering cold reopen, 503 retries, saved grant exchange without repoll, account storage, encrypted token data and durable cancellation; 59 UI tests covering hidden polling, resume, retry and manual completion. APK ARM64 version/signature verified. Dedicated Android 16 emulator: real provider device-code initialization, force-stop with PID absent, same code digest after reopen, login dialog/manual check restored; code and tokens not printed and QA login cancelled. No personal account authorization was completed. Strict Android spec/change validation and MkDocs build passed.

Expired/consumed remote authorization grants may require a new login. 0.1.13 sessions already lost cannot be recovered. Update 0.1.14 using the same preview certificate and start a fresh login, approve in the browser, return to the app and use manual checking if delayed.
