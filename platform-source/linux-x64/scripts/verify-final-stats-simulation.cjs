// Independent generator (Mulberry32), paired baseline/candidate comparisons.
// No application, database, audit evidence or personal profile access.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
(async()=>{
await require('./lib/final-stats-baseline.cjs').build();
esbuild.buildSync({stdin:{contents:"export * from './src/core/evidence'; export {DEFAULT_ANALYSIS} from './src/core/insights';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'out/qa-temp/final-stats-candidate.cjs'});
const old=require('../out/qa-temp/final-stats-baseline.cjs'),now=require('../out/qa-temp/final-stats-candidate.cjs');
const factor={key:'place',semanticKey:'place',label:'Place',options:['Library','Home'],group:'setup',multi:false};
function random(seed){let s=seed>>>0;const u=()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};return {u,n:()=>Math.sqrt(-2*Math.log(Math.max(1e-15,u())))*Math.cos(2*Math.PI*u())}}
function generate(seed,c){
 const {u,n}=random(seed),rows=[];let mood=0,state=u()<.5,next=0;
 for(let d=0;d<c.days;d++){
  mood=c.walk?Math.max(-1.5,Math.min(1.5,mood+n()*.08)):(c.rho??0)*mood+n()*Math.sqrt(1-(c.rho??0)**2)*.65;
  if(c.bounded)mood=Math.max(-.6,Math.min(.6,mood));
  if(d>=next){state=u()<.5;next=d+(c.rareLong?(u()<.12?c.run*40:c.run):c.variable?Math.max(1,Math.round(-Math.log(Math.max(1e-10,u()))*c.run)):c.run)}
  if(u()<(c.missing??0))continue;
  const count=c.bursts?1+Math.floor(u()*9):2;
  for(let k=0;k<count;k++){
   const side=c.run===1?u()<.5:state,item=c.contextConfounding?(u()<(side?.9:.1)?1:2):1+Math.floor(u()*2);
   const drift=c.trend?2*(d/c.days-.5):c.sin?Math.sin(d/75):0;
   const condition=c.singleLong&&d<c.singleLong?true:c.moodSelected?mood>0:c.confounded?d>c.days/2:side;
   const noise=c.bounded?(u()-.5)*.5:n()*.65;
   const value=3+mood+drift+(c.effect??0)*Number(condition)+(c.contextConfounding?(item===1?.8:-.8):0)+noise;
   const start=Date.UTC(2023,0,1+d,9+k),rating=Math.max(1,Math.min(5,Math.round(value)));
   const unanswered=c.ratingMissing&&u()<(condition?.7:.1);
   rows.push({id:rows.length+1,start,end:start+1800000,day:new Date(start).toISOString().slice(0,10),itemId:item,itemIds:[item],activity:'revision',timerMode:'flow',targetSeconds:1500,focusSeconds:1800,outcomes:unanswered?{}:{focus:rating},untouchedOutcomes:[],factors:{place:[condition?'Library':'Home']},untouchedFactors:[]});
  }
 }
 return rows;
}
const scenarios=[
 {name:'iid-daily',days:180,run:1},
 {name:'ar97-daily',days:180,run:1,rho:.97},
 {name:'ar995-week',days:365,run:7,rho:.995},
 {name:'ar97-month',days:365,run:28,rho:.97},
 {name:'walk-month',days:365,run:28,walk:true},
 {name:'ar97-variable-month',days:730,run:28,rho:.97,variable:true,missing:.35},
 {name:'trend-fortnight',days:365,run:14,trend:true},
 {name:'sine-two-months',days:1095,run:56,sin:true},
 {name:'bursts-ar90-3day',days:180,run:3,rho:.9,bursts:true,missing:.35},
 {name:'context-confounding',days:365,run:7,rho:.9,contextConfounding:true},
 {name:'before-after-trend',days:365,run:1,trend:true,confounded:true,interpretation:'No causal condition effect; condition intentionally coincides with calendar trend. NOT a statistical null.'},
 {name:'effect-small-daily',days:180,run:1,rho:.97,effect:.3},
 {name:'effect-daily',days:180,run:1,rho:.97,effect:1},
 {name:'effect-week',days:365,run:7,rho:.97,effect:1},
 {name:'effect-month-year',days:365,run:28,rho:.97,effect:1},
 {name:'effect-month-three-years',days:1095,run:28,rho:.97,effect:1},
 {name:'effect-variable-month',days:1095,run:28,rho:.97,effect:1,variable:true},
 {name:'quarter-year-runs',days:1095,run:90,rho:.995,missing:.2},
 {name:'short-month-history',days:90,run:28,rho:.97},
 {name:'variable-daily',days:365,run:3,rho:.995,variable:true,missing:.5},
 {name:'moderate-effect-daily',days:365,run:1,rho:.97,effect:.5},
 {name:'mood-selected-condition',days:730,run:1,rho:.9,moodSelected:true,interpretation:'No causal condition effect; genuine observational mood association expected. NOT a statistical null.'},
 {name:'condition-dependent-missing-ratings',days:365,run:1,rho:.97,ratingMissing:true},
 {name:'coverage-daily',days:180,run:1,rho:.97,bounded:true,effect:1,knownEffect:1},
 {name:'coverage-month',days:365,run:28,rho:.97,bounded:true,effect:1,knownEffect:1},
 {name:'coverage-month-long',days:1095,run:28,rho:.97,bounded:true,effect:1,knownEffect:1},
 {name:'stress-rare-long-bouts',days:730,run:3,rareLong:true,rho:.995},
 {name:'stress-rare-long-walk',days:730,run:3,rareLong:true,walk:true},
 {name:'stress-rare-long-effect',days:1095,run:3,rareLong:true,rho:.97,effect:1},
 {name:'stress-single-long',days:730,run:3,singleLong:120,rho:.995},
 {name:'stress-single-long-walk',days:730,run:3,singleLong:120,walk:true},
];
const reps=Number(process.env.FINAL_STATS_REPS??200),seeds=(process.env.FINAL_STATS_SEEDS??'104729,32452843,982451653').split(',').map(Number),result={baselineCommit:'5d6ad2f',generator:'Mulberry32 independent histories',candidateSources:Object.fromEntries(['src/core/evidence.ts','src/core/temporalEvidence.ts'].map(f=>[f,require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),seeds,reps,scenarios:[],memoryStart:process.memoryUsage()};
function wilson(k,n){const z=1.96,p=k/n,a=1+z*z/n,b=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [(b-r)/a,(b+r)/a]}
for(const c of scenarios.filter(c=>!process.env.FINAL_STATS_FILTER||new RegExp(process.env.FINAL_STATS_FILTER).test(c.name))){const cells=[];for(const seed of seeds){const engines=[old,now].map(()=>({flags:0,available:0,pRejected:0,excludesZero:0,coversKnownEffect:0,wrongDirection:0,times:[]}));
 for(let r=0;r<reps;r++){const rows=generate((seed+Math.imul(r+1,2654435761))>>>0,c);for(const [i,e]of [old,now].entries()){const t=performance.now(),v=e.compareEvidence(rows,factor,'Library','focus',old.DEFAULT_ANALYSIS),s=engines[i];s.times.push(performance.now()-t);s.flags+=v.status==='exploratory';s.available+=v.testing.pValue!==null;s.pRejected+=v.testing.pValue!==null&&v.testing.pValue<=.05;s.excludesZero+=v.uncertainty.low!==null&&(v.uncertainty.low>0||v.uncertainty.high<0);s.coversKnownEffect+=c.knownEffect!==undefined&&v.uncertainty.low!==null&&v.uncertainty.low<=c.knownEffect&&v.uncertainty.high>=c.knownEffect;s.wrongDirection+=v.status==='exploratory'&&v.estimate<0}}
 cells.push({seed,...Object.fromEntries(engines.map((s,i)=>{s.times.sort((a,b)=>a-b);return [i?'candidate':'baseline',{flags:s.flags,available:s.available,pRejected:s.pRejected,excludesZero:s.excludesZero,coversKnownEffect:c.knownEffect===undefined?null:s.coversKnownEffect,wrongDirection:s.wrongDirection,rate:s.flags/reps,rate95: wilson(s.flags,reps),meanMs:s.times.reduce((a,b)=>a+b,0)/reps,p95Ms:s.times[Math.floor(reps*.95)]}]}))});
 }
 const row={...c,cells};result.scenarios.push(row);console.log(JSON.stringify({name:c.name,baseline:cells.map(x=>x.baseline.flags),candidate:cells.map(x=>x.candidate.flags),available:cells.map(x=>x.candidate.available)}));
}
result.memoryEnd=process.memoryUsage();const output='docs/verification/statistical-reliability-20261018';fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,process.env.FINAL_STATS_RECEIPT??'simulation-development.json'),JSON.stringify(result,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
