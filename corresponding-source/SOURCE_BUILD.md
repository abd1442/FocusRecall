# Build the linux-x64 snapshot

Exact original source revision: `6fef041b68cf80ef3701a5e2945b1de2ac5eb78e`. No private Git history is included.

Use the corresponding native host/architecture, Node 24, locked dependencies (`npm ci`), compiler/Python tools required by node-gyp, then `node scripts/prepare-legal.cjs` and `node scripts/build-platform.cjs linux x64`. The script compiles SQLite from source for Electron and packages without publishing. It refuses a Windows toolchain or the wrong architecture. Never set FOCUSRECALL_QA_BUILD for a distributable build.

Linux: this snapshot supplies the verified DEB. Its AppImage is not a released download; use the newer port work to investigate AppImage separately.

Mac: the bundle is ad-hoc signed, not Developer ID signed/notarized. No Apple account is required to reproduce this internal beta. Signing credentials are not included or needed.

Shared exact dependency inputs, preferred upstream archives and runtime source directions are in the top-level dependency-inputs and source-provision folders.
