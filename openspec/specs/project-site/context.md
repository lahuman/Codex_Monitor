# Project site context

The static introduction uses relative assets for repository-base-path hosting. Its version and icon come from desktop sources; example quota values never originate from real account state. MkDocs documentation is retained below `/docs/`, with a single workflow owning the combined deployment.

Local validation includes responsive browser checks and links in the built artifact. The user will upload the source and configure Pages; no public deployment is claimed before that workflow succeeds.

Example: `/Codex_Monitor/` serves the introduction, while `/Codex_Monitor/docs/monitor/windows/` explains native Windows packaging.

The introduction now explains independent two-row macOS account menu items, remaining-quota colors and the compact voucher popup. Its interval examples distinguish observed 1/3/6-hour percentage-point changes from token counts. Both platform buttons lead to Releases; native packaging automation does not establish real-device installation verification. The Mac guide explains ad-hoc signing and missing notarization, while publishing guidance covers manual pre-release promotion.

Example: a 49% remaining sample is yellow, a 72% sample is green, and switching the illustrative period updates quota, reset text, interval samples and menu colors together. Six-hour history across a reset is marked unavailable.

Canonical distribution links use the exact `Codex_Monitor` case from `desktop/scripts/project-links.mjs`. Version 0.1.11 refreshes download cards, Mac offline/native Installer resources and Windows NSIS header/sidebar/homepage metadata. Old release assets remain immutable. Source SVGs accompany the committed 24-bit NSIS BMPs (150x57 header, 164x314 sidebar); raster artwork was rendered at 1x from the SVG and converted to RGB BMP with Pillow, with no added runtime/build dependency. The Pages workflow checks build_type=workflow before uploading/deploying, requiring the owner to disable branch-based publishing in Settings.
