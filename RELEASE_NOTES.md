# FocusRecall — Beta 2

**Version 0.1.5-beta.2 · Windows x64 · Prerelease · Unsigned**

Beta 2 focuses on safer study records, accessible controls and smoother study/review workflows. Your records stay local; no account or cloud service is required.

## Downloads

- [Windows x64 installer](https://github.com/abd1442/FocusRecall/releases/download/v0.1.5-beta.2/FocusRecall-Beta-2-Windows-x64-Setup.exe)
- [Matching source and dependency materials](https://github.com/abd1442/FocusRecall/releases/download/v0.1.5-beta.2/FocusRecall-Beta-2-Source.zip)
- [Licenses and notices](https://github.com/abd1442/FocusRecall/releases/download/v0.1.5-beta.2/FocusRecall-Beta-2-Notices.zip)
- [SHA-256 checksums](https://github.com/abd1442/FocusRecall/releases/download/v0.1.5-beta.2/SHA256SUMS.txt) · [Source/binary manifest](https://github.com/abd1442/FocusRecall/releases/download/v0.1.5-beta.2/RELEASE-MANIFEST.json)

This release updates **Windows only**. Experimental [Linux and macOS downloads remain at Beta 1](https://github.com/abd1442/FocusRecall/releases/tag/v0.1.1-beta.1); they have not been relabeled or rebuilt as Beta 2.

## What changed

- Protected active study sessions from History edits/deletion, and prevented overlapping time corrections from inflating totals.
- Added **Save for later** to Recall and the session log. Typed notes, drawings, added subjects and unanswered suggestions survive deferral and resumption.
- Made **Review later** available without opening writing controls, and added a consistent recall-then-check instruction.
- Kept the timer visible in the Quick Mode study card and explained when Adaptive uses the default target. Preparation settings now reflect the selected study mode.
- Preserved History searches, views and filters across tabs. Added **Show more** beyond 100 matching saved notes.
- Added confirmed deletion of standalone local notes; existing Obsidian exports remain untouched.
- Fixed History external-note opening and detected Markdown changes made by another editor while preparing an Obsidian export.
- Corrected mixed-subject attribution in the recall/next-session understanding chart. Time and self-ratings remain records of activity/experience, not proof of mastery or causal effects.
- Fixed Settings accessible names, translated functional labels and keyboard focus restoration across seven languages, including Arabic RTL.
- Improved narrow-window/high-zoom navigation, disclosure readability, Home space allocation, the optional daily goal and floating-timer behavior.

## Before updating

Use **Settings → Back Up Data** and keep that backup. Back up your Obsidian vault separately. Quit FocusRecall completely through its tray icon, then run the installer. Keep the existing installation scope and data folder; do not delete profiles or database files to update. Start with fictional records on a test machine/account when possible.

The installer is **unsigned**, so Windows may show an unknown-publisher/SmartScreen warning. Keep security protections enabled. Stop and report a threat detection rather than disabling protection.

## Verification and remaining limits

**Passed:** 90 test files / **1,199 tests**; production build and typechecks; strict seven-language copy checks; isolated Electron study, deferral/recovery, notes and keyboard checks; zero unnamed General Settings controls in all seven tested accessibility trees; native high-zoom layout checks; all **126 embedded installer files** match the production package. The exact curated source is rebuilt and compared against the installer build inputs.

**Not completed for this candidate:** clean-install and actual Beta 1 upgrade/uninstall/reinstall testing, physical sleep/hibernate/monitor/DPI transitions, native screen-reader certification, long endurance testing or a learning-effectiveness study. Chromium accessibility-tree checks are not native assistive-technology certification. Other editors can still race after the final Obsidian file comparison; attachment and Markdown updates are not a multi-file transaction.

Use fictional examples when reporting bugs. Include the version, Windows version, exact steps and error; do not post databases, backups, private notes or window titles. [Report a problem](https://github.com/abd1442/FocusRecall/issues/new?template=beta-test.yml).

Original project code is **GPL-3.0-only**. Matching editable application/build inputs, unchanged locked runtime dependency/preferred-source materials and pinned runtime access directions accompany this release. A full recursive Chromium rebuild and independent artwork/trademark clearance are not claimed. Earlier published records document the owner's F/R logo authorship confirmation; Beta 2 introduces no replacement logo.
