# ADDED Requirements

### Requirement: Native tests follow the shared application library
Desktop release jobs SHALL run the shared Tauri library tests and server library/login/persistence tests on each native platform before packaging. They SHALL run the complete desktop/mobile dashboard test directory rather than a historical list of files. Publication SHALL remain gated on both native jobs succeeding.

#### Scenario: Shared mobile and desktop entry point
- **WHEN** the executable delegates to a shared library
- **THEN** the native release jobs execute the library's monitoring/history tests rather than reporting success from an empty executable test suite.
