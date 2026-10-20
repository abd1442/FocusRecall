// Prepare only user-facing files in a new local distribution folder.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const version=require('../package.json').version,tag=version.replace('0.1.0-','').replace('.',''),label=version.replace('0.1.0-','');
const output=path.resolve(process.env.FOCUSRECALL_PUBLICATION_OUTPUT||'publication-local/focusrecall-distribution-'+tag);if(fs.existsSync(output))throw Error('Use a fresh output folder.');fs.mkdirSync(output,{recursive:true});
const installerName=path.basename(JSON.parse(fs.readFileSync('dist/focusrecall-'+tag+'/verification.json','utf8')).artifacts.find(a=>a.file.endsWith('.exe')).file);
const releaseHeading=version==='0.1.0-beta.24'?'FocusRecall 0.01 Beta\n\nInternal build: '+version+'.':'FocusRecall '+version+' — Windows beta';
const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.writeFileSync(path.join(output,file),text)};
const copy=(source,file)=>{fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.copyFileSync(source,path.join(output,file))};
const guideText=fs.readFileSync('docs/USER_GUIDE.md','utf8');
const illustration=(file,alt)=>`![${alt}](screenshots/${file}.png)`;
const guideImages={
 'Organize your Library':illustration('library','Subjects and categories in the Library'),
 'Start studying':['Flow','Fixed','Adaptive'].map(m=>illustration('mode-'+m.toLowerCase(),m+' timer planning')).join('\n\n'),
 'Floating controls':illustration('preparation','Optional preparation before starting'),
 'During study':illustration('focus','Study session controls'),
 'Recall, log and rest':[illustration('review-optional','Optional review timer and recall guidance'),illustration('rest-running','Rest timer and a suggestion away from screens'),illustration('next-session','Confirm the subject and begin the next session')].join('\n\n'),
 'History and recovery':illustration('history','Search and revisit previous sessions'),
 'Read your Stats':illustration('stats-time','Time patterns from fictional study records'),
 'Your week, experiments and saved views':illustration('weekly-review','Review a study week and its supporting records'),
 'Appearance and settings':illustration('settings','Settings with search and clear categories'),
 'Make FocusRecall yours':`All examples below are captured from the same Windows beta with fictional records. Change colours and corners independently; your study data stays the same.\n\n### Straight or rounded\n\n${illustration('appearance-paper-straight','Paper & Ink with straight corners')}\n\n${illustration('appearance-paper-rounded','The same Paper & Ink workspace with rounded corners')}\n\n### Light, dark and mixed workspaces\n\n${illustration('appearance-graphite','Graphite night: dark sidebar and workspace')}\n\n${illustration('appearance-sage','Sage notebook in dark mode')}\n\n${illustration('appearance-light-sidebar','Light sidebar with a dark workspace')}\n\n${illustration('appearance-dark-sidebar','Dark sidebar with a light workspace')}\n\n### More colour choices\n\n${illustration('appearance-crimson','Crimson accents on a light workspace')}\n\n${illustration('appearance-violet','Violet sidebar with a light workspace')}`
};
const guideTopics=guideText.split(/^## /m).slice(1).map(part=>{
 const at=part.indexOf('\n'),title=part.slice(0,at).trim(),id=title.toLowerCase().replace(/[^a-z0-9 -]/g,'').replace(/ +/g,'-');
 let body=part.slice(at+1).split('\n').filter(line=>!line.includes('screenshots/')).join('\n').replaceAll('../SECURITY.md','SUPPORT.md').replaceAll('](RELEASE_CHECKLIST.md)','](RELEASE_NOTES.md)').replaceAll('](../resources/legal/EULA.txt)','](EULA.txt)').replaceAll('](../resources/legal/PRIVACY.txt)','](PRIVACY.md)').replace(' when a build is available','');
 body=body.replace(/\| Flow planning \| Fixed planning \| Adaptive planning \|\r?\n\| --- \| --- \| --- \|/g,'').replace(/\| Before starting \| During study \|\r?\n\| --- \| --- \|/g,'');
 body=body.replace('Read [Security](SUPPORT.md) for sensitive reports and [release checklist](RELEASE_NOTES.md) for what remains unverified.','Read [Help and feedback](SUPPORT.md) before reporting a problem, and [release notes](RELEASE_NOTES.md) for current limitations.');
 body=body.replace(' Multi-monitor movement/focus/scale behavior still needs native release verification.',' After changing display scaling, check the floating panel position on your chosen monitor.').replace('fictional QA session','fictional demonstration session').replace(' Screen-reader and device-specific behavior still need manual verification.','').replace(' Physical sleep/wake and timezone changes still require release checks.','');
 return '<a id="'+id+'"></a>\n<details>\n<summary>'+title+'</summary>\n\n'+body.trim()+(guideImages[title]?'\n\n'+guideImages[title]:'')+'\n\n</details>';
}).join('\n\n');
const readme=`![FocusRecall](assets/focusrecall-banner.svg)

# Study with focus. Review what you learned.

**Focus. Recall. Understand your habits.**

FocusRecall brings focused study, active recall and personal analytics into one Windows workspace. Build a useful record of how you study while keeping control of your data.

**Windows x64 · Free to use · Closed-source · Local-first**

[**Download the Windows beta →**](https://github.com/abd1442/FocusRecall/releases) · [Report a problem or suggest an improvement](https://github.com/abd1442/FocusRecall/issues) · [How to use it](#using-focusrecall)

![FocusRecall study workspace](screenshots/home-light.png)

I built FocusRecall for myself because I couldn't find an app that combined the study tracking, recall notes and personal insights I wanted with the privacy I wanted. It is free to use, with no account or subscription required.

## Find your pace

| Flow | Fixed | Adaptive |
| --- | --- | --- |
| Count up and keep studying while you are engaged. | Count down from a target you choose. | Use your confirmed study history to help choose a target. |

Choose a subject and start. The floating panel keeps the timer and useful controls close while you work in another app.

| Before studying | During studying |
| --- | --- |
| ![Floating preparation panel](screenshots/floating-ready.png) | ![Floating study timer](screenshots/floating-timer.png) |

## Finish with more than a timer total

Recall the main ideas, connect them, and notice what is still unclear. Type or draw, use another notes app, or review with the optional timer. Then record the details you care about and choose a break before the next session.

![Recall and typed notes](screenshots/recall.png)

![Session log](screenshots/compact-log.png)

![Choose a break, duration and music](screenshots/rest.png)

## Turn your records into better questions

See when you tend to report stronger focus, which conditions appear alongside better sessions, and what changed across comparable weeks. Open the supporting records, check the evidence grade, and optionally try a small experiment.

![Personal study patterns](screenshots/insights.png)

![Conditions and reported outcomes](screenshots/stats-conditions.png)

For example, higher focus ratings in the library can be a reason to try that setting again. More interruptions from your phone can show where to make a practical change. These are patterns in your records, not proof of cause or guarantees of learning.

## Keep the learning, not just the numbers

Search previous sessions, reopen recall notes and drawings, and return to unfinished questions. Save notes locally or explicitly export them to your Obsidian vault.

![History and session notes](screenshots/history-notes.png)

Automatic activity tracking can record study-time app and window activity locally. It is on for new profiles, can be switched off, and keeps existing users' choices. Your notes are sent to external apps only when you choose to export them.

## Install or update

1. Open [Releases](https://github.com/abd1442/FocusRecall/releases) and download the Windows x64 installer and SHA-256 checksums.
2. For an update, make a backup in Settings and close FocusRecall, including its tray icon.
3. Run the installer. Keep your existing installation scope and destination when updating. Choose a desktop shortcut if you want one.

The beta is currently unsigned, so Windows may show a reputation warning. Verify the official repository and checksum; stop if the file or warning is unexpected. Do not disable Windows security protections. Updates are manual; the app does not check for or download updates in the background.

## Using FocusRecall

Open a topic for illustrated instructions. For colours and corner styles, open **Make FocusRecall yours**.

${guideTopics}

## Your records stay under your control

Study history, settings and notes are stored locally. Local backups may contain personal information; keep them somewhere secure. Optional exports and integrations act on your request. [Privacy details](PRIVACY.md) · [License](EULA.txt) · [Third-party notices](THIRD-PARTY-NOTICES.txt)

FocusRecall is free software licensed GPL-3.0-only. Donations are optional and do not unlock features.

[![Support FocusRecall on Ko-fi](assets/support-focusrecall.svg)](https://ko-fi.com/abd442)
`;
write('README.md',readme);copy('resources/focusrecall-banner.svg','assets/focusrecall-banner.svg');copy('resources/support-focusrecall.svg','assets/support-focusrecall.svg');copy('resources/focusrecall-icon.png','assets/focusrecall-icon.png');
const manifest=JSON.parse(fs.readFileSync('docs/screenshots/focusrecall-manifest.json','utf8'));for(const s of manifest.screenshots)copy('docs/screenshots/'+s.file,'screenshots/'+s.file);write('SCREENSHOT_MANIFEST.json',JSON.stringify(manifest,null,2)+'\n');
copy('resources/legal/LICENSE.txt','LICENSE');copy('resources/legal/PRIVACY.txt','PRIVACY.md');copy('resources/legal/EULA.txt','EULA.txt');copy('resources/legal/THIRD-PARTY-NOTICES.txt','THIRD-PARTY-NOTICES.txt');copy('dist/focusrecall-'+tag+'/SHA256SUMS.txt','SHA256SUMS.txt');
write('RELEASE_NOTES.md','# '+releaseHeading+'\n\nA free, GPL-3.0-only Windows workspace for focused study, active recall and understanding your own study habits.\n\n## Included in this beta\n\n- Flow, Fixed and Adaptive timers with floating controls.\n- Optional timed review, typed or drawn recall, detailed logging, rest setup and fast next sessions.\n- Searchable History, local notes and explicit Obsidian exports.\n- Personal study patterns with supporting records, detailed comparisons, Weekly Review and optional experiments.\n- Light, dark and mixed palettes, straight or rounded corners and a compact sidebar.\n- Local backups and manual updates; no account or subscription.\n\n## Install or update\n\nDownload `'+installerName+'` and `SHA256SUMS.txt` from this release. Back up in Settings, close the app and its tray process, then run the installer. Keep the same installation scope and destination when updating. Existing Learnalyt study history, notes, settings, backups and Obsidian links use the preserved data identity.\n\n## Known limitations\n\n- Windows x64 only. This beta is unsigned; Windows may show a publisher or reputation warning. Verify the official repository and checksum. Do not disable security protections.\n- Study patterns are observational and depend on the records you choose to collect. They are not proof of cause, medical advice or guarantees of learning.\n- Updates are manual. Local databases and backups are not encrypted by FocusRecall; keep backups secure.\n\nRead the [illustrated guide](README.md#using-focusrecall), [privacy statement](PRIVACY.md) and [license](EULA.txt). [Report a problem](https://github.com/abd1442/FocusRecall/issues) without sharing private study data.\n');
write('SUPPORT.md','# Help and feedback\n\nRead the [instructions in the README](README.md#using-focusrecall), or [report a problem or suggest an improvement](https://github.com/abd1442/FocusRecall/issues). Include the app version, Windows version and steps to reproduce. Never attach your database, backups, vault or private window titles.\n\n[Optional support on Ko-fi](https://ko-fi.com/abd442). FocusRecall remains free.\n');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);const files=walk(output).map(f=>({file:path.relative(output,f).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}));write('FILE_MANIFEST.json',JSON.stringify({product:'FocusRecall',version,installerUploaded:false,files},null,2)+'\n');console.log('Prepared '+files.length+' user-facing files.');
