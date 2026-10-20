# beta.29 RC2 — controlled Windows PC test plan

Candidate: **0.1.0-beta.29-rc.2**, Windows x64, intentionally unsigned. This is a test plan, not an installation result or permission to distribute. Asset-rights and public-release holds remain.

## Before starting

Obtain the owner's approval of the exact installer/checksum and the separate test machine before sending or running anything. Use a consenting tester's spare Windows PC/account with only fictional FocusRecall/Learnalyt/Trifocus data. A separate account does not isolate an existing machine-wide installation. If any real records or another person's installation are present, stop. Never copy the owner's profile, backups or recovery files.

Copy only the approved installer, matching source ZIP, SHA256SUMS.txt, notices and this plan. For upgrades, additionally select the genuine beta.27, beta.28 RC2 or RC3 installer from the retained artifacts. The owner should verify hashes before transfer. Do not send entire development folders, unpacked QA builds or fictional QA profiles.

Record Windows edition/build from Settings → System → About, system type, display scale, language, security product and exact candidate version. Screenshots should show only the app/warning, excluding account/device IDs and other windows. Keep antivirus protection on; never add exclusions or disable protection to pass a test. Record unsigned/Unknown publisher/SmartScreen warnings. Stop on a threat detection; do not upload this private candidate to an online scanner.

## Clean installation

1. Confirm there is no existing machine-wide installation or real study data. Run Setup interactively. Check installer language, GPL notice, per-user destination, shortcut choice, cancellation before installation, and the installed version. Check desktop/Start menu/tray/taskbar F/R icons. Record each result as PASS, FAIL or NOT TESTED.
2. First launch must leave foreground tracking and title collection off. Test both first-setup choices on separate clean snapshots/accounts: Full and Quick. Existing profiles should initially remain Full. No sample learning answers should be created automatically.
3. Create subjects “Fictional biology” and “Fictional history”; use a deliberately long third subject. Record colours/order, chosen theme, language, timer display, timer length and Today Check preference. Use no real files, note vaults or external integrations.
4. Quick: start from the launcher using the keyboard. Study for at least two real minutes; use Distracted, wait, Resume, Switch, then Distracted → Break → Resume → Finish. Running controls must be Distracted, Switch and Finish, with no Next. Confirm each subject's observed time and that Quick did not create recall answers/ratings. Test Digital and Circular, compact/normal/maximized main windows, and compact/expanded floating panels. No next session should start without a user action.
5. Full: between sessions switch mode in Settings. Complete preparation → Focus → pause/resume → Recall → log → Rest. Use the exact fictional recall “RC29 retained recall”, a known rating and a note “RC29 retained note”. Record actual elapsed times and saved values. Check that earlier Quick records remain unchanged.
6. Quit via the tray and relaunch. Compare every subject, record, note, rating and preference. Create an app backup in a fictional test folder. Add one extra fictional note, restore the backup through Settings, restart and verify the expected backup snapshot. Restore is intentionally destructive to newer test-only changes; never do this with real data.
7. During a fictional session, close/reopen normally and check recovery; unobserved time must not be credited. On a consenting spare machine, separately lock/sleep/wake and record the last-observed/recovery result against a stopwatch. Never force the owner's machine to lock or sleep.
8. Optional uninstall/reinstall: quit, uninstall normally without selecting data deletion, then reinstall the same RC2. Check that binaries/shortcuts/uninstall entry were removed and the fictional history, preferences and backup survived. Do not manually delete application-data folders.

## Genuine upgrades — separate clean scenario for each version

Use a fresh snapshot or genuinely clean disposable account/machine for each starting installer. Never downgrade a newer database to manufacture an older profile.

- **beta.27 → beta.29 RC2:** create records using the actual old application; checks the older database/preference route.
- **beta.28 RC2 → beta.29 RC2:** checks the repaired legacy-schema path and current identity.
- **beta.29 RC1 → beta.29 RC2:** verify Quick controls, retained Learn completion/bookmark history and independent theme preferences.
- **beta.28 RC3 → beta.29 RC2:** checks the previous frozen candidate's appearance/timer preferences and Full workflow.

In each old build create the same named subjects, known study durations, recall/rating/note, theme and language preferences, and an app backup. Photograph or write down exact sentinel values. Quit via the tray, run the RC2 installer, then verify all sentinels, history totals, privacy defaults/preferences, shortcuts, backup creation/restore and two restarts. Full must remain selected until the tester intentionally changes it. Check existing custom Focus colours and the independent light/dark theme choices. Merely loading a generated historical schema is not proof of a real installer upgrade.

Try cancellation before file replacement and upgrading while the old app has an active fictional session: Setup should refuse/wait, without silently terminating study. If migration fails, stop and retain test files/errors; do not reset data or repeatedly reinstall to hide the failure. Failed-migration injection, forced installer termination, power loss and disk failure require a snapshot VM and separate explicit approval; do not attempt them on a friend's ordinary PC.

## Human release checks and reporting

Check all seven languages, especially Arabic RTL, long subject names, keyboard focus and Timer options/Start visibility. Learn must provide an idea on subsequent configured study days, cycle after all 27 are shown, distinguish previously shown content, and retain existing completion/bookmark records. Appearance must show only the selected mode’s gallery, with both palette preferences retained and Undo available. Check physical Windows scaling 100/125/150/200%, text size, High Contrast, reduced motion and moving between mixed-DPI monitors. Record unavailable hardware/settings as NOT TESTED. Use Narrator/NVDA where available and obtain fluent translation review; automated layout/ARIA/source checks are not certification.

Report exact steps, expected/actual behavior, Windows/build/scale, installer version/hash, warning/error text and app-only screenshots. Keep the fictional backups and old installer until the scenario is reviewed. Do not publish reports containing personal information or distribute the candidate further. Antivirus/EDR, Windows 10 and ARM64-emulation compatibility remain separate checks before support claims.
