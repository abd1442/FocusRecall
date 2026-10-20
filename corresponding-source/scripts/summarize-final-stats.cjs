const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='docs/verification/statistical-reliability-20261018',read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const final=read('simulation-final.json'),audit=read('audit-paired.json'),resources=read('resources.json'),automatic=read('automatic-family.json'),tests=read('tests.json'),artifacts=read('artifacts.json'),workflow=read('acceptance-workflows/runtime.json'),workers=read('acceptance-workers/runtime.json'),methods=read('methods-05/runtime.json');
assert.equal(tests.numFailedTests,0);assert.equal(tests.numPassedTests,1067);assert.equal(workflow.languages.length,7);assert.equal(workflow.scientificStats.length,7);assert.equal(workflow.advice.length,49);assert.equal(workers.success,true);assert.equal(methods.success,true);assert.equal(methods.languages.length,7);assert.equal(methods.newFrozenQuestionSaved,true);assert.equal(methods.oldSavedQuestionsPreserved,true);assert.equal(methods.restoredRecordedDurationLabelCorrect,true);
assert.equal(workflow.asarSHA256,artifacts.archiveSHA256);assert.equal(workers.archiveSHA256,artifacts.archiveSHA256);
const totals=(c,key)=>{const vs=c.cells.map(x=>x[key]);return Object.fromEntries(['flags','available','pRejected','excludesZero','coversKnownEffect','wrongDirection'].map(k=>[k,vs.reduce((n,v)=>n+(v[k]??0),0)]))};
const n=final.reps*final.seeds.length,pct=(k,n)=>n?(100*k/n).toFixed(1)+'%':'unavailable';
function wilson(k,n){if(!n)return null;const z=1.96,p=k/n,a=1+z*z/n,b=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [(b-r)/a,(b+r)/a]}
const interval=(k,n)=>{const v=wilson(k,n);return v?v.map(x=>(100*x).toFixed(1)+'%').join('–'):'unavailable'};
const rows=final.scenarios.map(c=>({name:c.name,n,baseline:totals(c,'baseline'),candidate:totals(c,'candidate'),effect:c.effect??0,interpretation:c.interpretation??(c.confounded?'No causal condition effect; condition intentionally coincides with calendar trend. Not a statistical null.':null),knownEffect:c.knownEffect??null}));
const sourceHashes=Object.fromEntries(['src/core/evidence.ts','src/core/temporalEvidence.ts'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const result={baseline:'5d6ad2f',candidateSources:sourceHashes,finalSeeds:final.seeds,repsPerSeed:final.reps,scenarioCount:rows.length,pairedHistories:n*rows.length,tests:{passed:tests.numPassedTests,failed:tests.numFailedTests,files:tests.testResults.length},packagedArchiveSHA256:artifacts.archiveSHA256,rows,verification:{languages:workflow.languages.map(x=>x.language),scientificWorkflows:workflow.scientificStats.length,adviceChecks:workflow.advice.length,workerParityResults:workers.workerParityResults,workers:workers.workers,methodLanguages:methods.languages.map(x=>x.language)}};
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(result,null,2)+'\n');
const nulls=rows.filter(x=>!x.effect&&!x.interpretation&&!x.name.startsWith('coverage'));
const nullTable=nulls.map(r=>`| ${r.name} | ${r.baseline.flags}/${n} (${pct(r.baseline.flags,n)}) | ${r.candidate.flags}/${n} (${pct(r.candidate.flags,n)}) | ${r.candidate.available}/${n} | ${interval(r.candidate.flags,n)} | ${interval(r.candidate.flags,r.candidate.available)} |`).join('\n');
const power=rows.filter(x=>x.effect&&!x.name.startsWith('coverage')).map(r=>`| ${r.name} | ${r.effect} | ${pct(r.baseline.flags,n)} | ${pct(r.candidate.flags,n)} | ${r.candidate.available}/${n} | ${pct(r.candidate.flags,r.candidate.available)} |`).join('\n');
const coverage=rows.filter(x=>x.knownEffect!==null).map(r=>`| ${r.name} | ${r.baseline.coversKnownEffect}/${r.baseline.available} (${pct(r.baseline.coversKnownEffect,r.baseline.available)}) | ${r.candidate.coversKnownEffect}/${r.candidate.available} (${pct(r.candidate.coversKnownEffect,r.candidate.available)}) |`).join('\n');
const autoTable=automatic.cells.map(c=>{const count=key=>c.cells.reduce((s,x)=>s+x[key].planted,0),flags=key=>c.cells.reduce((s,x)=>s+x[key].anyFlag,0),n=automatic.repsPerSeed*automatic.seeds.length;return `| ${c.factors} / ${c.questions} | ${c.name} | ${flags('baseline')}/${n} | ${flags('candidate')}/${n} | ${count('baseline')}/${n} | ${count('candidate')}/${n} |`}).join('\n');
const resourceTable=resources.baseline.map((b,i)=>{const a=resources.candidate[i];return `| ${b.records} records | ${b.p50Ms.toFixed(2)} / ${b.p95Ms.toFixed(2)} | ${a.p50Ms.toFixed(2)} / ${a.p95Ms.toFixed(2)} | ${(b.heapAfter/1048576).toFixed(1)} / ${(a.heapAfter/1048576).toFixed(1)} MiB |`}).join('\n');
const before=audit.monotonicity.baseline,after=audit.monotonicity.candidate;
const report=`# Statistical reliability remediation — 18 October 2026

Local branch: checkpoint/beta.27. Accepted parent: 5d6ad2f. No installation, publishing, personal-profile access, history migration or record rewriting. Final evidence version: matched-context-episodes-v3.

## Independently reproduced causes

The unchanged parent exactly reproduced the audit's four year-long, 28-day-condition null results: 1%, 9.5%, 16% and 18.5% exploratory flags for IID, AR(0.9), AR(0.97) and bounded-walk moods respectively (200 histories each). Fixed fortnight blocks split long condition bouts into purported repeated support while slowly varying ratings remained dependent. A large session/day count did not establish independent condition repetitions.

The sparse-subject reproduction changed p=${before.before.testing.pValue} to unavailable after four consistent observations. Its fixed shared-context deletion required every context to retain both cells in every fortnight deletion; deleting the sparse subject's only fortnight emptied its cells and vetoed everyone else's uncertainty. This was an eligibility artifact, not evidence contradicting the association.

Methods used immediate recall as its initial outcome, favourable green bars and strength badges. An existing learning caution was only a heading tooltip. These cues could suggest method superiority even though the measurements were immediate self-ratings.

## Selected approach and its limits

Retain the accepted estimator: eligible sessions are averaged by subject/activity/day/condition, shared contexts are weighted by their smaller day count, and matching, missing-answer imbalance, untouched-default exclusion, ordinal/trimmed direction checks, date-overlap checks and before/after restrictions remain. Selection budgets and Bonferroni screening are unchanged byte-for-byte.

Within each context, form contiguous observed condition episodes. Missing calendar days do not invent switches; a day with both conditions supplies one episode on each side. Let episode calendar durations be L. The adaptive long block is **max(14, ceil(2 × sum(L²)/sum(L))) days**. This length-biased mean gives long bouts appropriate influence even among many short ones. Two calendar origins, half a block apart, reduce boundary sensitivity. Day and Monday-week deletion estimates remain variance floors.

Use the largest day/week/two-origin long-block jackknife SE within a context. Require every deletion to retain both condition cells. Count duration concentration on each side using **K = sum(L)²/sum(L²)**. Reference degrees of freedom are floor(minimum occupied blocks per side/origin, effective episodes per side)) minus one; at least three degrees of freedom are required. Four effective units is a minimum availability policy, not a theorem that four episodes establish independence.

Choose temporal context eligibility before resampling, using dates and condition assignments rather than observed effects or p-values. Unsupported contexts cannot veto supported ones. The estimate, groups, interval and p-value describe exactly the same supported subset. If none supports uncertainty, retain the full shared-context comparison descriptively. Always retain the full shared-context estimate/groups in the result; disclose sparse contexts, record counts, the full recorded difference and the interval's actual scope.

For multiple contexts, combine weighted context SEs by their weighted sum, rather than assuming that different subjects are independent people. This is a triangle-bound sensitivity for unknown cross-context covariance, **conditional on the marginal uncertainty estimates being adequate**. Joint calendar-day/week deletion remains a floor. A within-context linear-calendar-time coefficient must agree in direction before promotion. This is a diagnostic, not a nonlinear detrending model or adjustment for all confounding.

The resulting Student-t intervals and p-values are approximate, conservative sensitivity summaries. The length multiplier, concentration cap and minimum support are explicit engineering choices evaluated below; they are **not** an off-the-shelf exact test, a guarantee of 5% error under arbitrary dependence, or the published Imbens–Kolesar/CR2 degrees-of-freedom method.

Research supports accounting for serial dependence, persistence and effective clusters, but does not certify this custom rule. Cameron and Miller explain why within-cluster correlation and unequal cluster sizes reduce effective information, and why even t references can fail with few clusters. This motivates concentration-aware support and conservative uncertainty here. [Cameron & Miller, 2015](https://cameron.econ.ucdavis.edu/research/Cameron_Miller_JHR_2015_February.pdf)

Persistent exposures with serial outcomes can produce spurious findings in placebo studies; changing the measurement unit or alpha alone does not solve the dependence problem. These personal comparisons are not difference-in-differences designs, but the warning about persistent exposures applies. [Bertrand, Duflo & Mullainathan, 2004](https://doi.org/10.1162/003355304772839588)

Generic dependent-bootstrap block selectors concern stationary, weakly dependent series and an appropriate target statistic. Directly applying a mean-series selector, an AR(1) regression, or independent record permutations to irregular matched personal histories would add assumptions not established here. We therefore use an explicit design-aware sensitivity and disclose its uncertainty. This does not implement or claim the guarantees of the Politis–White selector. [Politis & White, author manuscript](https://www.math.ucsd.edu/~politis/SBblock-revER.pdf)

## Validation process, including a rejected candidate

The accepted parent was bundled from git before production edits. The reproducible baseline builder reads that parent without checkout changes. The auditor's generator/evidence remain untouched. A separate Mulberry32 generator supplies different RNG streams, binary and variable-duration conditions, IID/AR/near-unit-root/walk moods, trends, sinusoidal drift, missing study days, bursty sessions, shared-subject composition, missing ratings and planted effects.

The first candidate used an unweighted upper-quartile episode duration. It passed the original reproductions but a subsequent rare-long-bout stress test produced **99/600 (16.5%)** exploratory flags for near-unit-root moods and **99/600 (16.5%)** for walks. It was rejected. The final rule weights bout duration and limits effective support; it was then tested on fresh seeds and the full scenario grid. Preliminary receipts are explicitly distinguished by their filenames and are not final acceptance evidence.

The final comparison uses **${final.seeds.join(', ')}**, 200 histories per seed per scenario: **${rows.length} scenarios, ${n} histories each, ${n*rows.length} paired histories**. Both engines receive identical histories. Scenarios share seed streams for paired comparisons; they are not independent replications to pool into a single headline error rate. Simulation rates are empirical calibration, not proof of validity for every real history.

### Null histories: selected-comparison association flags

The final two columns are Wilson 95% Monte Carlo intervals for the flag rate over all histories and, separately, only histories with an interval. Low availability must not be mistaken for accurate uncertainty on every history. Raw receipts also record p-value rejections and intervals excluding zero, independently of interpretability gates.

| Scenario | Parent flags | Final flags | Final intervals available | Flag-rate MC interval | Conditional flag-rate MC interval |
|---|---:|---:|---:|---:|---:|
${nullTable}

The exact original audit seeds now give 0/200 flags in each of the four mood scenarios, but only 8/200 have sufficient final temporal support. Those short, month-condition histories usually remain descriptive. This is an explicit support limitation, not an assertion that chance associations have become impossible.

### Planted self-rating shifts: power and availability

Effects below are generator shifts in ratings before rounding/clipping, not retention or learning benefits. Power is the fraction labelled exploratory; conditional power excludes histories without an interval. Strong findings remain possible, while weak effects and long-bout designs require more information.

| Scenario | Planted shift | Parent power | Final power | Final interval availability | Final conditional power |
|---|---:|---:|---:|---:|---:|
${power}

For the three bounded integer-shift scenarios, the potential recorded rating is exactly one step higher under the planted condition without clipping. The table reports interval coverage of that known population contrast **among available intervals**; it does not count an unavailable interval as covering the truth.

| Known-contrast scenario | Parent coverage / available | Final coverage / available |
|---|---:|---:|
${coverage}

Mood-selected conditions have no causal condition effect but a genuine observational rating association: both engines flag all 600 histories. This is **not a statistical null false-positive rate**. Deliberately aligning a before/after condition with a calendar trend is also not a statistical null; both engines keep all 600 such comparisons descriptive (the parent nevertheless supplies nominal p-values, all rejecting zero, while the final engine withholds uncertainty without temporal repetitions). These checks demonstrate why matching and uncertainty cannot justify causal advice or learning-effect claims. Unequal condition-specific missing ratings retain the existing imbalance safeguard and are not promoted.

### Automatic screens

These are focus-only screens using the **full unchanged** search budget (including reserved outcomes/jobs). Two seed streams, 40 histories each. Existing full-generator scientific checks and permanent null tests also ran. Do not interpret zero flags in 80 simulations as zero population error.

| Factors / full budget | Scenario | Parent any flag | Final any flag | Parent planted option found | Final planted option found |
|---|---|---:|---:|---:|---:|
${autoTable}

The conservative cross-context/temporal uncertainty costs automatic-search power. This is reported rather than hidden or compensated by reducing the accepted multiplicity budget. The existing 80-history power regression now treats its stated minimum inclusively (greater-than-or-equal); it does not lower that minimum or change the production cutoff.

## Non-monotonicity correction

For the exact four-record reproduction, final p is **${after.before.testing.pValue} before and ${after.after.testing.pValue} after**. The original supported estimate is preserved; the four new records contribute to the separately retained full descriptive estimate and are disclosed as lacking temporal support. No records are discarded from storage. A supported new context, contradictory observations, changed date composition or a longer concentrated bout can still legitimately change the estimate, uncertainty, scope or classification. Significance is not guaranteed to increase with added data.

## Presentation and compatibility

Methods defaults to focus for new views, while saved/restored outcome choices remain respected. Labels explicitly identify self-rated focus, self-rated understanding and immediate self-rated recall. Canonical option order and equally styled numeric comparisons replace superiority colours and strength badges. The view shows full matched recorded averages, counts and optional rating distributions, including contexts too sparse for inference. The learning caution is visible rather than confined to a tooltip. Method-related comparison bars elsewhere are neutral, and method insight takeaways no longer use favourable/unfavourable tone or strength meters. Observational association status remains inspectable in shared evidence details.

Shared evidence copy explains adaptive temporal support and exact scope in comparisons, reports and insight dialogs in all seven languages. Existing saved questions retain their version; later checking asks users to save again when the analysis method changed. Saved Views recalculate with the current engine. Restored recorded-activity outcomes (such as session duration) remain visible in restricted outcome pickers and keep their actual labels; they are never relabelled as self-rated focus. There is no database migration, retrospective rewrite, new dependency, tracking change or alteration to Learn/canonical study advice.

## Runtime, memory and packaged verification

Separate warmed Node child processes run identical fictional inputs with forced GC before/after repeated comparisons. These are shared-host samples, not a controlled hardware benchmark. The 12,000-record case runs 40 comparisons; the smaller case runs 200. Retained heap and process RSS are distinct; short repeated runs do not prove absence of long-term leaks.

| Input | Parent p50 / p95 ms | Final p50 / p95 ms | Post-GC heap parent / final |
|---|---:|---:|---:|
${resourceTable}

- Full regression: **${tests.numPassedTests} tests, ${tests.testResults.length} files, zero failures**; TypeScript, IPC schema and seven-language/scientific copy checks pass. SciPy independently checks 63 t-quantile/tail cases. Recommendation-policy fictional histories and full-generator null checks pass.
- Real unpacked Windows app: seven language workflows, complete Focus/Recall/log/Rest/return cycles, seven scientific evidence-dialog checks, 49 recommendation/silence checks, saved questions, Saved Views, actual Markdown exports, Arabic image/PDF exports and local snapshot/restore checks. Native file pickers/quit prompts are stubbed only inside QA fixtures.
- Final Methods view: seven languages, keyboard details, RTL, representative approved light/dark palettes including Darkroom; recorded favourable rereading data remains visible without green better bars or strength badges. No history changes or renderer errors. Screenshots were inspected; this is not screen-reader certification or independent linguistic certification.
- Long-history packaged Stats: all ${workers.workerParityResults} captured worker results match direct Node calculations (numeric tolerance 1e-12 relative, classifications/actions/text exact), blocked-worker retry, stale-job cancellation, retained drafts and Saved View outcomes pass. All ${workers.workers.created} workers terminate; zero remain active. Leaving during active analysis took ${workers.leaveDuringAnalysisMs} ms in this run.
- ASAR matches all 14 built runtime files. ${artifacts.protectedFiles.length} prior package/installer artifacts and ${artifacts.protectedSources.length} accepted source files remain unchanged; search-budget/screening functions are byte-preserved. Timing, native foreground module/privacy, themes/migration, accessibility infrastructure, performance workers, recommendation policy and Learn are protected. Installer created but **never executed**.

Final ASAR SHA-256: ${artifacts.archiveSHA256}. Final installer SHA-256: ${artifacts.installerSHA256}.

## Remaining limitations and acceptance

This is defensible exploratory personal analytics under an explicit, empirically conservative dependence model, not an exact inferential guarantee or a causal design. Arbitrary long memory, nonlinear trends, nonstationarity, unrecorded confounding, informative missingness, choice of filters and indefinitely repeated checking remain limitations. Simple linear-time sensitivity cannot remove these. Self-ratings remain ordinal subjective experiences, not retention/mastery outcomes.

Few persistent bouts may supply too little information even after years; sparse/rare-bout designs often have no interval. Moderate and small effects lose power, especially in automatic searches. A numerical interval, when available, remains approximate. No generic statistical rule can establish independence from an arbitrary single-person history.

Ready for acceptance of these scoped corrections with the documented limits. This is not general public-release clearance: the already outstanding physical Windows sleep/wake release requirement and unrelated audit findings remain outside this pass.

## Reproduction

From the project folder, run verify-final-stats-baseline.cjs, verify-final-stats-audit-paired.cjs and verify-final-stats-simulation.cjs with Node. For the final matrix set FINAL_STATS_SEEDS=${final.seeds.join(',')} and FINAL_STATS_RECEIPT=simulation-final.json; leave FINAL_STATS_FILTER unset. The audit generator must be present in the supplied read-only audit folder. verify-final-stats-automatic.cjs, verify-final-stats-resources.cjs and verify-final-stats-science.cjs supply additional checks. Packaged harnesses require an explicitly selected project-local executable and new marked fictional profiles. QA outputs are never written into Claude's audit evidence or personal profiles.

Raw receipts and per-seed results: [verification directory](verification/statistical-reliability-20261018/). Final packaged workflows: acceptance-workflows/runtime.json; acceptance-workers/runtime.json; methods-05/runtime.json. Preliminary candidate receipts and packages are retained locally and clearly excluded from final acceptance metrics.
`;
fs.writeFileSync('docs/STATISTICAL_RELIABILITY_20261018.md',report);
console.log(JSON.stringify({scenarios:rows.length,pairedHistories:n*rows.length,tests:tests.numPassedTests,archive:artifacts.archiveSHA256}));
