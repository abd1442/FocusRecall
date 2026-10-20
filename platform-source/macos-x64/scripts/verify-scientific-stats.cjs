// Deterministic synthetic calculations only. No application profile is opened.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('docs/verification/stats-stage1-20261016');fs.mkdirSync(output,{recursive:true});
const bundle=path.resolve('out/qa-temp/scientific-stats-check.cjs');
require('esbuild').buildSync({stdin:{contents:`export {generatePersonalInsights} from './src/core/personalInsights';export {compareEvidence} from './src/core/evidence';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:bundle});
const {generatePersonalInsights,compareEvidence}=require(bundle),options={includeUntouched:false,withinSubject:false};
const factor={key:'place',label:'Place',semanticKey:'place',group:'setup',options:['Library','Home'],multi:false};
const row=(i,p={})=>{const start=Date.UTC(2026,0,1+i);return {id:i+1,start,end:start+1800000,day:new Date(start).toISOString().slice(0,10),hour:10,sittingId:i+1,itemId:1,itemIds:[1],activity:'reading',timerMode:'fixed',targetSeconds:1800,focusSeconds:1800,outcomes:{focus:i%2?2:4,recall:i%2?2:4},factors:{place:[i%2?'Home':'Library']},untouchedOutcomes:[],untouchedFactors:[],distractions:[],rest:null,...p}};
let seed=912345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const factors=[factor,...Array.from({length:5},(_,i)=>({...factor,key:'placebo-'+i,label:'Fictional '+i}))];
let historiesWithExploratory=0,exploratoryCards=0,confirmedCards=0,automaticStrongClaims=0;
for(let run=0;run<100;run++){
  const rows=Array.from({length:80},(_,i)=>row(i,{outcomes:{focus:1+Math.floor(random()*5),recall:1+Math.floor(random()*5)},factors:Object.fromEntries(factors.map(f=>[f.key,[random()<.5?'Home':'Library']]))}));
  const r=generatePersonalInsights(rows,factors,options,{today:'2026-10-16'}),cards=r.cards.filter(c=>c.sharedEvidence);
  historiesWithExploratory+=Number(cards.length>0);exploratoryCards+=cards.length;confirmedCards+=cards.filter(c=>c.replicated).length;automaticStrongClaims+=cards.filter(c=>c.evidence==='Stronger evidence').length;
}
assert.equal(confirmedCards,0);assert.equal(automaticStrongClaims,0);
let persistentSeed=12345,persistentHistoriesWithExploratory=0;
const persistentRandom=()=>{persistentSeed=(Math.imul(persistentSeed,1664525)+1013904223)>>>0;return persistentSeed/4294967296};
for(let run=0;run<100;run++){
  let rating=3,condition=persistentRandom()<.5;
  const rows=Array.from({length:100},(_,i)=>{rating=.8*rating+.2*(1+persistentRandom()*4);if(persistentRandom()<.1)condition=!condition;return row(i,{outcomes:{focus:Math.round(rating*2)/2},factors:{place:[condition?'Library':'Home']}})});
  const r=generatePersonalInsights(rows,[factor],options,{today:'2026-10-16'});
  persistentHistoriesWithExploratory+=Number(r.cards.some(c=>c.sharedEvidence));
  assert.ok(r.cards.every(c=>!c.replicated&&c.evidence!=='Stronger evidence'));
}
const large=Array.from({length:12000},(_,i)=>{const day=new Date(Date.UTC(2024,0,1+Math.floor(i/12))).toISOString().slice(0,10);return row(i,{day,start:Date.parse(day+'T10:00:00Z'),end:Date.parse(day+'T10:30:00Z'),hour:i%2?14:8})});
const samples=[];for(let i=0;i<4;i++){const start=performance.now();generatePersonalInsights(large,[factor],options,{today:'2026-10-16'});samples.push(+(performance.now()-start).toFixed(1))}
const base=Array.from({length:40},(_,i)=>row(i)),confounded=base.map((r,i)=>({...r,itemId:i%2?2:1,itemIds:[i%2?2:1]}));
assert.equal(compareEvidence(confounded,factor,'Library','focus',options).status,'insufficient');
const result={date:new Date().toISOString(),seed:912345,nullSimulations:100,factorsSearched:factors.length,historiesWithExploratory,exploratoryCards,confirmedCards,automaticStrongClaims,persistentNullSimulations:100,persistentSeed:12345,persistentHistoriesWithExploratory,confoundedComparison:'insufficient',largeInputRecords:12000,fullGeneratorMilliseconds:samples,interpretation:'Chance exploratory findings remain possible, especially with dependent histories. None is called independently confirmed; these simulations do not establish an error-rate guarantee or educational benefit. Timings cover a synthetic core calculation, not application startup or whole-app responsiveness.'};
fs.writeFileSync(path.join(output,'simulation-performance.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
