# Context

The previous 68dp reset column and 9.5sp single-line text passed the default emulator font but truncated in the supplied Samsung screenshot. Text must own enough width rather than forcing smaller fonts. Actual native measurement replaces the guessed 19+32dp account height; bitmaps are reused while selecting up to four rows. Physical Samsung verification remains unavailable.

## Verification

Android 16 emulator: 10 instrumentation tests pass in 4.252s. The RemoteViews regression covers 81 combinations (160/420/480 dpi × 180/280/360 dp widths × font scale 1.0/1.3/1.5 × overview/bars/rings) at 320dp height. Assertions cover complete text layout, width, all line heights, ancestor clipping, and actual scaled text size. Normal-font 280×180 two-account compactness, compact 180×160 bars/rings, unknown/future observations, and a 200% font resize hint also pass. Screenshots inspected for normal, 150% and resize states. No real Samsung phone, non-default Samsung typeface, CPU/peak-memory comparison or provider login was tested in this change. Rendering still uses no periodic job; view inflation is bounded to at most four overview candidates and reuses bitmaps.
