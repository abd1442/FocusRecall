# Learnalyt user guide

Study, reflect and explore your own patterns. This guide covers the Windows beta candidate, version 0.1.0-beta.1. Screenshots come from the actual packaged app with **fictional demo records**, in light and dark themes. They do not show a real learner's results. [Beta limitations](RELEASE_NOTES.md) apply.

## Find your way

| Destination | Use it for |
| --- | --- |
| Home | Choose a subject, mode, target and goal; daily check-in, parked thoughts and yearly heatmap |
| Library | Categories, subjects, progress, resources and local notes |
| History | Review, search, correct or finish earlier study records |
| Stats | Personal insights, detailed analysis, Your week and report export |
| Settings | Defaults, questions, privacy, backup, appearance and hotkeys |

[Start studying](#start-studying) · [During study](#during-study) · [Recall-log-and-rest](#recall-log-and-rest) · [History and recovery](#history-and-recovery) · [Read your Stats](#read-your-stats) · [Notes and Obsidian](#notes-and-obsidian) · [Backups](#backups-and-restore) · [Troubleshooting](#troubleshooting)

![Home with fictional subjects, timer planning and parked thoughts](screenshots/home-light.png)

*Home in the light theme. The compact year heatmap rests at the bottom of the visible left column. Flexible space separates it from the subject tiles; growing subject lists push it down naturally. Selecting a subject enables Start.*

## Organize your Library

Create a category with **Add category**, then create subjects within it. Categories can contain subcategories. The menus provide rename, move/reorder, archive/restore and deletion actions. Pin a subject for convenient selection. Subject pages hold resources, notes, progress units/total, prior knowledge and learning-stage context.

![Library with four fictional top-level categories and current footer controls](screenshots/library.png)

*Categories group subjects; they are not individual sessions.*

Choose an appropriate progress unit such as pages or exercises. Progress is what you log, not a mastery estimate. Prior hours/knowledge help the app interpret learning stages; keep these approximate values honest.

Archive hides an item from ordinary active selection while keeping records. **Delete category** removes its grouping and moves subjects to the parent or Uncategorised; it preserves their history and notes. Other deletion actions can remove records: read the confirmation and take a backup before irreversible corrections. Block-owned notes follow a historical subject correction; subject-only notes stay with their subject.

Add a resource as a URL or file path. Opening it delegates to Windows or your browser. Local file paths work only where those files exist; avoid sharing private paths in issue reports.

## Start studying

Select a subject on Home, choose a mode and target, and optionally enter a small session goal. More options provide activity/setup context. The three modes offer different planning displays:

| Mode | What to expect |
| --- | --- |
| Flow | Counts upward toward the target and can keep going past it |
| Fixed | Countdown planning around a chosen target |
| Adaptive | Uses qualifying previous study to suggest a target; the UI distinguishes actual samples from example dots/defaults |

| Flow planning | Fixed planning | Adaptive planning |
| --- | --- | --- |
| ![Flow](screenshots/mode-flow.png) | ![Fixed](screenshots/mode-fixed.png) | ![Adaptive](screenshots/mode-adaptive.png) |

Adaptive is a planning aid, not a prediction of learning quality. The target is not a forced end to study. You control when to finish.

Press **Start**. With preparation enabled, a separate preparation sheet opens before time is recorded.

![Actual preparation sheet showing optional checks, a recall tip and Ready button](screenshots/preparation.png)

*Checks are optional and transient. They are not stored as completed habits.*

Tick anything useful and press **Ready to start**. **Cancel** abandons the unstarted preparation while preserving the plan/goal. The timer starts only after Ready. The two defaults are phone away/silenced and distracting apps/tabs closed. Up to five extra checks appear only when your recent records show repeated positive focus or recall patterns for the selected subject and activity, such as a particular drink or study place. Blue side markers identify personal suggestions. Select **Why these?** for the supporting patterns. New or sparse histories show only the defaults. Water is not a fixed reminder.

Personal checks use active categorical setup/detail choices from the last 90 days, exclude untouched answers and mixed-subject sessions, and need comparable records on both sides across multiple days with the direction repeated over time. They describe associations, not proof of cause or health advice. Checks do not record answers, change your planned setup or log a drink automatically. Settings can disable preparation; older custom checklist text is retained in saved settings. General learning tips rotate separately from these personal checks.

The preparation sheet uses interface scale, independently of the small timer's size setting. It should return to the saved timer dimensions/position afterward. Multi-monitor movement/focus/scale behavior still needs native release verification.

## Floating controls

Keep Learnalyt within reach while you work in another app.

| Before starting | During study |
| --- | --- |
| ![Floating ready panel](screenshots/floating-ready.png) | ![Running floating timer](screenshots/floating-timer.png) |

Press **Start** to prepare, then **Ready to start** to begin timing. Use **Distracted**, **Switch** and **Finish** from the running panel. Its thought icon parks a thought; the main study screen keeps only the three session controls.

## During study

![Running Flow timer with Distracted, Switch, Park a thought and Finish session](screenshots/focus.png)

*The short elapsed time is an actual fictional QA session, not a manufactured study result.*

**Distracted** pauses focused time; **Back** resumes it and can ask for a reason. A long absence may prompt you to continue or end where you left. Manual distraction recording works even when automatic tracking is off.

**Switch** changes subjects without ending the logical session. Learnalyt records separate subject parts with one continuing session/target. A sitting can contain multiple sessions and intervening rest. These distinctions matter when correcting timelines or interpreting comparisons.

**Park a thought** saves something for later without stopping the clock. Home, Focus and the expanded panel expose parked thoughts. Repeated exact text is grouped for presentation; original capture IDs/session links remain. Complete an individual oldest capture or explicitly complete repeats, then use Undo if needed. Search/expand to manage longer lists.

Optional **stuck** and **resisted distraction** markers record moments for later reflection. Enable/configure them in Settings. The floating timer and tray provide controls while you work in another app. Closing the main window during an active stage can hide it to the tray; use the tray to return or quit deliberately.

Default shortcuts are **F8** Distracted/Back, **F10** Switch and **F7** Park a thought. Stuck/resisted are unassigned by default. F9 is not assigned. Settings can change/disable shortcuts; another app may already own a key. While the main Focus screen has focus and no text input/dialog is active, Space also toggles Distracted/Back.

## Recall, log and rest

Press **Finish session** to move to recall. Very short sessions can first show **Keep it / Discard**; Keep it continues with that actual duration.

![Actual recall screen after keeping the short fictional session](screenshots/recall.png)

*Write or draw what you remember. A rating left at its default is distinguished from one you answered.*

Use **Type / Draw**. The whiteboard supports pen/highlighter/eraser, colours/widths and Undo/Redo/Clear; text and drawing can coexist. Recall text autosaves as you write; drawings remain editable stroke data with a preview. Mark something to review and optionally write what needs attention. **Save / send notes** opens a local/external note destination. Physical pen pressure/palm rejection depends on your device and remains a manual check.

If you forgot a subject switch, use **Studied more than one thing? Add subject**, then review the resulting dividers/times in the logging/timeline view. Do not treat the initial even split as your actual timing without correcting it.

![Current logging screen with configurable study questions](screenshots/log.png)

*Questions depend on your configuration and scope. Answer what you want to use in later comparisons.*

Continue to the log and save activity, progress, goal result and selected question answers. Untouched/default answers are tracked separately; they are not automatically evidence of your opinion. Configure groups, fields, options, named sliders and question scope/frequency in **Settings → Log questions**. Previews are examples and do not write History.

Next comes planned rest. Record what actually happened or skip it. Planned rest is not measured recovery; rest comparisons use recorded actual rest. Continue to another session or end the sitting. Optional music/chime controls are in Settings and can depend on your Windows/media setup.

## History and recovery

![Fictional session history with recall and saved notes](screenshots/history-notes.png)

![History showing fictional sessions and their subject/time details](screenshots/history.png)

*Search and filters narrow records; review markers help find unfinished follow-up.*

History supports session search, filters, exact-session jumps, review flags, grouped log values and time corrections. Open a session to review recall/log/notes and its timeline. Correct timestamps/dividers or split a part when needed; pauses should intersect the actual subject extents. Delete only the intended part/session after reading its confirmation. Back up before substantial edits.

Subject corrections move block-owned notes atomically. Invalid dates are rejected before a correction commits. Subject-time totals use the actual parts, including switched sessions; outcome comparisons exclude mixed-subject sessions. Check the selected scope before comparing time and ratings.

After interruption, the app offers recovery for running work and unfinished recall/log/rest. Choose **Resume** to continue, or **Leave for later** to keep it pending in History. Persisted drafts survive restarts; unsaved forms elsewhere may not. Unstarted preparation is abandoned on restart without a study session. Recovery excludes application downtime. Related records and saved workflow state commit together, so a failed transition can be retried.

## Check in and follow your study day

Use **Check in** on Home for daily answers, or **Skip today**. Daily fields and session fields can have different scopes. Change the study-day boundary and week start in Settings to fit your schedule. A study day can differ from the calendar date.

An unsaved check-in spanning rollover keeps an explicit choice between the old and new study day. Physical sleep/wake and timezone changes still require release checks. History groups a sitting by its start day; daily statistics use part-start day, so cross-boundary views may differ.

![Home yearly heatmap with fictional focused study time](screenshots/heatmap.png)

*Use the year arrows and day details to explore recorded focused time. The heatmap is not a learning score.*

## Read your Stats

![Personal insights comparing sound, location and session length from fictional records](screenshots/insights.png)

*These associations belong to the generated fixture. They are not recommendations derived from your data.*

Stats opens with **Your insights**. Adjust date, subject/category and activity filters, then inspect each card's evidence using hover, focus or click; Escape closes evidence. Read coverage and sample/day context before acting. Rating differences are **focus/recall points**, not percentage gains in learning. Longer time does not mean better learning.

Answered outcomes are eligible by default; **include untouched** is an explicit analysis choice. Personal outcome comparisons exclude mixed-subject sessions. Pattern gates generally require five eligible observations on three days per side; stronger repeated patterns require twenty on eight days with consistent temporal direction. These are exploratory heuristics, not calibrated confidence or causal proof. Sleep comparisons operate at day/cohort level; duration comparisons account for mode/target; recorded actual rest is distinguished from planned rest.

Detailed sections remain visible: Overview, Subjects, What affects my study, My best setup, Time patterns, Study rhythm, Distractions, Rest, Methods, Learning stage, Timer modes and Report. Scroll the section navigation horizontally if necessary. Each section has its own questions/outcome controls. A subject filter can mean **sessions containing that subject**, and detailed time attribution has an open mixed-session limitation. Library's subject-part totals and whole-session comparisons answer different questions.

Sparse or missing answers may yield no insight. Try recording consistent answers across several days rather than filling old defaults to make a chart appear. Large histories may take time to analyze; no universal instant-performance claim is made.

## Your week, experiments and saved views

![Your week showing day totals, previous-week comparison and mixed-subject time](screenshots/week.png)

*Your week is an ordinary Stats section. The screenshot's in-progress week should not be compared as a completed week.*

Choose a week to see daily time, previous-week comparisons, subjects, answered outcomes and overlapping experiment results. Reflection is optional/collapsed. Review or edit the next-week experiment suggestion before saving; it is an idea, not a prescription. Weekly subject time buckets mixed sessions separately.

Open **Experiments** in the Stats companion to plan one change on one subject, with baseline/change/end dates, outcome and observations. Results use existing eligible logs and exclude mixed sessions; insufficient data suppresses a difference. Before/after differences can reflect other changes, so treat them as associations.

Use **Saved views** to save filters/analysis choices and the comparison outcome. Relative dates follow the calendar; custom dates stay fixed. Closing/switching the companion preserves drafts while Stats stays mounted; **save** for restart persistence. Removing a saved view/experiment removes the plan, not underlying sessions.

In **Report**, export PNG, Markdown or PDF. Preview the scope and inspect for private titles/notes before sharing. Reports are separate files and are not included in database backups.

## Notes and Obsidian

In **Library → subject → Notes**, choose **Write a note**, or open **Save / send notes** from recall. Type/draw, choose a destination and save. **Save locally** keeps content in Learnalyt. External sending saves locally first; failure leaves a local note for retry. Notes are not automatically sent to a cloud service. Notion synchronization has been removed; old local notes remain.

![Successful save to an isolated Demo Vault](screenshots/obsidian.png)

For Obsidian:

1. Choose the vault folder/name in Settings's Notes area or the editor. Use a disposable vault when testing.
2. Choose a Markdown file inside it or enter a relative file such as `Study/Practice.md`.
3. Optionally enter the exact heading. A missing heading can be created; blank adds at the end.
4. Save/send to write the Learnalyt entry and optional drawing PNG. Later sends update its marked entry while retaining unrelated file content.

Keep Learnalyt's HTML markers if editing the file manually. Direct writes reject parent traversal and linked paths. Back up your vault separately, particularly if another app edits the file concurrently. Obsidian need not run for file writes, but its installed URI handler and vault name must work for **Open external note**.

Changing a destination clears its old external link. A new link becomes available after a successful send. Retry a failed send after resolving access/path problems; the local note remains saved.

## Backups and restore

Search Settings for **Back Up Data**, **Restore Backup** or **Open backup folder**. Back Up Data creates and validates a SQLite snapshot while the app is open. Before pending migrations, Learnalyt keeps the latest three successful automatic snapshots; manual/safety backups are not automatically pruned.

Restore validates integrity/schema/relations, rejects incompatible/corrupt backups, asks for explicit confirmation, takes a safety snapshot and restarts. Finish or leave active workflow work for later and wait for note writes first. Restoring replaces newer database content with the selected backup; save work and keep the safety backup.

| Included in database snapshot | Back up separately |
| --- | --- |
| Saved sessions, subjects, recall/logs, local notes/drawings, settings/presets and tools | Obsidian Markdown/PNGs, exported reports, `config.json` demo choice, Chromium/Windows state, unsaved forms |

Normal profile: `%APPDATA%\Learnalyt`. Backup folders are `backups/<database-name>/automatic`, `manual` and `safety`. Personal/demo backups are separate. Never delete live WAL/SHM files or manually replace an open database. A startup failure does not reset data; keep the folder/backups and use the offered backup-folder access. A full corrupt-original cold-start restore wizard is not provided.

## Appearance and settings

![Current Settings page with search and illustrated defaults](screenshots/settings.png)

*Search jumps to relevant controls; illustrated samples do not become study results.*

Use **Appearance** for light/dark/system, independent accents, high contrast, timeline colours, interface/writing/panel sizes, fonts, shape and density. Expand custom options for exact colours/fonts and saved presets/import/export. Custom low-contrast combinations can warn. Installed fonts depend on your computer. Timeline colours apply consistently across subject history/live bars. Reduced-motion behavior follows Windows preferences.

Choose interface size to enlarge the app; writing size and timer panel size are independent. The default timer-mode setting includes real/examples distinctions for Adaptive. Question previews and rest calculators teach behavior without modifying your records. Form dialogs contain keyboard focus, support Escape and restore focus on closing. Screen-reader and device-specific behavior still need manual verification.

Automatic tracking is off by default. If you opt in, foreground process/window titles can be recorded locally; they may contain sensitive names. Disabling stops collection and keeps previous records. Do not attach window-title history or a personal database to a public issue. Local-first does not mean encrypted.

## Study reminders

![Study reminder settings and a focus window from a fictional study fixture](screenshots/reminders.png)

In **Settings > Study reminders**, enable either type independently. Both are off on a new or upgraded profile:

- **Daily study reminder:** choose a local time. While you are active on the PC and free of study/rest, one notification can appear at that time or within the following hour. It does not replay missed days. Your chosen daily time can be at night; personal quiet hours do not override it.
- **Personal study reminders:** an occasional prompt during a two-hour window associated with higher answered focus ratings in the last 90 days. The comparison balances recorded subject/activity groups and must repeat in earlier and later records. With insufficient, stale or conflicting evidence, no personal reminder appears. Windows are associations, not guaranteed best times or medical advice.

Personal reminders are limited to one per local calendar day. All automatic reminders have a four-hour gap between attempts. A personal reminder is held back near the daily time. **Quiet hours** affect only personal nudges; **Pause 1 hour**, **Pause today** and **Resume reminders** affect both. Pauses and delivery-attempt history survive restarting the app, including after Windows declines a notification. A failed attempt is not repeatedly retried that day.

No reminder is sent during focus, preparation, recall, logging, rest, an open sitting, a locked/idle PC, or while you are using Learnalyt's main window. Activity detection uses only Windows active/idle status; it does not read app names or window titles and does not enable foreground tracking. Reminder text contains no subject names or note contents. Clicking a notification opens Learnalyt without starting a timer.

With either reminder enabled, closing the window keeps Learnalyt running in its tray. **Quit** in the tray stops reminders. Open the app again after Windows restarts; no login startup task or OS scheduled wake-up is installed. Reminders cannot run when Learnalyt is fully closed or the PC is asleep.

Use **Test notification** to check delivery without consuming your daily reminder. Windows notifications, sound permissions, Do not disturb and installation identity can affect what you see or hear. An OS delivery acknowledgment does not prove a banner was visible. Reminders remain local and use no network service.

## Troubleshooting

| Problem | Practical next step |
| --- | --- |
| Start unavailable | Select an active subject; resolve current/recovered work first |
| Timer seems to disappear | Return through tray/Panel; check minimize/automatic panel preferences |
| Shortcut does nothing | Check Settings and conflicts with another Windows app |
| No insight appears | Check filters, answered coverage and sufficient observations across days |
| Unexpected subject total after a switch | Check actual part times and selected filters in History and Stats |
| Note send fails | Local copy remains; check vault permissions/file/heading and retry |
| External note does not open | Verify the destination, successful send and installed Obsidian URI handler |
| Data seems missing after update | Keep `%APPDATA%\Learnalyt`; check personal versus demo mode and do not reset/delete files |
| Startup cannot open data | Keep data and backups; use backup-folder access and request help with a fictional reproduction |
| Windows warns about publisher | Current installer is unsigned; obtain approved distribution/build provenance and do not disable protection |
| No reminder appears | Enable a reminder, leave Learnalyt running in its tray, return to an active/unlocked PC and check pauses, Windows notifications and Do not disturb. Personal nudges also need sufficient focus records; use Test notification to check delivery |

For a bug, include version, Windows version, timer mode and minimal fictional steps. Redact screenshots; never upload your database, vault or secrets. See [Support](SUPPORT.md) for sensitive reporting and [beta limitations](RELEASE_NOTES.md) for checks still pending.
