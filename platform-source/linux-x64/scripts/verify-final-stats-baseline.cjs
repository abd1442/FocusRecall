// Preserve the independent audit evidence: write new receipts only.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
await require('./lib/final-stats-baseline.cjs').build();
const e=require('../out/qa-temp/final-stats-baseline.cjs');
const options=e.DEFAULT_ANALYSIS,place=e.baseFactors[0],output='docs/verification/statistical-reliability-20261018';
const result={baseCommit:'5d6ad2f',auditNull:[],monotonicity:null};
for(const [name,mood]of [['iid',{kind:'iid',sd:.5}],['ar90',{kind:'ar',rho:.9,sd:.25}],['ar97',{kind:'ar',rho:.97,sd:.15}],['walk',{kind:'walk',sd:.08}]]){
 let flags=0,intervals=0;const times=[];
 for(let r=0;r<200;r++){
  const rows=e.history(9001+r*7919+365*13+28,{days:365,mood,runDays:28}),start=performance.now(),v=e.compareEvidence(rows,place,'Library','focus',options);times.push(performance.now()-start);flags+=v.status==='exploratory';intervals+=v.testing.pValue!==null;
 }
 const cell={days:365,runDays:28,mood:name,reps:200,flags,rate:flags/200,intervals,meanMs:times.reduce((a,b)=>a+b,0)/times.length};result.auditNull.push(cell);console.log(JSON.stringify(cell));
}
const base=e.history(42,{days:180,mood:{kind:'iid',sd:.5},runDays:1,effect:1}).map(s=>({...s,itemId:1,itemIds:[1]}));
const template=base.find(s=>s.day==='2026-03-02');const add=Array.from({length:4},(_,i)=>{const start=Date.UTC(2026,2,2+i,9);return {...template,id:90000+i,itemId:3,itemIds:[3],start,end:start+1800000,day:new Date(start).toISOString().slice(0,10),outcomes:{...template.outcomes,focus:i%2?3:5},factors:{...template.factors,place:[i%2?'Home':'Library']}}});
result.monotonicity={before:e.compareEvidence(base,place,'Library','focus',options),after:e.compareEvidence([...base,...add],place,'Library','focus',options)};
fs.writeFileSync(path.join(output,'baseline-reproduction.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({before:result.monotonicity.before.testing,after:result.monotonicity.after.testing}));
})().catch(e=>{console.error(e);process.exitCode=1});
