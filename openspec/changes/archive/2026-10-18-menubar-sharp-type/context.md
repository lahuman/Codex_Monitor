# Verification and scope

Root cause: deprecated lockFocus rasterization followed by 24pt-to-22pt NSImage resizing. The renderer now retains an NSImage drawing handler at the final 22pt size, with 7pt regular account labels and 12pt medium (0.23) quota values. No post-rasterization resize remains. The source change is confined to the macOS native rendering owner and its font descriptor feature.

Offscreen production AppKit before/after images were drawn at standard and 2x destination scale in Aqua and Dark Aqua, with fictional GE/69% and SM/85% account data. Visual inspection confirmed sharper glyph edges, reduced quota weight, small regular labels, normal quota contrast and red urgent nicknames. The enlarged Retina comparison is docs/monitor/assets/menubar-sharp-type.png. The old image resamples cached raster pixels at 2x while the new recipe draws at destination scale. This is a drawing verification, not actual installed-menu clicking or recipient-machine execution.

Rust: all 17 existing tests passed, preserving click identity/status/expiry and monitoring ownership semantics. Check and Clippy with warnings denied passed. TypeScript/Vite production build passed through packaging; frontend source is unchanged, so prior 53 frontend tests were not repeated. Strict validation passed for the active change and all 74 main specs. MkDocs strict and 89 document/source/image links passed.

Optimized 0.1.7 arm64 DMG and ZIP built successfully with four packaging tests passing, app signature and archive verification, read-only DMG verification, and verified native installer payload/progress choice. The app remains ad-hoc signed, installer unsigned, without notarization. Windows and recipient installation were not tested. Existing installed apps, account stores, old releases, commits and remote state remain untouched.

No polling changes. No CPU/memory or completed-task performance benchmark was run; visual quality, not a measured speedup, is the outcome.
