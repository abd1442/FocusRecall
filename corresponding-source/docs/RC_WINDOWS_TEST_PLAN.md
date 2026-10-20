# Controlled unsigned Windows RC test plan

Decisions: GPL-3.0-only; initial installer unsigned; lock/suspend interrupts observed timing and unobserved locked time is excluded. Signing is not a prerequisite for this candidate. Public distribution still requires the owner's explicit approval.

Use a disposable Windows 11 x64 VM with snapshots and a new local Windows account. Never use the owner's installed app, profile, synced Documents or backups. Keep test artifacts and sentinel records fictional. Copy only the exact candidate, checksums, matching source and an earlier installer into the VM. Hash them before use. Do not upload private binaries to VirusTotal or any online scanner without permission.

## Installation, upgrade and removal — currently requires a tester

1. Snapshot a clean VM. Record Windows edition/build, account type, candidate SHA-256 and security-product versions. Test offline first. The installer is unsigned: record SmartScreen/Unknown publisher behavior; do not disable protection, add exclusions or represent the build as signed.
2. Interactive clean install as a standard user: inspect all seven language choices, GPL notice/Next button, destination selection and desktop-shortcut opt-out. Confirm Start menu/tray identity, normal launch and clean quit. Verify no QA marker, inspector port or automatic foreground tracking/title collection. Check registered uninstall entry and installation scope. A silent success alone does not certify these UI behaviors.
3. In the disposable account's normal app-data profile, create subjects, a manual sort order, notes, recall ratings, title rules, custom Focus colour, a nondefault approved theme, language/RTL and a backup. Record exact sentinel values and database integrity. Do not set profile overrides for this default-profile test. Export only fictional records.
4. Upgrade: restore a fresh snapshot, install an actual older beta, create the same sentinels, quit through tray, then run the candidate installer. Test both an existing Learnalyt/trifocus identity where applicable and the current FocusRecall beta. Verify destination/profile reuse, all sentinel records, migration, rules, themes and backup restore. Repeat with the old app running: Setup must refuse/wait without terminating study. Test cancelled installation and unavailable install destination.
5. Quit. Uninstall normally without any delete-data option. Verify application binaries/shortcuts/registry entry are removed, but study database, backup and preferences remain. Reinstall and compare sentinels. Record actual results; data-retention configuration and archive listing are not proof of uninstall behavior.
6. Optional helper INSIDE a VM: `scripts/windows-install-check.ps1 -DisposableMachine -Phase Install -Installer <older-or-candidate.exe>`. This uses C:\FocusRecall-Install-QA and explicit fictional profile overrides. Create sentinels and quit, then Phase Upgrade with candidate; after manual uninstall use Phase Reinstall. It intentionally cannot certify default-profile discovery, native dialogs or uninstall itself. It refuses host execution unless a VM model is detected; do not bypass the guard.

## Study, tracking and recovery

Run preparation → Focus → pause/continue → Recall → review/log → Rest → next subject repeatedly; include Flow and fixed timer modes, switching subject, drafts, app quit/relaunch and crash recovery. Compare observed durations to a stopwatch; verify no duplicate/lost session. Keep foreground tracking/title collection off initially. Opt in explicitly using fictional windows; test blocked monitoring, rule changes, title deletion, restart and backups. After deletion, a previously unfinished protected session retains recorded automatic evidence but does not automatically classify its newly resumed interval; its visible incomplete-evidence notice remains. Manual distraction logging is available; new sessions are classified normally. Do not infer missing detections as uninterrupted attention.

## Physical Windows checks — not simulated certification

On a spare machine/account using fictional data, separately lock, sleep, hibernate and (if supported) Modern Standby during Focus, Recall and Rest. Test short/overnight gaps, AC/battery, crash during resume, changed clock/timezone, multiple monitors and mixed DPI. Expected: recovery/pause at last observed time; locked/unobserved gap never silently credited. Record stopwatch, before/after history, recovery choice and OS power mode. Do not force host sleep/lock remotely or interrupt the owner's active study.

## Accessibility and language review

Keyboard only: Home calendar is one Tab entry with arrows/Home/End; subject ordering, theme cards and dialogs remain reachable; Escape restores focus; float panels preserve drafts/focus across states. Check Windows scale 100/125/150/200%, text size, high contrast, reduced motion and monitor movement. Use Narrator and NVDA: announce names/states, dialog context, timer transitions, loading/completion/error and Stats worker retry. DOM/ARIA checks are not assistive-technology certification. A fluent reviewer for each of en, ar, es, fr, zh-Hans, pt-BR and de must review normal/error/privacy/science copy; Arabic needs RTL keyboard/layout review. Automated source coverage is not linguistic approval.

## Antivirus / compatibility

In the VM, update signatures, disconnect networking before copying private binaries, and scan the installer, extracted executable and all .node/.dll payloads. Confirm automatic sample submission cannot send the private candidate. Do not change host Defender settings or add exclusions. For offline Defender, an elevated shell may use `MpCmdRun.exe -Scan -ScanType 3 -File <candidate-directory> -DisableRemediation`; capture full output and exit code as well as versions. DisableRemediation scans archives/ignores exclusions and reports detections without remediation; it does not itself guarantee no sample submission. Repeat with an independently configured EDR when available. Test launch and study with protection enabled. No detection on one scanner is not a malware-free or SmartScreen reputation certification.

Primary instructions: [Microsoft scan command](https://learn.microsoft.com/en-us/defender-endpoint/command-line-arguments-microsoft-defender-antivirus). Initial target is Windows 11 x64; Windows 10/ARM64 emulation and enterprise policies require separate testing before compatibility claims.

## Release authorization

Complete required VM/hardware/security checks, review asset rights and matching preferred-source/dependency provision, and resolve material failures before asking the owner to approve public distribution. Keep failed, untested and passed results separate. The unsigned decision is final; do not sign or publish as part of QA.
