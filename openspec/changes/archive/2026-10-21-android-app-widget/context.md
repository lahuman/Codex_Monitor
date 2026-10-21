# Context
The user selected phone-only direct login. Reuse the existing Rust business/monitor implementation. The first widget is a truthful last-observation view; no foreground notification service or independent duplicate credential backend is introduced. Background API polling would need a separately verified Android execution lifecycle.

## Verification

Built and installed the 0.1.12 ARM64 APK on a dedicated Android 16 (API 36) emulator. Verified app launch, default 10-minute setting, disabling automatic collection through the real UI, manual collection with no connected account, force-stop/relaunch restoring disabled, native widget pin prompt, actual home-screen widget registration/rendering and tap-to-open. Device-code login initialization reached the real HTTPS provider and displayed the login UI without entering account credentials; the request was cancelled. Real account login completion, quota/voucher collection on an authenticated phone and OEM background behavior remain unverified.

19 Rust tests passed, including a real local HTTP-service workflow proving disabled mode makes no request and a failed automatic attempt respects the 100-minute interval; manual reads still succeed. 57 frontend tests passed. APK signature, package/version (1012 / 0.1.12), single ARM64 ABI, launcher/widget receiver, disabled backup and cleartext policy were checked from the packaged binary. Native debug symbols were stripped by the Android packager, reducing the preview APK from 177 MiB to about 29 MiB. It remains a debug-signed preview, not a stable production signing identity.

Strict validation passes for the Android change and Android main spec. The installed newer OpenSpec validator rejects 62 inherited specs for existing >500-character requirement warnings: baseline is 12 passed/62 failed for 74 specs, changed tree is 13 passed/62 failed for 75 specs. This change introduces no additional strict failures and does not rewrite unrelated specifications. Strict MkDocs build passed.

No personal account, desktop credential store, old release asset, installed desktop app, Git commit/push or public release was changed. Android native project sources are versioned; generated JNI/Wry glue, absolute plugin-path files and build outputs are excluded. Android artifacts are local only and are not added to the existing seven-asset Mac/Windows publisher.
