// Real packaged renderer: retained sections, worker parity/cancellation/failure,
// restored outcomes, weekly drafts, and navigable long fictional histories.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/theme-qa.cjs');
function equalEngine(actual,expected,key='result'){
 if(typeof actual==='number'&&typeof expected==='number'){const scale=Math.max(Math.abs(actual),Math.abs(expected));assert.ok(Object.is(actual,expected)||Math.abs(actual-expected)<=scale*1e-12,key+': '+actual+' vs '+expected);return}
 if(actual&&expected&&typeof actual==='object'&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected),key);for(const k of Object.keys(expected))equalEngine(actual[k],expected[k],key+'.'+k);return}
 assert.equal(actual,expected,key);
}
(async()=>{
 const q=await open({root:process.env.FOCUSRECALL_PERF_STATS_ROOT||'out/qa-temp/performance-stats',output:process.env.FOCUSRECALL_PERF_STATS_OUTPUT||'docs/verification/performance-20261018/stats',seedDirectory:'out/qa-temp/performance-seed-156'});
 const {page,invoke,output}=q,r={archiveSHA256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(path.dirname(q.exe),'resources/app.asar'))).digest('hex'),checks:[],sections:[]},original=await q.snapshot();
 const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const ready=selector=>page.waitForFunction(s=>document.querySelector(s)?.getAttribute('aria-busy')==='false'&&!document.querySelector(s)?.querySelector('[role=alert]'),selector,{timeout:120000});
 const check=(name)=>{r.checks.push(name);console.log('CHECK '+name)};
 const section=async(group,label,id)=>{const t=performance.now();await page.locator('.stats-primary-nav').getByRole('button',{name:group,exact:true}).click();if(label)await page.locator('.stats-secondary-nav').getByRole('button',{name:label,exact:true}).click();await page.locator('#stats-'+id).waitFor({state:'visible'});await frames();r.sections.push({id,paintMs:+(performance.now()-t).toFixed(1)});};
 try{
  await page.evaluate(()=>{
   const NativeWorker=window.Worker;window.qaWorkers={created:0,terminated:0,active:0,blocked:false,jobs:[],completed:[]};
   window.Worker=class extends NativeWorker {
    constructor(...args){if(qaWorkers.blocked)throw Error('Fictional blocked worker');super(...args);this.qaDone=false;qaWorkers.created++;qaWorkers.active++;this.addEventListener('message',e=>qaWorkers.completed.push({job:this.qaJob,result:e.data.result}));}
    postMessage(job,...args){this.qaJob=structuredClone(job);qaWorkers.jobs.push(job.kind);return super.postMessage(job,...args)}
    terminate(){if(!this.qaDone){this.qaDone=true;qaWorkers.active--;qaWorkers.terminated++}return super.terminate()}
   };
  });
  await page.getByRole('button',{name:'Stats',exact:true}).click();await ready('[data-stats-analysis]');
  assert.equal(await page.locator('#stats-report').count(),0);assert.equal(await page.locator('#stats-factors').count(),0);check('Unvisited expensive sections are not mounted');
  await page.getByRole('button',{name:'Adjust filters',exact:true}).click();
  for(const range of ['all','last-30','all'])await page.getByLabel('Dates',{exact:true}).selectOption(range);
  await ready('[data-stats-analysis]');assert.equal(await page.evaluate(()=>qaWorkers.active),0);check('Superseded personal analyses terminate; final scope completes without stale findings');
  await section('Comparisons',null,'factors');await ready('[data-stats-ranking]');
  await page.locator('#stats-factors').getByLabel('Looking at').selectOption('recall');await ready('[data-stats-ranking]');
  await section('Comparisons','Time patterns','time');await section('Comparisons',null,'factors');
  assert.equal(await page.locator('#stats-factors').getByLabel('Looking at').inputValue(),'recall');check('Visited comparison outcome survives navigation');
  await invoke('tools:saveView',{id:'performance-fictional',name:'Fictional recall view',range:'last-30',custom:{from:'2026-09-01',to:'2026-10-17'},filter:{itemId:null,categoryId:null,activity:null},options:{withinSubject:false,includeUntouched:false},outcome:'recall'});
  await page.getByRole('button',{name:'Saved views',exact:true}).click();await page.locator('#stats-tools').getByRole('button',{name:'Open view',exact:true}).click();
  await page.getByLabel('Close Stats companion',{exact:true}).click();
  await section('Activity','Study-time milestones','stage');assert.equal(await page.locator('#stats-stage').getByLabel('Looking at').inputValue(),'recall');check('Saved View restores outcome in a section that was never mounted');
  await section('Activity',null,'weekly');await page.getByLabel('Review week',{exact:true}).fill('2026-10-05');await page.getByText('Add a reflection or next step',{exact:true}).click();await page.getByLabel('Weekly reflection',{exact:true}).fill('Fictional unsaved reflection retained between sections.');
  await section('Report',null,'report');await section('Activity',null,'weekly');assert.equal(await page.getByLabel('Weekly reflection',{exact:true}).inputValue(),'Fictional unsaved reflection retained between sections.');check('Unsaved weekly reflection survives section navigation');
  await page.getByRole('button',{name:'Saved views',exact:true}).click();await page.getByLabel('Comparison view name',{exact:true}).fill('Fictional unsaved view draft');await page.getByLabel('Close Stats companion',{exact:true}).click();await page.getByRole('button',{name:'Saved views',exact:true}).click();assert.equal(await page.getByLabel('Comparison view name',{exact:true}).inputValue(),'Fictional unsaved view draft');await page.getByLabel('Close Stats companion',{exact:true}).click();check('Saved View draft survives companion close/reopen');
  await section('Your insights',null,'insights');await ready('[data-stats-analysis]');await page.screenshot({path:path.join(output,'en-stats.png')});
  await invoke('settings:set','language','ar');await page.waitForFunction(()=>document.documentElement.dir==='rtl');await ready('[data-stats-analysis]');await frames();await page.screenshot({path:path.join(output,'ar-stats.png')});await invoke('settings:set','language','en');check('English and Arabic RTL rendered with completed analysis');
  // Compare full worker results (including every interval/correction/action)
  // against the accepted engine, not just displayed card counts.
  const records=await page.evaluate(()=>JSON.stringify(qaWorkers.completed.filter(x=>x.result),(_k,v)=>v instanceof Map?{qaMap:[...v]}:v));
  const file=path.resolve('out/qa-temp/performance-analysis-parity.cjs');require('esbuild').buildSync({stdin:{contents:"export {runStatsAnalysis} from './src/core/statsAnalysis'",resolveDir:process.cwd()},bundle:true,platform:'node',outfile:file,logLevel:'silent'});
  const {runStatsAnalysis}=require(file),completed=JSON.parse(records,(_k,v)=>v&&v.qaMap?new Map(v.qaMap):v);
  for(const entry of completed)equalEngine(entry.result,JSON.parse(JSON.stringify(runStatsAnalysis(entry.job))));r.workerParityResults=completed.length;r.numericTolerance='1e-12 relative across Node/Electron V8; classifications, coverage, text and actions exact';check('All captured worker results match direct accepted-engine calculations, including classifications and actions');
  await page.getByRole('button',{name:'Home',exact:true}).click();await page.waitForFunction(()=>qaWorkers.active===0);
  await page.evaluate(()=>qaWorkers.blocked=true);await page.getByRole('button',{name:'Stats',exact:true}).click();await page.locator('[data-stats-analysis] [role=alert]').waitFor();assert.equal(await page.locator('[data-stats-analysis] [data-insight-id]').count(),0);assert.equal(await page.locator('[data-stats-analysis]').getAttribute('aria-busy'),'false');await page.locator('[data-stats-analysis]').screenshot({path:path.join(output,'worker-blocked.png')});
  await page.evaluate(()=>qaWorkers.blocked=false);await page.locator('[data-stats-analysis]').getByRole('button',{name:'Try again',exact:true}).click();await ready('[data-stats-analysis]');check('Blocked worker exposes retry, never empty or stale scientific conclusions; retry succeeds');
  await page.getByRole('button',{name:'Adjust filters',exact:true}).click();await page.getByLabel('Dates',{exact:true}).selectOption('all');await page.waitForFunction(()=>qaWorkers.active>0);const leave=performance.now();await page.getByRole('button',{name:'Home',exact:true}).click();await page.waitForFunction(()=>qaWorkers.active===0);r.leaveDuringAnalysisMs=+(performance.now()-leave).toFixed(1);check('Leaving Stats terminates active analysis');
  r.workers=await page.evaluate(()=>({created:qaWorkers.created,terminated:qaWorkers.terminated,active:qaWorkers.active}));assert.equal(r.workers.active,0);assert.equal(r.workers.created,r.workers.terminated);
  assert.deepEqual(await q.snapshot(),original);assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);r.historyUnchanged=true;r.rendererErrors=[];r.network=[];r.success=true;
 }finally{fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(r,null,2)+'\n');await q.close()}
 console.log('PASS packaged Stats responsiveness '+JSON.stringify(r));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
