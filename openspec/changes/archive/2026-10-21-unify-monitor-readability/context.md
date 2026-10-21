# Application readability

Account management consumes canonical quota_windows rather than reconstructing periods from provider JSON. A shared QuotaWindow and quotaTone scale (50/25/10 percent) own presentation. isCurrentObservation gates quota color and health across dashboard and management. Paused, failed, future and stale observations retain their values with muted styling.

Phone body/support text is at least 12px. Desktop content uses 13–14px labels, sans-serif headings and consistent cards. All app dialogs use a scoped MonitorDialogContent wrapper so portal rendering cannot escape touch target and viewport-height rules. Phone controls are at least 44px high. Login has one primary browser action followed by recheck; destructive confirmation stays separate. History axes use HTML labels so SVG downscaling cannot shrink text. Menu panel keeps compact 12px supporting text.

Example: a weekly-only account shows its canonical weekly bar in account management even when raw provider JSON uses a primary slot. An HTTP error leaves the last percentage visible but muted. No provider, authentication, scheduling or persistence behavior is changed.

Verification: 67 frontend tests passed, changed TypeScript ESLint passed, production build passed. Headless Chrome rendered dashboard, account management, settings, login, delete confirmation and quick view; 16 final screen checks at 360/380/390/850/1200px reported no horizontal page/dialog overflow, no mobile controls below 44px and no runtime errors. Short login at 360x440 remains scrollable and cancellation reachable. Light/dark, long account names and history axes inspected. Existing Vite chunk-size advisory remains. Real phone font scaling/manufacturer behavior and Windows/macOS native packaging are not verified in this change.

Android 0.1.16 APK signature/version verified and update-installed over 0.1.15 in the dedicated Android 16 emulator. Native WebView shows the compact dashboard without overflow and a 44px brand target. All 75 specs pass the available strict validator; strict MkDocs build passed.
