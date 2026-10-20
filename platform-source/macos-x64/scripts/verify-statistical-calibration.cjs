// Deterministic, fictional simulations of the actual Stats pipeline.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const baseline=process.argv.includes('--baseline'),reps=Number(process.env.FOCUSRECALL_SIM_REPS||200),scratch=path.resolve('out/qa-temp/statistical-tools');fs.mkdirSync(scratch,{recursive:true});
const bundle=path.join(scratch,baseline?'baseline.cjs':'current.cjs');
let sourceRoot=process.cwd();
if(baseline){
 const cp=require('node:child_process'),snapshot=path.join(scratch,'baseline-source','src');fs.mkdirSync(snapshot,{recursive:true});fs.cpSync('src/core',path.join(snapshot,'core'),{recursive:true});
 for(const name of ['evidence.ts','insights.ts','personalInsights.ts','report.ts'])fs.writeFileSync(path.join(snapshot,'core',name),cp.execFileSync('git',['show','bd4debf:src/core/'+name]));
 sourceRoot=path.dirname(snapshot);
}
esbuild.buildSync({stdin:{contents:`export * from './src/core/evidence';export * from './src/core/insights';export * from './src/core/personalInsights';export * from './src/core/report';`,resolveDir:sourceRoot},bundle:true,platform:'node',format:'cjs',outfile:bundle,alias:{'@core':path.join(sourceRoot,'src/core')},logLevel:'silent'});
const fixtureBundle=path.join(scratch,'fixtures.cjs');esbuild.buildSync({entryPoints:['src/core/statisticalCalibration.testSupport.ts'],bundle:true,platform:'node',format:'cjs',outfile:fixtureBundle,logLevel:'silent'});
const api={...require(bundle),...require(fixtureBundle)},o={includeUntouched:false,withinSubject:false},f=api.calibrationFactors;
const cells=[];
for(const scenario of ['independent','serial','skew','heteroskedastic','subject-confounding','time-confounding'])for(const days of [15,30,60,90]){
 let explicit=0,panel=0,cards=0,reports=0,covered=0,intervals=0;
 for(let r=0;r<reps;r++){
  const rows=api.calibrationHistory(1234567+r*99991+days,days,0,scenario),e=api.compareEvidence(rows,scenario==='serial'?f[1]:f[0],scenario==='serial'?'Music':'Library','focus',o),rank=api.rankFactors(rows,f,'focus',o);
  explicit+=Number(e.status==='exploratory');panel+=Number(rank.positive.length+rank.negative.length>0);
  if(e.uncertainty.low!==null){intervals++;covered+=Number(e.uncertainty.low<=0&&e.uncertainty.high>=0)}
  if(r<Math.min(reps,100)){cards+=Number(api.generatePersonalInsights(rows,f,o,{today:rows.at(-1).day}).cards.some(c=>c.sharedEvidence?.status==='exploratory'));reports+=Number(api.reportComparisons(rows,f,o).some(c=>c.evidence?.status==='exploratory'))}
 }
 cells.push({scenario,days,reps,explicit,panel,cards,cardsReps:Math.min(reps,100),reports,reportReps:Math.min(reps,100),intervals,covered});
}
const power=[];
for(const effect of [.2,.5,1,1.5])for(const days of [30,90,180,365]){
 let explicit=0,target=0,any=0,cards=0;
 for(let r=0;r<reps;r++){
  const rows=api.calibrationHistory(987654+r*77773+days,days,effect),e=api.compareEvidence(rows,f[0],'Library','focus',o),rank=api.rankFactors(rows,f,'focus',o);
  explicit+=Number(e.status==='exploratory'&&(e.estimate??0)>0);target+=Number(rank.positive.some(c=>c.factor.key==='place'&&c.option==='Library'));any+=Number(rank.positive.length+rank.negative.length>0);
  if(r<Math.min(reps,100))cards+=Number(api.generatePersonalInsights(rows,f,o,{today:rows.at(-1).day}).cards.some(c=>c.factorKey==='place'&&c.sharedEvidence?.status==='exploratory'&&((c.rows[0].label==='Library'?1:-1)*(c.sharedEvidence.estimate??0)>0)));
 }
 power.push({effect,days,reps,explicit,target,any,cards,cardsReps:Math.min(reps,100)});
}
const result={baselineCommit:baseline?'bd4debf':null,algorithm:api.EVIDENCE_VERSION,seeded:true,reps,cells,power,scope:'Null means no within-subject/activity association for independent/serial. Subject/time confounding are stress scenarios, not causal identifiability guarantees. Fixed snapshots, not lifetime repeated browsing.'};
const outfile=path.resolve('docs/verification/statistical-validity-20261017/'+(baseline?'before':'after')+'-simulations.json');fs.writeFileSync(outfile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
