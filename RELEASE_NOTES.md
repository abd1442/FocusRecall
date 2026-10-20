# FocusRecall — Beta 1

I made FocusRecall for my own studying: a timer beside my work, a place to write what I remember, and a history I can return to. **Beta 1 is the first public beta.** It is free, has no paid features or app account, and keeps study records locally unless you choose to export or share them.

## Download

Choose the download for your computer. The application version is **0.1.1-beta.1** on every platform.

| Computer | Download | Status |
| --- | --- | --- |
| Windows x64 | [Windows installer](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/FocusRecall-Beta-1-Windows-x64-Setup.exe) | Established Windows baseline; unsigned |
| Ubuntu 24.04 x64 | [Linux DEB](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/FocusRecall-Beta-1-Linux-x64.deb) | Experimental; real GNOME/KDE testing needed |
| Mac with an Apple chip | [Apple Silicon app ZIP](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/FocusRecall-Beta-1-macOS-arm64.zip) | Experimental; real Mac testing needed |
| Mac with an Intel processor | [Intel app ZIP](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/FocusRecall-Beta-1-macOS-x64.zip) | Experimental; real Mac testing needed |

[Source-revision manifest](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/RELEASE-MANIFEST.json) · [SHA-256 checksums](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/SHA256SUMS.txt) · [Matching source materials](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/FocusRecall-Beta-1-Source.zip) · [Licenses and notices](https://github.com/abd1442/FocusRecall/releases/download/v0.1.1-beta.1/FocusRecall-Beta-1-Notices.zip)

No AppImage is offered in this round because normal startup verification is incomplete. These are normal applications, not internal QA launchers. Use fictional data on a test computer/account for this beta; back up existing records before an upgrade.

## A few things to try

- **Quick Mode:** choose a subject and start with the floating timer. Use Distracted/Resume, Switch or Finish. Preparation, recall and rest are not required, and Finish does not silently start another session.
- **Full Mode:** follow Focus, recall, reflection and rest, with preparation and suggestions where enabled.
- Choose the **digital or circular floating timer**.
- Use **Learn**, notes and History; explore Stats as a description of recorded experiences, not proof of lasting retention or which study method teaches you best.
- Choose from **26 themes and seven languages**, including Arabic RTL.
- Save and restore a **local backup** in Settings.

[The main-page guide](https://github.com/abd1442/FocusRecall#two-ways-to-study) explains the workflows in more detail.

## Install and get started

**Windows:** download and run the x64 installer. It is unsigned and Windows may show an unknown-publisher or SmartScreen warning. Check the checksum and publisher context before deciding whether to run it. Keep Windows/antivirus protection enabled. Stop and report a threat detection; do not disable protection. Older internal test installations should be backed up before upgrading.

**Linux:** on an Ubuntu 24.04 x64 test computer, open the DEB with your package installer, or use `sudo apt install ./FocusRecall-Beta-1-Linux-x64.deb`. Other distributions have not been verified. Real GNOME/KDE sessions, X11/Wayland window behavior, tray support, scaling and physical lock/sleep/wake need testing. Timing may refuse to start if lock state cannot be observed safely; History and Learn remain available.

**macOS:** choose Apple Silicon or Intel in About This Mac, extract the ZIP and move `FocusRecall.app` to Applications on your test Mac. These builds are ad-hoc signed, **not Developer ID signed or notarized**. macOS may show an unidentified-developer/unverified-app warning. After checking the exact download, trusted apps may have a per-app Open Anyway option in Privacy & Security ([Apple’s instructions](https://support.apple.com/en-ie/102445)). Do not disable Gatekeeper or override malware/damaged-app warnings. Real opening, Dock/menus, scaling, accessibility and physical sleep/wake still need testing.

On first launch, choose Quick or Full Mode, your language and a fictional subject. Try a short session, restart, check History/preferences and test a backup/restore using fictional records.

## Current limitations

Linux and macOS passed native builds and automated checks, but **this beta does not claim full platform or hardware compatibility**. Physical sleep/hibernate, screen readers and all display configurations are not certified. The Windows owner reported successful testing on a second PC; exact coverage of every upgrade and power-state case was not recorded.

Foreground-window tracking is **unavailable on Linux/macOS**. On Windows it is optional and off by default, with a separate opt-in for titles. Lock, sleep and ambiguous gaps must not silently become Focus time.

## Tell me what happened

[**Report a beta problem**](https://github.com/abd1442/FocusRecall/issues/new?template=beta-test.yml)

Include your OS/version, app version, what you were doing, what went wrong and how to reproduce it. Screenshots are optional. **Issues are public: do not attach personal study records, private backups, window-title history or sensitive logs.** Use fictional examples and crop screenshots to the relevant app area.

Thanks for trying FocusRecall. A short description of what you tried and what happened is useful.

<details>
<summary>Exact source revisions and licenses</summary>

FocusRecall is **GPL-3.0-only**; component licenses remain applicable. The attached source materials include build/native inputs, editable artwork/theme sources, dependency inputs, component notices and pinned runtime source-access directions. No private repository access is needed.

The release tag identifies an assembled release manifest and source snapshots. It does **not** claim the platform applications were built from one common source commit.

| Download | Actual application source commit |
| --- | --- |
| Windows x64 | `822068b128b47e3cff3627082ee0e336dfa17d71` |
| Linux x64 | `f583c7de992dfbf8edfe3f20bc369c0f26567112` |
| macOS Apple Silicon | `8bdc835e3e7f7f5a7fa1c62c829c9b2d2f2addca` |
| macOS Intel | `f93d7991d4ba52335cfdbc72d536fdd0eb76fcb6` |

The Mac implementations are the same; Intel’s revision additionally adjusts a cold-start deadline in the verification script. No application code or security protection was changed for that retry. Each final file is mapped to its build revision and SHA-256 in the release manifest. GitHub’s automatic source ZIP/tar contains the per-platform application snapshots. Use the attached source materials for the additional dependency/runtime sources and build directions. This is source availability alongside the binaries, not source on request.

</details>
