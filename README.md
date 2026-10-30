<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/a14-pomodoro-lockup-dark.svg">
    <img src="assets/a14-pomodoro-lockup.svg" alt="A14 Pomodoro" width="320">
  </picture>
</p>

<h3 align="center">A study timer with recall notes and a private record of your study.</h3>

<p align="center">
  Time a subject in a small floating panel, write down what you remember, and come back to it later.<br>
  Your records stay on your computer.
</p>

<p align="center">
  <sub><b>Windows · Linux · macOS</b> &nbsp;·&nbsp; <b>Development source, based on 0.1.5-beta.2</b> &nbsp;·&nbsp; <b>7 languages</b> &nbsp;·&nbsp; <b>GPL-3.0-only</b></sub>
</p>

<p align="center">
  <a href="#two-ways-to-study">Modes</a> &nbsp;·&nbsp;
  <a href="#a-full-mode-session">Study cycle</a> &nbsp;·&nbsp;
  <a href="#the-floating-timer">Timer</a> &nbsp;·&nbsp;
  <a href="#history-and-notes">History</a> &nbsp;·&nbsp;
  <a href="#stats">Stats</a> &nbsp;·&nbsp;
  <a href="#learn">Learn</a> &nbsp;·&nbsp;
  <a href="#themes-text-and-language">Themes</a> &nbsp;·&nbsp;
  <a href="#privacy">Privacy</a> &nbsp;·&nbsp;
  <a href="#backups-and-updates">Backups</a> &nbsp;·&nbsp;
  <a href="#downloads">Downloads</a>
</p>

<br>

<p align="center">
  <img src="assets/readme/hero.png" alt="A14 Pomodoro Home with the Building Physics subject selected, a 25-minute Flow target, the session goal Work one U-value example by hand and a three-hour daily study goal, beside the floating circular timer showing 22:26 of 25:00">
</p>

<br>

You choose a subject and start a timer. A small floating panel keeps time while you work in your book, browser or editor. When you finish, A14 Pomodoro can ask you to write down what you remember before you look back at your material, then keeps the session, your notes and anything you marked to revisit.

Use as much or as little of it as you like. Notes, ratings, rest timers and automatic tracking are all optional, and you never need an account.

<table>
  <tr><td><b>Two modes</b></td><td>Quick Mode is a timer and nothing else. Full Mode adds recall, a short reflection log and timed rest.</td></tr>
  <tr><td><b>Floating timer</b></td><td>Digital or circular. Mark distractions, switch subjects, finish.</td></tr>
  <tr><td><b>Recall notes</b></td><td>Typed or drawn, searchable in History, with follow-ups marked for review.</td></tr>
  <tr><td><b>Study records</b></td><td>A calendar of study days, a daily goal, History, Library, and Stats that separate time from learning.</td></tr>
  <tr><td><b>Learn</b></td><td>One short idea about studying each day, with the research behind it and its limits.</td></tr>
  <tr><td><b>Local and private</b></td><td>No telemetry, ads, cloud sync or account. Verified backups in one click.</td></tr>
</table>

<br>

## Downloads

**A14 Pomodoro is the new name of FocusRecall.** The source on `main` and every screenshot on this page show the A14 Pomodoro branding update, which has **not been released yet**. The downloads below are the builds already published, and they still carry the **FocusRecall** name and logo. The rename does not touch those files.

[**Download FocusRecall Beta 2 for Windows x64**](https://github.com/abd1442/A14-Pomodoro/releases/tag/v0.1.5-beta.2)

Version **0.1.5-beta.2** improves session safety, accessibility, draft recovery, History, notes and Quick Mode. It is an unsigned Windows prerelease. [Changes and verification limits](RELEASE_NOTES.md) · [Matching source](SOURCE_NOTICE.md) · [Checksums](SHA256SUMS.txt).

Experimental **Linux and macOS remain on [FocusRecall Beta 1](https://github.com/abd1442/A14-Pomodoro/releases/tag/v0.1.1-beta.1)**. They have not been rebuilt or relabeled as Beta 2.

Back up your records and quit through the tray before updating. Clean-install/actual Beta 1 upgrade and physical Windows/assistive-technology checks remain uncompleted for this candidate. See the release notes before use.

[Report a beta problem](https://github.com/abd1442/A14-Pomodoro/issues/new?template=beta-test.yml). Issues are public; use fictional examples and never attach personal study records, private backups or sensitive logs.

## Two ways to study

<p align="center">
  <img src="assets/readme/modes.png" alt="Quick Mode launcher with Building Physics ready at a 25-minute Flow target beside the subject list, next to Full Mode Home with timer options, a session goal, the daily study goal and the study calendar">
</p>

|  | Quick Mode | Full Mode |
| :-- | :-- | :-- |
| **Start** | Pick a subject, press Start | Pick a subject, set an optional goal, press Start |
| **While studying** | Distracted · Switch · Finish | Distracted · Switch · Finish |
| **After Focus** | Saved. Take a break if you want one | Optional recall notes, session log and timed rest |
| **Extras on Home** | None, just the launcher | Study calendar, daily study goal, stage line |

You choose a mode during setup and can change it later in **Settings** between sessions. Both modes share the same subjects, History, Stats, Learn and Library, and switching never rewrites your records.

### Quick Mode in five steps

1. On Home, select or create a subject. **Timer options** changes the target and timer type.
2. Press **Start**. The floating timer opens.
3. Pulled away? Press **Distracted** to stop the focus clock and **Resume** to continue, without a reason question. Reasons can be edited later in History.
4. To change subjects, open the subject name on the panel, pick another and confirm **Switch now**. Each subject keeps its own time.
5. Press **Finish** to save and stop. Nothing else is required.

While paused, **Break** saves the session and offers a break timer. When the break ends, studying does not restart until you press **Resume**.

<br>

## A Full Mode session

Full Mode walks through one study cycle. Every step after Start can be skipped.

<p align="center">
  <img src="assets/readme/workflow.png" alt="The five stages of a Full Mode session: plan with a subject, timer and goal; focus with the floating circular timer; recall notes about how insulation changes a wall's U-value, rated Most, with a follow-up marked for review; a reflection log with activity, focus and understanding answered; and a five-minute rest counting down in the main window and the floating panel">
</p>

**1 · Plan.** Select a subject on Home and choose a timer:

- **Flow** counts up past a target marker, for when you want to keep going while it's working.
- **Fixed** counts down from the time you have.
- **Adaptive** suggests a target from your recent sessions on that subject. You can override it.

A short, specific goal helps: *"Explain how insulation changes a wall's U-value"* is easier to check afterwards than *"Study building physics"*. It stays attached to the session.

**2 · Focus.** Work wherever you normally do. The floating timer stays on top so you can see time and mark interruptions without switching windows. Details are in [The floating timer](#the-floating-timer).

**3 · Recall.** After Focus, try to explain what you remember *before* checking your notes. Optionally start a short review timer, then **Type notes** or **Draw notes**, or use paper. Write the main idea and one thing you're unsure of. **Review later** turns that uncertainty into a reminder you can find in History. Rating how much you could recall is optional.

**4 · Reflect.** *How did it go?* asks a few optional questions, such as what you did, how focused you were and how well you understood it. Choose which questions appear in **Settings → Log questions**.

**5 · Rest.** Pick a rest length and press **Start rest**. The main window and the floating panel both count down. Rest is recorded separately and never counts as focus time. When it ends, start another session or choose **Finish studying**.

<details>
<summary><b>More about the cycle</b>: preparation, Today Check, keyboard shortcuts and short sessions</summary>
<br>

- **Get ready.** If preparation is turned on, a short panel appears before the timer starts.
- **Today Check.** The optional check-in at the top of Home can be answered or skipped. **Skip for today** hides it until local midnight, even after a restart. Settings can hide it permanently without erasing earlier check-ins.
- **Ctrl+Enter** continues from review or the log when the next action is available. Check the visible button first.
- **Very short sessions.** If you finish very quickly, A14 Pomodoro asks whether to keep the session. Choose **Keep it** if it belongs in your history.
- **Locking or sleeping Windows** interrupts timing. The gap is not counted as focus; follow the prompt when you return.

</details>

<br>

## The floating timer

<p align="center">
  <img src="assets/readme/timers.png" alt="Four floating panels from one Building Physics session: a digital timer at 02:06 of 25:00, a light circular timer at 22:26 of 25:00 and a dark circular timer at 22:25 of 25:00, each with Distracted, Switch and Finish, and a rest countdown at 04:43 of 05:00 with End rest and Start next session">
</p>

| Control | What it does |
| :-- | :-- |
| **Distracted** | Stops the focus clock while you're away. **Resume** (Quick) or **Back** (Full) continues the same session. |
| **Switch** | Moves to another subject without ending the session. Time is kept per subject. |
| **Finish** | Ends Focus. Quick Mode saves; Full Mode moves on to recall. |

- Choose **Digital** or **Circular** in **Settings → Appearance → Floating panel**. Circular shows time left to the target, then overtime. Size and opacity are adjustable.
- During rest the panel counts down the break and offers **End rest** or **Start next session**.
- Drag the panel anywhere. If you close it, **Panel** in the sidebar or **Show timer** brings it back.
- Every panel action is also available from the main window, by keyboard.

<br>

## Home tools

These live on the Full Mode Home screen.

Current source removes Parked Thoughts and the automatic reason question after Resume. The calendar spans the bottom of Home and stays visible while subjects scroll. These changes are not yet included in the Beta 1 downloads; [view the Beta 1 guide](https://github.com/abd1442/A14-Pomodoro/blob/v0.1.1-beta.1/docs/USER_GUIDE.md) for that version.

**Saved for later.** If you put off an unfinished review, log or rest, it appears here with a **Resume** button. Time while the app was closed is not counted as rest.

**Study calendar.** The full-width calendar stays at the bottom while the subject list scrolls. Each square is a day, shaded by recorded focus time. Select a day to open it in History. With the keyboard, arrow keys move between days and Enter opens one.

**Daily study goal.** Set a target in hours. The card on the right of Home fills with the Focus time recorded since your study day started, and its small plant grows with it. Rest does not count.

**Stage line.** The line under a subject, such as *First 20 hours*, shows time invested in it, including earlier hours you entered yourself. It measures time, not skill. Labels and boundaries can be changed in Settings.

Subjects can be grouped into categories and sorted by **Manual**, **Alphabetical**, **Recently studied** or **Most studied**.

<br>

## History and notes

<p align="center">
  <img src="assets/readme/history.png" alt="History for the last 30 days grouped by day, with sessions, quality labels and recall-note excerpts, beside the To review list headed by the follow-up about a brick wall with 50 and then 100 mm of mineral wool" width="820">
</p>

Filter by dates, subject, category or activity, and open any session with **View session**. Search covers recall and session notes. **Saved notes** collects everything you wrote; **To review** lists the follow-ups you marked. **Library** groups material by subject.

To keep a note in Obsidian, choose **Obsidian / save note** and pick a destination. Your vault needs its own backup, since A14 Pomodoro backups don't include it.

<br>

## Stats

<p align="center">
  <img src="assets/readme/stats.png" alt="Stats for the last three months of fictional records: 115 hours 21 minutes recorded, labeled as activity and not a measure of learning, recent activity, subjects studied, and two study-pattern cards on paused time and interruptions, one marked early pattern and one well-supported pattern" width="760">
</p>

Stats starts with what was recorded: time, sessions, subjects and recent activity. **Adjust filters** shows exactly which days and subjects are included, and **Saved views** keeps a filter setup for later.

When you have enough comparable sessions, Stats can compare conditions. Each pattern says how much evidence stands behind it, from *early pattern* to *well-supported*, and Stats says plainly when the evidence isn't there yet. Keep three things apart when reading it:

| What Stats shows | What it can't prove on its own |
| :-- | :-- |
| Time spent | That you learned |
| How a session felt | That you'll remember it |
| Patterns between sessions | What caused them |

To judge learning, test yourself on the material later. A timer and a self-rating can't replace that.

<br>

## Learn

<p align="center">
  <img src="assets/readme/learn.png" alt="Learn Today showing the idea Familiar is not remembered, an illustration comparing studying with and without notes, a suggestion for the next session, and the Research and limitations section" width="700">
</p>

**Today** shows one idea about studying, with a short explanation, a suggestion to try in your next session and a **Research and limitations** section. **Explore** lets you browse all 27 ideas and **Saved** keeps the ones you bookmark. **Another idea** offers something new, then cycles back through ideas you've already seen.

<br>

## Themes, text and language

<p align="center">
  <img src="assets/readme/themes.png" alt="A14 Pomodoro Home shown half in the light Ivory and Ink theme and half in the dark Ink Dim theme">
</p>

Open **Settings → Appearance** and choose **Light**, **Dark** or **Follow Windows**. A14 Pomodoro remembers one light and one dark theme, so following Windows switches between your two choices. There are **26 themes**: 11 light and 15 dark. A theme applies immediately, with a brief **Undo**.

- **Text & size** adjusts interface and writing text separately. **High contrast** works with any theme.
- **Floating panel** sets the timer style, size and opacity.
- **Languages:** English, العربية, Español, Français, 简体中文, Português (Brasil) and Deutsch. Arabic uses a right-to-left layout.

<details>
<summary><b>See the theme gallery</b></summary>
<br>
<p align="center">
  <img src="assets/readme/theme-gallery.png" alt="Theme settings: Follow Windows selected with the eleven light themes and Ivory and Ink in use, then the fifteen dark themes with Ink Dim in use" width="760">
</p>
</details>

<br>

## Privacy

<p align="center">
  <img src="assets/readme/privacy.png" alt="Automatic tracking settings, switched off, with window-title recording as a separate unchecked option, a Delete window titles button and the status Off, no foreground collection" width="760">
</p>

- Study records stay on your computer. There is **no telemetry, advertising, cloud sync or automatic update check**, and no account.
- **Automatic tracking is off** by default. If you turn it on, it samples app names during Focus and Rest only. It never captures keystrokes, screenshots or page content.
- **Window titles** are a separate opt-in, because titles can contain private text. **Delete window titles** removes them from your profile and keeps your study history; copies in older backups or exports are not touched.
- Databases and backups are **not encrypted**. Protect your Windows account and wherever you keep backups.

[Full privacy information](PRIVACY.md)

<br>

## Backups and updates

<p align="center">
  <img src="assets/readme/backup.png" alt="Backup and restore settings after Back Up Data, with the message Backup created and verified, Restore Backup, Open backup folder, Show saved backup and an Open demo data option" width="760">
</p>

**Settings → General → Data → Back Up Data** saves your study records, notes and settings, and checks the backup before reporting success.

Before installing an update:

1. Finish any session in progress.
2. Use **Back Up Data** and keep a copy somewhere else. Back up an Obsidian vault separately.
3. Quit the app from its tray icon, then run the new installer.
4. Reopen it and check your subjects, a recent session and your notes.

Uninstalling keeps your profile. **Restore Backup** replaces the current database after checking the backup and asking you to confirm, and keeps a safety copy of what it replaced. Never delete profile folders or database files to fix a problem; see [troubleshooting](docs/USER_GUIDE.md#if-something-goes-wrong).

<br>

## Install

Use [Downloads](#downloads) for Windows; Linux/macOS remain on the Beta 1 release. These installers are the published FocusRecall builds, so the installed app and its shortcuts show the FocusRecall name. Follow the instructions for the version you download. Windows uses an unsigned x64 installer; Ubuntu 24.04 x64 uses a DEB; Macs use the Apple Silicon or Intel app ZIP. Linux/macOS remain experimental. Keep security protections enabled and report warnings instead of overriding malware or damaged-app alerts.

On first launch, pick Quick or Full Mode and your language. To look around before adding your own subjects, choose **Open demo data** in **Settings → General → Data**. It opens a separate database of made-up study and leaves your own records untouched.

<br>

## Help

| If… | Then… |
| :-- | :-- |
| Your study data won't open | Stop. Keep the original files and backups, note the exact message and [ask for help](SUPPORT.md). Don't reset anything. |
| Windows or antivirus shows a warning | Keep protection on and note the warning and installer version. |
| The app keeps running after closing | Quit from the tray icon, especially before updating. |
| Stats shows no comparison | Check the filters. Early records may not be enough yet. |
| Text or the timer is too small | **Settings → Appearance → Text & size** or **Floating panel**. |

The [user guide](docs/USER_GUIDE.md) has every screen in detail and more troubleshooting. For a bug report, include the app version, operating system/version, the steps and the exact error, and never attach your database, backups or vault. [Help and bug reports](SUPPORT.md) · [Security reports](SECURITY.md)

<br>

## Source and license

A14 Pomodoro's original code is licensed **GPL-3.0-only**. [License](LICENSE) · [Third-party notices](THIRD-PARTY-NOTICES.txt) · [Source package information](SOURCE_NOTICE.md) · [Application source and build guide](corresponding-source/SOURCE_BUILD.md)

Use the source package and release tag that match your download; different platforms were built from different source revisions. The source on `main` is the unreleased A14 Pomodoro branding update based on 0.1.5-beta.2. It is not the source of any published installer. Beta 2 and Beta 1 source stay available at their release tags, as explained in [SOURCE_NOTICE.md](SOURCE_NOTICE.md).

Screenshots show the current development source running with a fictional profile: made-up subjects, sessions and notes. They are unedited captures, cropped and arranged for this page. [How they were made](screenshots/readme-captures/manifest.json).

---

<br>

<p align="center">
  <a href="https://ko-fi.com/abd442">
    <picture>
      <source media="(max-width: 600px)" srcset="assets/support-a14-kofi-banner-mobile.png">
      <img src="assets/support-a14-kofi-banner.png" alt="Enjoying A14 Pomodoro? If you find it useful and would like to show a little appreciation, you can buy me a coffee on Ko-fi. It’s completely optional." width="620">
    </picture>
  </a>
</p>
