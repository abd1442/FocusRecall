// Explicit allowlist: unchanged verified RC2 artifacts and authored tester materials only.
// Never reads any profile, recovery copy or backup. Never publishes or installs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const version='0.1.0-beta.28-rc.2',base=path.resolve('dist/rc-beta28-rc2-20261018'),staging=path.resolve('dist/private-friend-rc2-20261018');assert.ok(!fs.existsSync(staging),'Choose a fresh staging directory; never overwrite an approved package.');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),installer='FocusRecall-'+version+'-setup.exe',source='FocusRecall-'+version+'-source-and-dependencies.zip';
const receipt=require('../docs/verification/rc2-recovery-20261018/artifacts.json');for(const file of [installer,source])assert.equal(hash(fs.readFileSync(path.join(base,file))),receipt.files.find(r=>r.file===file).sha256,file);
const folder=path.join(staging,'FocusRecall-beta28-rc2-private-test');fs.mkdirSync(path.join(folder,'Optional-GPL-source'),{recursive:true});
fs.copyFileSync(path.join(base,installer),path.join(folder,installer));fs.copyFileSync(path.join(base,source),path.join(folder,'Optional-GPL-source',source));
for(const [from,to]of [['LICENSE','LICENSE.txt'],['resources/legal/PRIVACY.txt','PRIVACY.txt'],['resources/legal/THIRD-PARTY-NOTICES.txt','THIRD-PARTY-NOTICES.txt']])fs.copyFileSync(from,path.join(folder,to));
const sha=receipt.files.find(r=>r.file===installer).sha256;
const guide=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FocusRecall RC2 — private Windows test</title><style>body{max-width:780px;margin:32px auto;padding:0 20px;font:17px/1.55 system-ui,sans-serif;color:#172b3a;background:#fff}h1{font-size:29px;line-height:1.2}h2{font-size:21px;margin-top:30px}li{margin:8px 0}aside{padding:14px 18px;background:#f2f5f7;border-left:4px solid #345e76}code{overflow-wrap:anywhere;font-size:14px}a{color:#164d77}@media print{body{margin:0;max-width:none;font-size:11pt}h2{break-after:avoid}aside{background:none}}</style>
<h1>FocusRecall: a short private Windows test</h1><p><strong>Build ${version} · Windows 11 x64 · unsigned</strong><br>About 15–20 minutes. Thank you for testing with made-up information only.</p>
<aside><strong>Before starting:</strong> use a PC/account that has never used FocusRecall, Learnalyt or Trifocus. If any was used before, stop and ask the sender; do not remove it or overwrite its data. This is a release candidate, so do not use real study records, work documents or connected note vaults.</aside>
<h2>1. Extract and install</h2><ol><li>Save the package, then right-click the ZIP and choose <strong>Extract All</strong>. Open the extracted folder. Do not run Setup inside the ZIP.</li><li>Open <strong>Settings → System → About</strong> in Windows. In Test-report.txt, copy the Windows edition, version, OS build and system type. Use an x64-based Windows 11 PC; ask the sender first for Windows 10 or ARM-based hardware. Do not send device IDs, product IDs or serial numbers.</li><li>Double-click <strong>${installer}</strong>. Use installation for your account and the normal suggested location. Read the GPL notice, try your preferred installer language, and note whether the desktop-shortcut choice is understandable.</li><li>The build is intentionally unsigned, so Windows may show an unknown-publisher or SmartScreen warning. Screenshot the exact warning and pause to confirm this file with the sender if uncertain. If antivirus reports a threat, stop and send its exact name/message. <strong>Do not disable antivirus, add exclusions or upload the installer to an online scanner.</strong> Windows may require your approval; do not enter somebody else's administrator credentials.</li></ol>
<h2>2. First launch and fictional records</h2><ol><li>Open FocusRecall from its new shortcut or Start menu. Confirm the app shows <strong>${version}</strong>. Record any delay, blank window or error.</li><li>Leave foreground-window tracking and window-title collection <strong>off</strong>. Skip external notes, Spotify and other integrations. If offered demo data, choose your own empty study area for this test.</li><li>Create two subjects named <strong>RC2 Test A</strong> and <strong>RC2 Test B</strong>. Pick a different colour for one. Choose a theme you like in <strong>Settings → Appearance</strong>, and record its name and your app language.</li></ol>
<h2>3. Complete one study cycle</h2><ol><li>Select RC2 Test A on Home. Choose <strong>Flow</strong>, enter the goal <strong>Fictional test goal</strong>, and press <strong>Start</strong>. Complete preparation if shown. Let Focus run about two minutes.</li><li>Press <strong>Distracted</strong>, wait about ten seconds, then return to focus. Study another minute. Check that the floating panel remains usable and its controls do not freeze.</li><li>Choose <strong>Finish session</strong> (or Finish on the panel). If a short-session prompt appears, choose <strong>Keep it</strong>.</li><li>In Recall, type <strong>Fictional recall: Mercury, Venus, Earth</strong>. Finish recall with <strong>Done</strong> and <strong>Continue to session log</strong> as shown. Select the fictional ratings <strong>3/5</strong> for recall and <strong>4/5</strong> for focus when available; note anything confusing. Put <strong>Fictional log note RC2</strong> in a notes field if offered.</li><li>Choose <strong>Continue to rest</strong>. Set a one-minute rest, leave music off, select <strong>Start rest</strong> and let it finish. Choose a rest activity and continue to the next session. A second study cycle is optional.</li><li>Open <strong>History</strong> and expand the new session. Confirm the correct subject, a few minutes of Focus rather than hours, the distraction, your recall words, ratings/log information and rest. Record the actual displayed duration in Test-report.txt. Immediate self-ratings are records of experience, not a learning test.</li></ol>
<h2>4. Restart and check persistence</h2><ol><li>When the cycle is complete and saved, right-click FocusRecall's icon near the Windows clock (possibly under the hidden-icons arrow) and choose <strong>Quit</strong>. Wait five seconds.</li><li>Open it again through Start or its shortcut. Check both subjects/colours, your theme/language, the History session and its saved recall/log information. There should be no duplicate session or lost record.</li><li>In Settings, find <strong>Backup and restore</strong> (search for “backup” if needed). Choose <strong>Back Up Data</strong> and save a file in a new folder called <strong>FocusRecall fictional test backup</strong>. Confirm the app says the backup was created and verified. Do not restore a backup or send a whole profile folder for this basic test.</li></ol>
<h2>5. Optional: uninstall and reinstall</h2><p>Only do this if all records on this Windows account are fictional, the backup above succeeded, and no other user depends on this installation.</p><ol><li>Quit through the tray. Use <strong>Windows Settings → Apps → Installed apps → FocusRecall → Uninstall</strong>. Do not manually delete data folders or choose to erase study data. Note whether shortcuts and the app entry disappear.</li><li>Run the <strong>same RC2 installer</strong> again and open the app. Check that your two subjects, saved History/recall/logs and theme still exist and the backup file remains. If anything is missing, stop and report it; do not reset or repair the data.</li></ol>
<h2>If something goes wrong</h2><p>Stop at the problem and write the exact action and message. Do not delete databases, clear AppData, reinstall repeatedly, force-crash the app or attempt repairs. An installation/database error is especially important. Send the report and relevant screenshots privately to the sender. You do not need source code, developer tools or command-line commands.</p>
<p>Press <strong>Windows + Shift + S</strong> to capture only the app or warning, then save the picture. Avoid other windows, notifications, account names, addresses and device/product IDs. Describe whether the issue happens every time; do not repeatedly reproduce anything that could lose records. Only attach the fictional backup if the sender specifically asks.</p>
<p>Basic keyboard check: use Tab, Shift+Tab, Enter and Escape to move through Home/Settings and close a dialog. Note unreachable controls or lost focus. A brief test is not a full accessibility assessment.</p>
<h2>Send back</h2><p>Fill in <strong>Test-report.txt</strong> using Notepad, save it, and send it with any screenshots. Include successful results as well as failures and anything you skipped.</p>
<p><strong>About the other files:</strong> LICENSE.txt contains GPLv3; PRIVACY.txt explains local data/tracking; THIRD-PARTY-NOTICES.txt lists component notices. Optional-GPL-source contains the matching source for people who want it. <strong>You do not need to open or build it to test.</strong> SHA256SUMS.txt is an integrity reference; no command-line checksum tool is required for the checklist. If you already have a trusted graphical checksum tool, you can compare the installer hash below; otherwise ask the sender for help rather than installing another tool.</p>
<details><summary>Installer integrity reference</summary><p>File: ${installer}<br>Size: 121,438,328 bytes<br>SHA-256:<br><code>${sha}</code></p></details>
<p>This copy is staged for private testing. Public release has not been approved by the project owner. This is project status, not an added restriction on GPL rights.</p></html>`;
fs.writeFileSync(path.join(folder,'00-START-HERE.html'),guide);
fs.writeFileSync(path.join(folder,'Test-report.txt'),`FOCUSRECALL PRIVATE TEST REPORT
Build: ${version}
Please use fictional data only. No product keys, device IDs or personal records.

Date tested:
Windows edition / version / OS build (Settings > System > About):
System type (x64 / ARM):
App language / theme:
Ever used FocusRecall, Learnalyt or Trifocus on this account before?

Mark PASS / FAIL / NOT TESTED and add a short note:
[ ] ZIP extraction and installation:
[ ] Windows/antivirus warnings (exact message and threat name if any):
[ ] GPL notice / installer language / shortcut choice:
[ ] First launch, correct RC2 version:
[ ] Two fictional subjects and colours:
[ ] Preparation / Focus / Distracted / Recall / Log / Rest:
[ ] Approximate stopwatch time and History Focus time:
[ ] Recall words, ratings and notes saved correctly:
[ ] App quit and restart:
[ ] History/subjects/appearance persist; no duplicate session:
[ ] Back Up Data: created and verified:
[ ] Basic keyboard use:
[ ] OPTIONAL uninstall: app/shortcuts removed:
[ ] OPTIONAL reinstall: study data/preferences/backup retained:

ERROR OR CONFUSION
What I clicked, in order:
What I expected:
What actually happened:
Exact error text:
Does it happen again? (Do not repeat anything that risks data.)
Screenshots attached (only relevant windows, no private details):
Anything skipped / other observations:
`);
fs.writeFileSync(path.join(folder,'SOURCE-NOTICE.txt'),`FocusRecall ${version}
Original FocusRecall code: GPL-3.0-only. Full license is LICENSE.txt. Component notices retain their own terms. No additional proprietary restrictions apply.

The optional archive Optional-GPL-source/${source} contains the matching application source snapshot at commit 61ed8581deb8aef2237414be0518ef9fa7840f4e (correction commit 3b90d5d), 468 allowlisted source/assets/build/install files, 46 exact runtime npm inputs and 34 upstream source archives. SOURCE_MANIFEST.json supplies per-file hashes; SOURCE_BUILD.md provides build instructions. The verified application was built from the correction commit; the later snapshot adds test/harness coverage without changing packaged application code. No loose development workspace, QA executable, profile or recovery files are included. Source code is not needed to install or test.

Electron 44.7.2 source/patches and its exact DEPS are included; Chromium 152.0.7977.149, Node v24.21.0 and dependent revisions are identified by that DEPS. The full transitive Electron/Chromium/Node checkout is not mirrored. Source access/build directions:
https://github.com/electron/electron/tree/v44.7.2
https://raw.githubusercontent.com/electron/electron/v44.7.2/DEPS
https://www.electronjs.org/docs/latest/development/build-instructions-gn

Other upstream repositories/commits and archive hashes are listed inside dependency-inputs/UPSTREAM_SOURCE_REFERENCES.json and UPSTREAM_ARCHIVES.json. The SQLite/native binding inputs are included with better-sqlite3. Additional Electron/Chromium component notices ship beside the installed executable as LICENSE.electron.txt and LICENSES.chromium.html.

The sender must retain/provide the matching source and resolve any missing required preferred-source availability if requested; a URL list alone is not a completeness certification. Final transitive-source and asset-rights review remains open before public release. GNU GPLv3 section 6 source-provision information: https://www.gnu.org/licenses/gpl-3.0.html

No source repository has been published as part of preparing this bundle. This is a private testing candidate, not public-release authorization or a limitation on GPL rights.
`);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=walk(folder).map(file=>({file:path.relative(folder,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))}));
fs.writeFileSync(path.join(folder,'SHA256SUMS.txt'),files.map(r=>r.sha256+'  '+r.file).join('\n')+'\n');
fs.writeFileSync(path.join(staging,'package-manifest.json'),JSON.stringify({version,scope:'Local staging for owner approval; nothing sent or published',installerHash:sha,files},null,2)+'\n');
console.log('Prepared '+path.relative(process.cwd(),folder));
