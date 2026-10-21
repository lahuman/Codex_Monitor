# Context

The user authorized committing/pushing the whole completed project and publishing macOS/Windows installers. Prior Android previews were attached to an older base commit because source upload had not been authorized. This release commits the canonical native Android project and specifications. Android 0.1.21 remains an existing separate preview; desktop-v0.1.21 is built from the new pushed commit. No existing tag/asset is moved or replaced. Actual Windows installation/login remains separate from native CI tests.

Static checking also exposed mobile-only cadence methods compiled into the ordinary desktop library and a test module preceding production items. Gate mobile methods on android-worker or test, and move the menu tests to the end; runtime behavior is unchanged.

The workflow integration target requires the `legacy-relay` feature; native release jobs explicitly enable it for server tests only. Default desktop app features remain unchanged.
