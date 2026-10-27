// A summary is written only after every final receipt agrees on the shipped archive.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir='docs/verification/visual-refinement-20261016';
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8').replace(/^\uFEFF/,''));
const runtime=read('packaged-reviewed/runtime.json'),artifact=read('asar-verification.json'),installer=read('installer.json'),tests=read('tests.json'),audit=read('npm-audit.json');
const coverage=read('localization-coverage.json');
assert.equal(tests.numFailedTests,0);assert.equal(audit.metadata.vulnerabilities.total,0);assert.equal(coverage.sourceCoverageComplete,true);assert.equal(runtime.languages.length,7);assert.equal(runtime.visualRefinement.length,7);assert.equal(runtime.advice.length,49);assert.equal(runtime.scientificStats.length,7);assert.ok(runtime.scientificStats.every(r=>r.cardMethodUsesSharedContract));assert.deepEqual(runtime.rendererErrors,[]);assert.deepEqual(runtime.observedMainPageNetwork,[]);assert.equal(artifact.matchedCurrentBuild,true);assert.equal(runtime.asarSHA256,artifact.archiveSha256);
const cases=['zero-reviewed','four-reviewed','medium-reviewed'].map(name=>{const r=read(name+'/runtime.json');assert.equal(r.asarSHA256,artifact.archiveSha256);assert.equal(r.visualRefinement.length,7);assert.deepEqual(r.rendererErrors,[]);assert.deepEqual(r.observedMainPageNetwork,[]);return {name,sessions:r.visualRefinement[0].rawSessions,languages:r.visualRefinement.length}});
assert.deepEqual(cases.map(c=>c.sessions),[0,4,40]);
const summary={date:'2026-10-16',version:runtime.version,archiveSha256:artifact.archiveSha256,installer,tests:{passed:tests.numPassedTests,failed:tests.numFailedTests,files:tests.testResults.length},localization:{keys:coverage.englishKeys,missing:0,independentLinguisticReview:false},native:{languages:runtime.languages.map(l=>l.language),visualExplainerVisits:runtime.visualRefinement.reduce((n,r)=>n+r.visualIdeas,0),adviceChecks:runtime.advice.length,scientificChecks:runtime.scientificStats.length,dataLevels:[...cases,{name:'packaged-reviewed',sessions:runtime.visualRefinement[0].rawSessions,languages:7}],rendererErrors:runtime.rendererErrors,mainPageHttpRequests:runtime.observedMainPageNetwork},stage4Started:false,published:false};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
const report=`# Learn and Stats — visual companion refinement

16 October 2026. Local implementation; version remains \`0.1.0-beta.24\`. Existing working changes, study data compatibility, app identity and Stage 1/2 science are preserved. No migration, dependency, telemetry, cloud service, Stage 4 integration, Git push, installation or publication was added.

## Learn: show the principle, then return to studying

Today is one large original diagram, a short caption and one practical canonical takeaway. Save, another idea and hide are optional. Explore is a freely browsable field guide: eight visual explainers plus all 24 shared strategies across nine searchable topics. Saved keeps both existing bookmark types. There are no course levels, required questions, quizzes, equations to solve, reconstruction tasks, Practice lab, completion buttons/badges or scheduled revisit prompts. No answer is required to reveal content.

| Visual explainer | What is shown |
|---|---|
| Familiar ≠ remembered | Notes visible versus notes closed; an illustrative gap, not a memory score |
| Recall, then check | Attempt → inspect → repair, with distinct document/inspection symbols |
| Give ideas another day | Four occasions in one day versus four across days; optional motion redistributes them |
| Connect the steps | Steps, reasons and connections rather than a calculation to complete |
| Support, then independence | Full, partial and absent support visible immediately, without a button requirement |
| Make feedback usable | An incomplete attempt → specific feedback → changed next attempt |
| Practice choosing a method | Equal sets of distinguishable shapes in grouped/mixed order; basics-first qualification |
| A small plan can change | Plan → notice → adjust, with a return loop rather than a progress score |

Attention and rest strategies have additional task/parking and pause/return illustrations. Static comparisons remain meaningful without motion. No retention curves, invented percentages, brain imagery or grading was added. Deeper canonical explanations, related actions, qualifications and DOI references are collapsed; practical suggestions without research citations are labelled accordingly. Removed exercises cannot leave dangling numerical-answer references: old course prose is neither displayed nor searched.

The same stable concept IDs, Stage 2 source scopes and authored seven-language advice remain canonical. \`learn.v1\` is unchanged. Old activity, answer-choice, draft, completion and revisit records remain compatible but are not presented as goals. Browsing records only opening/bookmark/daily-selection events; it never creates an activity, check, completion or revisit event. The native verifier seeds legacy course records through the old API solely to prove preservation. Reset remains explicit and Learn-only. Future Stage 4 work must not treat browsing as learning evidence or session consent.

## Stats: recorded information first

The opening dashboard shows recorded study time, sessions, study days, subjects, a compact fourteen-day activity strip, proportionate subject time and expandable self-report counts. Daily amounts are available as text; unrecorded dates are labelled “No record.” Activity is explicitly distinguished from learning. Subject time uses real subject parts, including mixed sessions, without double attribution or invented legacy splits.

An empty profile gets a notebook illustration and one clear Start studying action, with no empty findings report. Existing saved evidence remains accessible when old history has been removed. A four-session/two-day profile shows its actual time and subjects without manufacturing a reliable comparison. Medium and extensive histories use the same composition, with actual findings only when the unchanged engine supplies them.

Four primary groups—Your insights, Activity, Comparisons and Report—replace the long horizontal strip. Every prior analytical destination remains available through the grouped picker. Navigation returns to the page top; it does not scroll past the new summary under the header. Exclusions, update methodology and optional general strategies are expandable. Raw recall notes and progress descriptions no longer headline the dashboard; History opens the original records.

Optional methodology dialogs now use the shared evidence copy for comparisons and the actual generator explanation for descriptive totals. Retired session-matching thresholds and the four-step comparison walkthrough no longer appear. Cards, help and exports therefore explain the same matched study-day contract.

The Stage 1 evidence engine, thresholds, matching, missing-data rules, frozen questions, trial restrictions, reports and mathematical conclusions are unchanged. New \`recordedActivity\` is descriptive aggregation only. Pane-based responsive rules stack the dashboard and finding cards appropriately; the header scrolls away in tight panes. Extreme scaling keeps counters readable rather than breaking labels into isolated letters.

## Verification of the final artifact

- **${tests.numPassedTests} tests passed, zero failed, ${tests.testResults.length} files.** Eight new aggregation regressions cover genuine zero data, four records/two days, actual mixed-subject attribution, unknown legacy splits, missing/untouched ratings, valid answered aggregates, fourteen-day versus all-range totals and duplicate/invalid durations. Existing course-state tests remain compatibility checks, not UI requirements.
- Node/renderer typechecks and production build pass. No dependency was added. The Learn JavaScript chunk is about **23 kB**, compared with about 150 kB in Stage 3; this is a bundle measurement, not an overall performance or startup benchmark.
- Strict static localization/placeholder checks: **${coverage.englishKeys} normalized messages, zero inventoried gaps** across Arabic, Spanish, French, Simplified Chinese, Brazilian Portuguese and German. Shared advice/legacy authoring checks and seven-language installer-copy checks pass. English remains the reference. Language preview disclosures remain.
- Dependency audit: **zero known vulnerabilities**. Native SQLite and all eleven fresh runtime files match the archive; no QA/profile/source-document leakage was found.
- Final packaged Windows app: **56 explainer visits across seven languages**, 24 strategies per language, search/empty state, saved/reload persistence, daily another/hide, source-language captions, no quizzes/completion controls, default fading-support geometry, unchanged legacy activity and unchanged raw study blocks.
- Final SQLite profiles: **0, 4 and 40 sessions**, seven languages each, plus an extensive **${runtime.visualRefinement[0].rawSessions}-session** starting fixture in the full run. These are actual isolated SQLite profiles, not renderer substitutions. The four-record fixture is asserted to contain two study days.
- Light/dark screenshots, English/Arabic measured 900×760 and 1100×820 windows, proper root 200% scale with the app viewport token, keyboard comparison controls, reduced-motion computed animation suppression and forced-colors browser emulation. All prior Stats destinations are reachable. Actual screenshots were inspected and layout defects corrected; passing assertions alone were not treated as visual approval.
- Full regression: seven complete focus/recall/log/rest/return cycles, seven scientific evidence checks including shared-contract card-help dialogs, 49 advice/silence checks, frozen-question behavior where eligible, localized Markdown exports, real Arabic PNG/PDF exports, notes/unsaved-quit protection, SQLite snapshot/restore validation and renderer/capability isolation. Native picker and quit-dialog choices are stubbed within the fictional profile. No renderer errors or observed main-page HTTP requests.

Primary receipts: [summary](summary.json), [native full run](packaged-reviewed/runtime.json), [zero](zero-reviewed/runtime.json), [four](four-reviewed/runtime.json), [medium](medium-reviewed/runtime.json), [tests](tests.json), [audit](npm-audit.json), [archive](asar-verification.json), [installer](installer.json), [screenshots](SCREENSHOTS.md).

Installer built locally, **not installed or published**: \`${installer.path}\`. Size ${installer.bytes.toLocaleString('en')} bytes; SHA-256 \`${installer.sha256}\`; signature **${installer.signature}**. Tested archive SHA-256: \`${artifact.archiveSha256}\`.

## Corrections found during verification

A final source check also found pre-existing comparison-help prose describing retired session thresholds. Its optional dialog/record-support guide now use canonical evidence copy, verified in seven languages. Screenshot review caught navigation scrolling past the new summary, stale optional text referring to removed exercises, and a fading-support visual whose useful state initially required a click. Those are fixed. Additional root-scale testing exposed minimum-width finding cards and the need for pane-based responsive rules and a nonsticky tight-pane header; these are fixed in the final artifact. An early “zero” fixture used SQL NOT IN (NULL) and retained records; it was corrected and explicit row-count assertions added. A proposed removal of a failing untouched-rating fixture was rejected by automatic approval review; the fixture was retained, its expected exclusion aligned with the existing evidence contract, and a separate valid-aggregate case was added. Earlier folders/logs are preserved diagnostic or superseded runs, not final acceptance receipts.

## Limits and handoff

Independent fluent-language/editorial review remains needed; translated coverage and screenshots do not certify naturalness. Real screen-reader testing, physical OS high contrast, other DPI/monitor configurations, endurance/sleep/wake and disposable installed lifecycle testing remain external/manual work. The browser accessibility emulations are not a full WCAG certification. No real Spotify session was available in the native status check; Spotify transport was unchanged and playlist playback is not claimed. Installer signing and release/license/distribution decisions remain outstanding publication work.

The current architecture is documented in [Learn](../../LEARN.md), the user guide and the updated research handoff/blueprint. The historical Stage 3 course report remains preserved. Review the refined companion before Stage 4; no automatic session integration, new advice algorithm or academic assessment has begun.
`;
fs.writeFileSync(path.join(dir,'REPORT.md'),report);
const gallery=`# Actual packaged-app screenshots

All images use fictional profiles and the exact archive identified in summary.json. The full gallery is in packaged-reviewed; zero-reviewed/four-reviewed/medium-reviewed cover the smaller SQLite profiles. Older numbered folders are diagnostic/superseded runs.

## Learn Today

![Today](packaged-reviewed/en-learn-today-light.png)

## Explore

![Explore](packaged-reviewed/en-learn-explore.png)

## Spacing, English and Arabic

![Spacing](packaged-reviewed/en-learn-spacing.png)

![Arabic spacing](packaged-reviewed/ar-learn-spacing.png)

## Full support, partial support, independent attempt

![Fading support](packaged-reviewed/en-learn-examples.png)

## Stats at zero, four and forty sessions

![Empty](zero-reviewed/en-stats-summary-light.png)

![Four](four-reviewed/en-stats-summary-light.png)

![Forty, Arabic](medium-reviewed/ar-stats-summary-light.png)

## Dark themes and enlarged content

![Dark Learn](packaged-reviewed/ar-learn-spacing-dark.png)

![Dark Stats](four-reviewed/en-stats-summary-dark.png)

![200% Stats](packaged-reviewed/en-stats-200-content.png)

The optional [Stats evidence help](packaged-reviewed/en-shared-evidence-help.png) uses the same contract as charts and reports.

Additional original explainer captures: [retrieval](packaged-reviewed/en-learn-retrieve.png), [connections](packaged-reviewed/en-learn-explain.png), [feedback](packaged-reviewed/en-learn-feedback.png), [mixed practice](packaged-reviewed/en-learn-mix.png), [Arabic planning](packaged-reviewed/ar-learn-reflect.png). Chinese and German screenshots, narrow windows and forced-colors captures are also in packaged-reviewed. Static screenshots do not show the spacing animation; the native test verifies its equal four occasions and reduced-motion suppression.
`;
fs.writeFileSync(path.join(dir,'SCREENSHOTS.md'),gallery);
console.log(JSON.stringify(summary,null,2));
