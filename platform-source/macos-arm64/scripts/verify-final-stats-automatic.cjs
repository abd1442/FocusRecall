// Automatic focus-screen family check: fixed full search budgets, never
// selecting eligible questions first. Uses the auditor's fictional generator.
const fs=require('node:fs'),old=require('../out/qa-temp/final-stats-baseline.cjs'),now=require('../out/qa-temp/final-stats-candidate.cjs');
const result={seeds:[15485863,105943],repsPerSeed:40,cells:[]};
for(const factors of [old.baseFactors,old.manyFactors(20)])for(const [name,sc]of [
 ['iid-null',{days:365,runDays:1,mood:{kind:'iid',sd:.5}}],
 ['persistent-null',{days:365,runDays:28,mood:{kind:'ar',rho:.97,sd:.15}}],
 ['strong-effect',{days:180,runDays:1,mood:{kind:'iid',sd:.5},effect:1}],
 ['moderate-effect',{days:365,runDays:1,mood:{kind:'iid',sd:.5},effect:.5}]
]){
 const cells=[];
 for(const seed of result.seeds){const scores=[{anyFlag:0,planted:0},{anyFlag:0,planted:0}];
  for(let i=0;i<result.repsPerSeed;i++){
   const rows=old.history(seed+i*104729,{...sc,factors});
   for(const [j,e]of [old,now].entries()){
    const q=e.discoveryQuestions(factors,rows),findings=factors.flatMap(f=>f.options.map(option=>({factor:f.key,option,evidence:e.screenEvidence(e.compareEvidence(rows,f,option,'focus',old.DEFAULT_ANALYSIS),q)}))).filter(c=>c.evidence.status==='exploratory');
    scores[j].anyFlag+=findings.length>0;scores[j].planted+=findings.some(c=>c.factor==='place'&&c.option==='Library'&&c.evidence.estimate>0);
   }
  }
  cells.push({seed,baseline:scores[0],candidate:scores[1]});
 }
 result.cells.push({name,factors:factors.length,questions:old.discoveryQuestions(factors),scenario:sc,cells});console.log(JSON.stringify(result.cells.at(-1)));
}
fs.writeFileSync('docs/verification/statistical-reliability-20261018/automatic-family.json',JSON.stringify(result,null,2)+'\n');
