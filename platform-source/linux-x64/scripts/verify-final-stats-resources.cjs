// Separate child processes, identical fictional inputs, warm-up and forced GC.
const cp=require('node:child_process'),fs=require('node:fs');
if(process.argv[2]){
 const old=require('../out/qa-temp/final-stats-baseline.cjs'),engine=require('../out/qa-temp/final-stats-'+process.argv[2]+'.cjs'),out=[];
 for(const [name,sc,reps]of [['month',{days:365,runDays:28,mood:{kind:'ar',rho:.97,sd:.15}},200],['long',{days:1200,runDays:1,mood:{kind:'ar',rho:.97,sd:.15},sessionsPerDay:[10,10]},40]]){
  const rows=old.history(18273645,sc),run=()=>engine.compareEvidence(rows,old.baseFactors[0],'Library','focus',old.DEFAULT_ANALYSIS);
  for(let i=0;i<5;i++)run();global.gc();const before=process.memoryUsage(),times=[];
  for(let i=0;i<reps;i++){const t=performance.now();run();times.push(performance.now()-t)}global.gc();const after=process.memoryUsage();times.sort((a,b)=>a-b);
  out.push({name,records:rows.length,reps,meanMs:times.reduce((a,b)=>a+b,0)/reps,p50Ms:times[Math.floor(reps*.5)],p95Ms:times[Math.floor(reps*.95)],heapBefore:before.heapUsed,heapAfter:after.heapUsed,rssAfter:after.rss,maxRSSKiB:process.resourceUsage().maxRSS});
 }
 console.log(JSON.stringify(out));
}else{
 const result={};for(const engine of ['baseline','candidate'])result[engine]=JSON.parse(cp.execFileSync(process.execPath,['--expose-gc',__filename,engine],{encoding:'utf8',windowsHide:true}));
 fs.writeFileSync('docs/verification/statistical-reliability-20261018/resources.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}
