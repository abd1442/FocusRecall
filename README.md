<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/focusrecall-lockup-dark.svg">
    <img src="assets/focusrecall-lockup.svg" alt="FocusRecall" width="360">
  </picture>
</p>

<h1 align="center">FocusRecall</h1>

<p align="center">Study timers, recall notes and session history.<br>Choose Quick Mode for the floating timer or Full Mode for the complete workflow.</p>

<p align="center"><strong>Windows · Local-first · GPL-3.0-only</strong></p>

<p align="center">
  <a href="docs/USER_GUIDE.md">User guide</a> ·
  <a href="#a-study-session-from-start-to-finish">How it works</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="SUPPORT.md">Help & support</a> ·
  <a href="https://github.com/abd1442/FocusRecall-Dev">Source code</a>
</p>

> **Pre-release:** beta.29 RC1 is prepared for controlled Windows testing. It has no public download. [Availability](docs/RELEASE_STATUS.md)

![Quick Mode launcher with Biology selected, a 25-minute target, subject search and Start](screenshots/current/quick-launcher.png)

*Quick Mode starts with a subject and a timer. Screenshots use fictional study data.*

## A study session, from start to finish

Choose **Quick Mode** or **Full Mode** during first-time setup, or change it later in Settings between sessions. Both use the same subjects, history and preferences. Existing users start in Full Mode.

### Quick Mode

Choose a subject, adjust **Timer options** if needed, and select **Start**. The floating panel opens automatically.

- **Pause / Resume** stops and continues the same study clock.
- **Next** saves the session and starts another on the same subject.
- **Break**, available while paused, saves the session and opens an optional break. Resume when ready.
- **Finish** saves and stops. Select the subject name and chevron to switch subjects within the session.

Quick Mode has no required preparation, recall, questions, advice or rest. Skipped activities stay unanswered in the record.

### Digital and Circular floating timers

Choose the display in **Settings → Appearance → Floating panel → Timer display**. Digital shows elapsed time or a countdown according to the timer mode. Circular shows time remaining to the target, then overtime. Both use the same session clock and pause/recovery rules.

<p align="center">
  <img src="screenshots/current/quick-digital.png" alt="Digital Quick timer during an actual Biology session, with Pause, Next and Finish" width="310">
  &nbsp;
  <img src="screenshots/current/quick-circular.png" alt="Circular Quick timer showing the same session's remaining target time in a dark theme" width="250">
</p>

Use **Flow** to count up toward a target, **Fixed** to count down, or **Adaptive** for a planning target informed by eligible past focus ratings. These modes plan study time; they do not measure learning.

### Full Mode

Choose a subject and optional session goal, then move through **Focus → Review & connect → Log → Rest**. Preparation, written recall, ratings and a timed rest are optional. The floating Focus panel has distraction, subject-switch and finish controls.

After Focus, you can write or draw what you remember, mark a question for later, review your materials, then save the details you want to keep.

![Full Mode Review and connect with fictional Biology notes and a question to revisit](screenshots/current/recall.png)

[Use Quick Mode or follow a complete Full session →](docs/USER_GUIDE.md#your-first-study-session)

### History and Stats

History keeps sessions, subject time, notes and follow-ups. Stats shows recorded time and lets you inspect conditions and immediate self-ratings with uncertainty explained. Those ratings do not establish retention, mastery or which method works best.

![History after actual Quick and Full sessions using fictional Biology data](screenshots/current/history.png)

### Learn

Learn contains illustrated explanations and **24 research-informed strategies**, with sources and limitations. Browse Explore or save an idea for later. This general guidance is separate from your personal comparisons.

![Learn with the approved illustrations and practical guidance](screenshots/current/learn.png)

## Appearance and languages

Choose from **26 themes**, independent light/dark preferences, or follow Windows appearance. Adjust interface text, floating-panel size and timer display. Subject sorting offers manual order, alphabetical, recently studied and most studied.

Available in **English, العربية, Español, Français, 简体中文, Português (Brasil) and Deutsch**, including Arabic right-to-left layout and keyboard navigation.

![Appearance settings with the Digital and Circular floating timer choice](screenshots/current/appearance.png)

## Privacy and data

- No required account. Records and notes are stored on your computer.
- Window monitoring starts off; window titles have a separate opt-in.
- Backups, reports and sending notes to Obsidian are explicit actions. Other software may sync destination folders.
- Locking Windows, sleep and uncertain interruptions stop automatic study-time credit. Follow the recovery prompt when returning.

Local databases and backups are not encrypted by FocusRecall. Stored window titles can be deleted separately; existing backups and exports are not erased. [Privacy details](PRIVACY.md)

## Getting started

There is no public installer download. If invited to testing, use only the exact approved installer and checksum. The candidate is unsigned; keep Windows security enabled and report unexpected warnings.

- [User guide](docs/USER_GUIDE.md)
- [Updating and protecting records](docs/USER_GUIDE.md#install-update-and-protect-your-records)
- [Availability](docs/RELEASE_STATUS.md)
- [Help and bug reports](SUPPORT.md)
- [Source and contributing](https://github.com/abd1442/FocusRecall-Dev)

## License

Original FocusRecall code is **GPL-3.0-only**. [License](LICENSE) · [Third-party notices](THIRD-PARTY-NOTICES.txt) · [Matching-source information](SOURCE_NOTICE.md)

## Optional support

Donations are optional and do not unlock features or priority support.

<a href="https://ko-fi.com/abd442"><img src="assets/kofi-support.png" alt="Support me on Ko-fi" width="245"></a>
