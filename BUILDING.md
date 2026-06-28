# Building and Packaging Skillbench

This guide explains how to package Skillbench for production distribution.

## Packaging for your current OS

To build a release binary and installer for your current operating system, simply run:

```bash
pnpm run tauri build
```

The output artifacts (e.g., `.app`, `.dmg`, `.exe`, `.deb`) will be located in the `src-tauri/target/release/bundle/` directory.

## Cross-Compilation

By default, Tauri compiles for the architecture of the host machine. If you need to cross-compile (e.g., building a Windows executable from a macOS machine), we recommend using GitHub Actions or a dedicated CI pipeline.

Tauri provides an official [GitHub Action](https://github.com/tauri-apps/tauri-action) that simplifies cross-compilation and automated releases.

## Code Signing

To distribute the application without users encountering OS security warnings (like macOS Gatekeeper or Windows SmartScreen), you must sign your binaries.

- **macOS**: Provide your Apple Developer certificates via environment variables (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`).
- **Windows**: Provide your Authenticode certificate.

Refer to the [Tauri Code Signing Documentation](https://tauri.app/v1/guides/distribution/sign-macos) for detailed instructions.
