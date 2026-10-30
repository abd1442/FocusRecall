# Contributing to A14 Pomodoro

The project is in controlled Windows pre-release testing. Keep changes focused. Nothing here authorizes distribution while the [release gates](docs/RELEASE_STATUS.md) remain open.

## Windows development

Use Windows x64, Node.js 24/npm, Python, MSVC C++ build tools and a Windows SDK. Follow [SOURCE_BUILD.md](SOURCE_BUILD.md) for locked dependencies and matching Node headers. Then run `npm test` and `npm run build`.

Use a fictional profile for development. Never point development or QA at existing study data or a real Obsidian vault:

```powershell
$fixture = Join-Path (Get-Location) 'out/qa-temp/developer-fictional'
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
Set-Content -LiteralPath (Join-Path $fixture 'QA-FICTIONAL.txt') -Value 'A14 Pomodoro fictional profile only'
$env:FOCUSRECALL_DATA_DIR = $fixture
npm run dev
```

Reuse that location only if you know it contains fictional records; otherwise choose a new one. Never stage profiles or private captures.

## Validation

```powershell
node scripts/generate-ipc-schema.cjs --check
node scripts/prepare-legal.cjs --check
npm run localization:check
npm test
npm run build
node scripts/check-repository.cjs
node scripts/publication.mjs --check
```

`pretest` creates the fixture parent on a fresh checkout. Inspector tools require `npm run build:qa`, output `dist/qa/`, an absolute FOCUSRECALL_DATA_DIR and its exact fictional-profile marker. Production refuses marked QA profiles. QA uses a separate Windows shell identity and must never be distributed. Rebuild production after QA. `npm run build:win` writes to `dist/development/`; immutable RC folders are separate. No command publishes or installs automatically. Unsigned packaging instructions disable certificate discovery.

Some historical benchmarks require the maintainer's historical checkpoints; ordinary regression tests must run from the source tree alone.

## Contracts to preserve

- Keep existing profile/database names and production installer identity compatible. Never silently merge/reset profiles.
- Never edit a shipped migration; add a numbered migration with preservation/failure coverage.
- Preserve observed timing, logical sessions/subject parts, explicit tracking consent and title-deletion provenance.
- Keep scientific uncertainty and advice policy consistent: self-ratings are not learning tests or causal evidence.
- Preserve seven languages, keyboard access/RTL, approved themes and Learn content unless explicitly in scope.
- Use fictional records, stop only owned test processes and never copy a live database or remove its WAL/SHM as a backup.

Describe the problem, resulting behavior, relevant checks and data/privacy/external-file implications in a pull request. Distinguish simulated from physical Windows checks.

Original source is GPL-3.0-only. Identify licences and input sources for contributed code/artwork; generated or traced assets are not automatically cleared. Preserve upstream notices. No contribution agreement or ownership transfer is introduced. See [SECURITY.md](SECURITY.md) for sensitive reports.
