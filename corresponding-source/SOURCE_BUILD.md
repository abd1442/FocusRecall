# Build the macos-arm64 snapshot

Exact original source revision: `5a79f3b9b8d9c99e85a4e43d2e19eadf2e129d7f`. No private Git history is included.

Use the corresponding native host/architecture, Node 24, locked dependencies (`npm ci`), compiler/Python tools required by node-gyp, then `node scripts/prepare-legal.cjs` and `node scripts/build-platform.cjs darwin arm64`. The script compiles SQLite from source for Electron and packages without publishing. It refuses a Windows toolchain or the wrong architecture. Never set FOCUSRECALL_QA_BUILD for a distributable build.

Linux: this snapshot supplies the verified DEB. Its AppImage is not a released download; use the newer port work to investigate AppImage separately.

Mac: the bundle is ad-hoc signed, not Developer ID signed/notarized. No Apple account is required to reproduce this internal beta. Signing credentials are not included or needed.

Shared exact dependency inputs, preferred upstream archives and runtime source directions are in the top-level dependency-inputs and source-provision folders.
