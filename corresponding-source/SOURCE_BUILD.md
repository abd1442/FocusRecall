# Building the unsigned Windows release candidate

License: GPL-3.0-only for FocusRecall original code; preserve the supplied component notices. This source snapshot contains the preferred editable application/native/theme sources, assets, lockfile and build/install scripts. SOURCE_MANIFEST.json in the exported snapshot identifies its exact Git commit and file hashes. The private Git history and fictional/personal profiles are excluded.

## Toolchain and build

The candidate was built on Windows 11 x64 with Node 24.16.0, npm 11.13.0, Electron 44.7.2, Python and Visual Studio C++ build tools. Use a disposable Windows build machine. Internet access is required for locked npm packages, Electron and native build headers unless locally cached. Matching inputs do not guarantee byte-identical PE/NSIS output: timestamps and toolchain versions can vary. Verify functionality and fuses after rebuilding.

```powershell
npm ci
```

Cache the Node headers/import library used by the standalone Node-API sampler. `npm ci` can use prebuilt SQLite bindings without populating this cache, so do not assume a fresh machine already has it:

```powershell
$nodeVersion = node -p "process.versions.node"
$headerCache = Join-Path $env:LOCALAPPDATA 'node-gyp/Cache'
node node_modules/node-gyp/bin/node-gyp.js install --target=$nodeVersion --devdir=$headerCache
$env:FOCUSRECALL_NODE_HEADERS = Join-Path $headerCache $nodeVersion
npm run localization:check
npm test
npm run build
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
node node_modules/electron-builder/cli.js --win --publish never --config.directories.output=dist/unsigned-rc
```

Do not set FOCUSRECALL_QA_BUILD for production. Do not configure signing keys. The Windows-native foreground module builds from native/ using build:foreground; its scripts explain compiler/header requirements. Installer hooks and license navigation sources are under build/. This package does not contain private certificates or a signing requirement. No installation-information restriction is imposed.

For local inspector workflows use `npm run build:qa`, never the public installer. QA requires an explicit absolute fictional directory containing QA-FICTIONAL.txt with `FocusRecall fictional profile only`; a Chromium profile junction cannot escape that directory. Production refuses marked QA profiles. Do not distribute the QA executable. Rebuild production after QA before packaging another installer.

## Generated application inputs

`node scripts/generate-themes.mjs` regenerates 26 theme seeds and legacy migration from the included docs/design/theme-system-2026/tools/ and tokens/ sources. `node scripts/generate-ipc-schema.cjs` regenerates the IPC contract. `node scripts/prepare-legal.cjs --check` checks runtime notices. No Learn content or statistical algorithm is regenerated from private evidence.

## Dependency source provision

package-lock.json pins build/runtime npm tarballs and integrity hashes. `node scripts/prepare-dependency-sources.cjs publication-local/dependency-inputs` additionally downloads and verifies the 46 exact runtime package tarballs referenced by resources/legal/inventory.json, without running their scripts. These are useful reproducible inputs; compiled npm JavaScript is not necessarily every dependency's preferred upstream source.

Electron/Chromium/native runtime source provision must accompany the eventual distribution as appropriate. Electron's source is [electron/electron at v44.7.2](https://github.com/electron/electron/tree/v44.7.2); its DEPS pins Chromium and dependent revisions. Follow [Electron's source build instructions](https://www.electronjs.org/docs/latest/development/build-instructions-gn) using that tag, not the moving main branch. SQLite's bundled C source and native binding build inputs are in the verified better-sqlite3 npm source tarball. React, Recharts and other packages identify upstream repositories in their package.json files.

Before public binary distribution, finish the preferred-source and third-party source availability review, provide clear matching source download directions beside the binary under GPLv3 section 6(d), and retain access for as long as required. Do not describe an npm cache or list of URLs as a completed legal compliance review. No source has been published by this preparation step. See [the Windows test plan](docs/RC_WINDOWS_TEST_PLAN.md) for outstanding tests.
