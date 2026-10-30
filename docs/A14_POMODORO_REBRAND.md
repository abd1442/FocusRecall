# A14 Pomodoro rebrand — 30 October 2026

The owner selected **Countdown Corner**, option 1 of the simple badge concepts. Current application branding is **A14 Pomodoro**. The approved A14 badge and outlined Pomodoro wordmark use navy `#233957`, gold `#F0B35B` and white. The sidebar adapts foreground/background to the selected theme while retaining the gold accent.

## Changed surfaces

Application HTML/window titles, sidebar and collapsed rail, About/support/legal copy, tray identity and menu, startup/recovery messages, study help, report headings, backup and appearance export dialogs, seven language catalogs, installer copy, executable/shortcut/uninstall display names, repository documentation and current artwork. The old active F/R resource files are retired outside the packaged resources. The full wordmark uses the approved Bahnschrift SemiBold outlines, with no distributed font software.

## Compatibility

The Windows application identity `app.trifocus.desktop`, existing Learnalyt/Trifocus profile/database filenames, 14 migrations, appearance format, Obsidian markers, legacy drawing prefixes and diagnostic/QA identifiers remain stable. Own-process filtering recognizes both A14Pomodoro.exe and previous executables. The installer refuses to proceed while any current or previous study executable is running. No study profile is copied, renamed, merged or reset. New drawing files use the URL-safe `A14Pomodoro-` prefix; existing attachment links are reused.

## Verified

- Complete regression suite: **90 files / 1,200 tests passed**, including old-schema data, backup restoration, old/new drawing reuse and persisted identity checks. The Windows sandbox initially blocked temporary-cache renames and junction fixtures; the suite passed using a workspace cache and the required native permissions.
- Both TypeScript checks and the production renderer/main/native build passed.
- Strict seven-language checks passed: **2,965 normalized copy keys**, no missing static entries, no unresolved generated prose; authored Advice/Learn checks passed.
- Separate packaged QA app, fresh marked fictional profile: actual window/application titles, Home branding in light/dark, 900-pixel windows, collapsed badge, all seven About screens including Arabic RTL, navigation and session entry/finish. **Zero captured renderer errors and zero network requests.** Initial harness selectors were corrected to use the existing About button; the final run passed.
- Nine ICO sizes: **16, 20, 24, 32, 40, 48, 64, 128, 256**. Transparent master corners checked. Embedded app and installer 32-pixel icons match the export with **zero differing pixels**.
- Separate unsigned installer candidate built as `A14-Pomodoro-0.1.5-beta.2-setup.exe`. All **119 installer payload files** match the production package byte for byte. Setup was extracted for inspection and **was not executed**.
- The final production executable passed the existing native fuse/debugger rejection checks in isolated fictional profiles. The final current/legacy identity and attachment compatibility check passed **17 tests** after the tray branding adjustment.

## Release boundaries and limits

This is an **unreleased branding update based on version 0.1.5-beta.2**, not a new release announcement. The earlier FocusRecall Beta 1/Beta 2 tags, assets, hashes and source mappings remain unchanged. Current development source must not be described as matching those already published binaries. Existing Linux/macOS snapshots retain the branding they actually shipped with.

No real-user installation, in-place upgrade, uninstall/reinstall, Windows shortcut/pinned-icon migration, code signing, physical assistive-technology certification or independent trademark clearance was performed. Native installation/scope/shortcut tests remain required before distributing a new branded release. Windows may cache old pinned shortcut icons. Do not delete profiles to resolve shell branding.

The working development folder keeps its existing filesystem name to preserve local tool paths. Internal compatibility namespaces, immutable earlier releases and clearly identified historical design/audit records intentionally retain prior names.
