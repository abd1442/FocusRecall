const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='docs/verification/performance-20261018';
const raw=name=>{const file=path.join(root,name,'measurements.json');return fs.existsSync(file)?fs.readFileSync(file):require('node:zlib').gunzipSync(fs.readFileSync(file+'.gz'))};
const read=name=>JSON.parse(raw(name));
const round=n=>+n.toFixed(1);
const describe=values=>{const a=[...values].sort((a,b)=>a-b),n=a.length;return {n,medianMs:round(n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2),p95Ms:round(a[Math.ceil(n*.95)-1]),minMs:round(a[0]),maxMs:round(a.at(-1))}};
const metrics={homeToPreparation:c=>c.preparationMs,preparationToFocus:c=>c.confirm.ms,focusToMainReview:c=>c.finish.ms,pause:c=>c.pause.ms,resume:c=>c.resume.ms,recallToLog:c=>c.log.ms,logToRest:c=>c.rest.ms};
const final=process.argv.includes('--final');
const runs=final?['final-before-small','final-after-small','final-after-small-reverse','final-before-small-reverse','final-before-large','final-after-large','final-after-large-reverse','final-before-large-reverse']:['before-ui-small-02','after-ui-small-02','after-ui-reverse','before-ui-reverse','before-ui-large-02','after-ui-large-02','after-large-reverse','before-large-reverse'];
const summarize=name=>{const r=read(name);assert.equal(r.success,true);assert.equal(r.originalHistoryUnchanged,true);assert.deepEqual(r.rendererErrors,[]);assert.deepEqual(r.network,[]);return {name,archiveSHA256:r.archiveSHA256,input:r.input,runtime:r.runtime,cycles:r.transitions.length,coldPreparationMs:r.transitions[0].preparationMs,warm:Object.fromEntries(Object.entries(metrics).map(([k,fn])=>[k,describe(r.transitions.slice(1).map(fn))])),stats:r.stats,memory:r.memory.map(m=>({phase:m.phase,totalWorkingSetMiB:round(m.processes.reduce((sum,p)=>sum+p.workingSetKB,0)/1024),rendererHeapMiB:round(m.mainHeap/1048576),mainHeapMiB:m.node?round(m.node.heapUsed/1048576):null,dom:m.dom,processes:m.processes})),historyUnchanged:true}};
const result={method:'Real packaged Home/Ready/Finish clicks; CDP overhead; first cycle reported separately; nearest-rank p95. Sequential A→B and B→A runs; Windows timing variability prevents a universal percentage claim.',runs:runs.map(summarize),pooled:[]};
const pairs=final?[['ordinary',['final-before-small','final-before-small-reverse'],['final-after-small','final-after-small-reverse']],['three-year',['final-before-large','final-before-large-reverse'],['final-after-large','final-after-large-reverse']]]:[['ordinary',['before-ui-small-02','before-ui-reverse'],['after-ui-small-02','after-ui-reverse']],['three-year',['before-ui-large-02','before-large-reverse'],['after-ui-large-02','after-large-reverse']]];
for(const [fixture,before,after]of pairs){
 const values=names=>names.flatMap(n=>read(n).transitions.slice(1));const a=values(before),b=values(after);
 result.pooled.push({fixture,beforeRuns:before,afterRuns:after,metrics:Object.fromEntries(Object.entries(metrics).map(([key,fn])=>[key,{before:describe(a.map(fn)),after:describe(b.map(fn))}]))});
}
result.totalCycles=result.runs.reduce((n,r)=>n+r.cycles,0);
result.nativeDiagnostics=['before-native',final?'after-final-native':'after-native'].map(name=>{const r=read(name),grouped=new Map();for(const event of r.native){const k=event.kind+'.'+event.name,rows=grouped.get(k)??[];rows.push(event.ms);grouped.set(k,rows)}return {name,cycles:r.transitions.length,note:'Instrumentable prototype methods only; own native methods such as setBounds may be absent. Do not sum this as all native work.',methods:[...grouped].map(([name,values])=>({name,calls:values.length,totalMs:round(values.reduce((s,v)=>s+v,0)),...describe(values)}))}});
result.receipts=result.runs.map(r=>{const file=path.join(root,r.name,'measurements.json');return {file,sha256:crypto.createHash('sha256').update(raw(r.name)).digest('hex')}});
fs.writeFileSync(path.join(root,'comparison.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({cycles:result.totalCycles,pooled:result.pooled,stats:result.runs.filter(r=>r.stats.length).map(r=>({name:r.name,stats:r.stats}))},null,2));
