# Home and distraction workflow update — 21 October 2026

- Removed Parked Thoughts from Home, the floating timer, hotkeys, Settings, session review, statistics, IPC and demo generation.
- Retained the legacy database table, original rows and obsolete stored settings for backup/restore compatibility. No destructive migration or profile access is required.
- Expanded Full Mode's calendar across the content width in a reserved footer outside the subject scroller. Small screens retain horizontal calendar scrolling, arrow-key navigation and one calendar Tab entry. Quick Mode's minimal launcher is unchanged.
- Removed the automatic distraction-reason question after Resume and subject switches. Actual distracted time is still recorded, and reasons remain editable in History. Long-absence, lock/suspend and recovery safeguards remain.

Verification: 1,162 regression tests; strict seven-language checks; normal native-helper compilation and production packaging; 29 production-security probes; 63 packaged cases spanning seven languages, 26 themes, narrow/normal/wide windows, interface scaling, real elapsed Quick/Full pauses, legacy-data backup and restart. Screenshots were inspected in light, dark and Arabic RTL. Scaling is software verification, not physical Windows DPI or assistive-technology certification.

This is an unreleased source update. The public Beta 1 tag, installers, matching source packages and checksums remain unchanged. Linux/macOS binaries have not been rebuilt for this change.
