const fs=require('node:fs'),esbuild=require('esbuild');
(async()=>{
 await require('./lib/final-stats-baseline.cjs').build();
 esbuild.buildSync({stdin:{contents:"export * from './src/core/evidence';export {DEFAULT_ANALYSIS} from './src/core/insights';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'out/qa-temp/final-stats-candidate.cjs'});
 const old=require('../out/qa-temp/final-stats-baseline.cjs'),now=require('../out/qa-temp/final-stats-candidate.cjs'),result={cells:[],monotonicity:null};
 for(const [name,mood]of [['iid',{kind:'iid',sd:.5}],['ar90',{kind:'ar',rho:.9,sd:.25}],['ar97',{kind:'ar',rho:.97,sd:.15}],['walk',{kind:'walk',sd:.08}]]){
  const counts=[{flags:0,available:0},{flags:0,available:0}];
  for(let r=0;r<200;r++)for(const [i,e]of [old,now].entries()){
   const v=e.compareEvidence(old.history(9001+r*7919+365*13+28,{days:365,mood,runDays:28}),old.baseFactors[0],'Library','focus',old.DEFAULT_ANALYSIS);
   counts[i].flags+=v.status==='exploratory';counts[i].available+=v.testing.pValue!==null;
  }
  result.cells.push({mood:name,reps:200,baseline:counts[0],candidate:counts[1]});
 }
 const b=JSON.parse(fs.readFileSync('docs/verification/statistical-reliability-20261018/baseline-reproduction.json','utf8'));
 const base=old.history(42,{days:180,mood:{kind:'iid',sd:.5},runDays:1,effect:1}).map(s=>({...s,itemId:1,itemIds:[1]})),template=base.find(s=>s.day==='2026-03-02');
 const add=Array.from({length:4},(_,i)=>{const start=Date.UTC(2026,2,2+i,9);return {...template,id:90000+i,itemId:3,itemIds:[3],start,end:start+1800000,day:new Date(start).toISOString().slice(0,10),outcomes:{...template.outcomes,focus:i%2?3:5},factors:{...template.factors,place:[i%2?'Home':'Library']}}});
 result.monotonicity={baseline:b.monotonicity,candidate:{before:now.compareEvidence(base,old.baseFactors[0],'Library','focus',old.DEFAULT_ANALYSIS),after:now.compareEvidence([...base,...add],old.baseFactors[0],'Library','focus',old.DEFAULT_ANALYSIS)}};
 fs.writeFileSync('docs/verification/statistical-reliability-20261018/audit-paired.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.cells));console.log(JSON.stringify({before:result.monotonicity.candidate.before.testing,after:result.monotonicity.candidate.after.testing}));
})().catch(e=>{console.error(e);process.exitCode=1});
