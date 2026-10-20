// Synthetic local history only; does not read an application database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('docs/verification/advice-stage2-20261016'),bundle=path.resolve('out/qa-temp/advice-selection-check.cjs');
fs.mkdirSync(output,{recursive:true});
require('esbuild').buildSync({stdin:{contents:`export * from './src/core/advice';export * from './src/core/adviceCatalog';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:bundle});
const {selectAdvice,lessAdvice,normalizeAdviceHistory,adviceConcept}=require(bundle);
const base=Date.UTC(2026,0,1);let history=null,selected=0,silent=0,maxEntries=0,maxBytes=0;const times=[],concepts=new Set();
for(let day=0;day<180;day++)for(let sitting=0;sitting<3;sitting++)for(const [step,surface] of ['prepare','recall','rest','return'].entries()){
 const now=base+day*86400000+sitting*10800000+step*600000,start=performance.now();
 const result=selectAdvice(history,surface,day%3===0?'practice':day%3===1?'remember':'understand',false,now);times.push(performance.now()-start);history=result.history;
 if(result.id){selected++;concepts.add(result.id);assert.ok(adviceConcept(result.id).surfaces.includes(surface))}else silent++;
 maxEntries=Math.max(maxEntries,history.exposures.length);maxBytes=Math.max(maxBytes,JSON.stringify(history).length);assert.ok(history.exposures.length<=200);
}
const now=base+180*86400000;
for(const id of ['choose-target','restart-note','plan-feasible','return-small'])history=lessAdvice(history,id,now);
for(let i=0;i<20;i++){const result=selectAdvice(history,'prepare','any',true,now+i);history=result.history;assert.notEqual(result.id&&adviceConcept(result.id).topic,'planning')}
assert.deepEqual(normalizeAdviceHistory(null,now).exposures,[]);
times.sort((a,b)=>a-b);const result={scope:'Synthetic selection only; not startup, whole-app responsiveness, usability or educational benefit.',days:180,requests:times.length,selected,silent,distinctConcepts:concepts.size,maxEntries,maxBytes,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],maximumMs:times.at(-1)};
fs.writeFileSync(path.join(output,'selection-simulation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
