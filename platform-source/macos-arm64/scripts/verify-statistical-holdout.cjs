// Additional seeds and longer histories, fixed after selecting the protocol.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const bundle=path.resolve('out/qa-temp/statistical-tools/holdout.cjs');
esbuild.buildSync({stdin:{contents:"export * from './src/core/evidence';export * from './src/core/statisticalCalibration.testSupport';",resolveDir:process.cwd()},bundle:true,platform:'node',outfile:bundle});
const api=require(bundle),cells=[];
for(const scenario of ['independent','serial','skew','heteroskedastic'])for(const days of [90,180,365]){
 let flags=0,intervals=0,covered=0;const reps=1000;
 for(let r=0;r<reps;r++){
  const rows=api.calibrationHistory(812738491+r*61169+days,days,0,scenario),f=api.calibrationFactors[scenario==='serial'?1:0],e=api.compareEvidence(rows,f,scenario==='serial'?'Music':'Library','focus',{includeUntouched:false,withinSubject:false});
  flags+=Number(e.status==='exploratory');if(e.uncertainty.low!==null){intervals++;covered+=Number(e.uncertainty.low<=0&&e.uncertainty.high>=0)}
 }
 cells.push({scenario,days,reps,flags,intervals,covered});
}
const result={algorithm:api.EVIDENCE_VERSION,scope:'Selected comparisons only; new seeds, no protocol retuning; fixed snapshots.',cells};
fs.writeFileSync('docs/verification/statistical-validity-20261017/holdout-simulations.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
