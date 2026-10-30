> Current RC decision (18 October 2026): GPL-3.0-only; initial installer unsigned; lock interrupts observed timing. Any older signing prerequisite below is superseded. See [controlled Windows test plan](RC_WINDOWS_TEST_PLAN.md).

# Release security and privacy — 18 October 2026

Production: `npm run build:win`. Do not set FOCUSRECALL_QA_BUILD. Electron fuses disable RunAsNode, NODE_OPTIONS/extra CA overrides and Node CLI inspection, enable embedded ASAR integrity and require app.asar. Packaged startup queries Chromium’s native commandLine.hasSwitch API to reject remote-debugging and known security-bypass switches before opening a data profile. Renderer navigation, IPC roles, sandboxing and context isolation remain enforced. Interactive production windows disable DevTools. Transient report windows keep JavaScript disabled. These are defense-in-depth controls, not protection against an administrator replacing unsigned executable/native files.

QA only: `npm run build:qa` creates `dist/qa/win-unpacked/A14Pomodoro.exe` with QA_BUILD.txt. It has the same application code with a compiled QA constant and inspector fuse enabled. Never distribute it. Runtime environment variables cannot enable this constant in production. Functional inspector tests require this separate artifact. Rebuild production after QA; never package leftover QA output using production configuration. The release verifier checks compiled production profile and actual executable fuses. QA uses the distinct shell/shortcut identity `app.focusrecall.qa`; production retains `app.trifocus.desktop`. Do not register QA shortcuts with the production identity: a stale QA target can otherwise replace the running production app's taskbar icon.

Window-title deletion: Settings > automatic tracking > Delete window titles. Confirm after ending or leaving the current workflow. Logical deletion sets both stored title columns to NULL, switches title collection off and refreshes open data views. It retains app names, timestamps, durations, classifications, confirmations, study notes, recall, settings unrelated to titles, and saved classification rules. No historical statistics are recomputed as part of deletion. Without titles, future title-dependent analyses have less detail. Rules remain separately editable. Backups, exports, synced copies and recoverable disk remnants remain; restoring an older backup can restore titles/preferences. No forensic secure-erasure claim is made.

## Lock/recovery decision for owner review

Retain the accepted policy: screen lock, suspend and uncertain gaps interrupt timing at the last observed point. Continuing excludes the unobserved interval. Reading on paper while locked is therefore not credited automatically. No timing semantics change in this remediation.

Safest practical choices: (1) keep this conservative policy and resume on return (recommended for release); (2) consider a later explicitly self-reported offline-study record, clearly separated from observed Focus time, only after product/scientific review. Automatically counting all locked time would conflate paper study, absence and sleep and is not recommended. Ordinary paper reading while the app remains observable is unaffected. Physical Windows lock/sleep testing remains required.

## Release gates

No public release is authorized here. Review asset ownership, provide publicly accessible matching Corresponding Source and required dependency sources under GPLv3 section 6, verify the signed final artifact, and perform physical Windows lock/sleep and antivirus checks. Do not distribute QA builds, private Git history, study records or local audit/verification archives. GPL-3.0-only is the owner's explicit choice; this document is not legal advice or an additional license condition.

Primary references: [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses), [ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity), [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).

## Independent blocker closure

Packaged QA now requires an existing absolute FOCUSRECALL_DATA_DIR with an exact QA-FICTIONAL.txt marker, outside normal app-data trees. Legacy overrides must agree. Missing/invalid configuration exits before setting a profile or opening SQLite; no fallback is permitted. Production refuses a marked QA root or descendant, including junction aliases. The marker declares fictional data; it is not an OS sandbox for a privileged developer debugger.

Schema 14 adds durable window-title redaction provenance. Automatic derivation and observed switch-counter refresh respect it across rule edits, recovery and session splits. Migration protects earlier NULL-evidence records without reconstructing titles or rewriting their stored results. Individual distraction edits remain available. Already-lost detections cannot be reconstructed; old backups/exports remain independent.

The theme generator and its seed/colour/migration inputs are included in curated Corresponding Source. Copied Electron runtime logs are removed from owned package output and rejected by packaging gates; app/ASAR logs are excluded. The cached development runtime is not modified.
