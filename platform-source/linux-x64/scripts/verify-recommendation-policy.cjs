// Fictional, deterministic before/after verification. No DB or installed app.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),esbuild=require('esbuild'),crypto=require('node:crypto');
const scratch=path.resolve('out/qa-temp/recommendation-tools'),output=path.resolve('docs/verification/recommendation-policy-20261017');fs.mkdirSync(scratch,{recursive:true});fs.mkdirSync(output,{recursive:true});
function bundle(baseline){
 let root=process.cwd();
 if(baseline){root=path.join(scratch,'baseline');fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.cpSync('src/core',path.join(root,'src/core'),{recursive:true});for(const name of ['recommendations.ts','personalInsights.ts','discoveries.ts','studyTools.ts'])fs.writeFileSync(path.join(root,'src/core',name),cp.execFileSync('git',['show','ecb96e2:src/core/'+name]));}
 const file=path.join(scratch,baseline?'before.cjs':'after.cjs');esbuild.buildSync({stdin:{contents:"export * from './src/core/personalInsights';export * from './src/core/insights';export * from './src/core/recommendationPolicy.testSupport';",resolveDir:root},bundle:true,platform:'node',outfile:file,logLevel:'silent'});return require(file);
}
const before=bundle(true),after=bundle(false),results=[];
for(const type of ['methods','environment'])for(const option of type==='methods'?['Re-reading','Self-testing','Highlighting','Reading','Worked examples','Flashcards']:['Library']){
 const factor=type==='methods'?{...after.methodFactor,options:[option,option==='Self-testing'?'Re-reading':'Self-testing']}:after.environmentFactor,rows=after.policyHistory(factor,option),input={today:'2026-08-28'},o={includeUntouched:false,withinSubject:false};
 const b=before.generatePersonalInsights(rows,[factor],o,input),a=after.generatePersonalInsights(rows,[factor],o,input),eb=before.compare(rows,factor,option,'focus').evidence,ea=after.compare(rows,factor,option,'focus').evidence;
 // Action metadata may change; all inferential results must remain identical.
 const inference=e=>{const {permittedActions,...rest}=e;return rest};assert.deepEqual(inference(eb),inference(ea));assert.equal(ea.status,'exploratory');
 const get=r=>r.candidates.filter(c=>c.factorKey===factor.key).map(c=>({outcome:c.outcome,action:c.action,proposal:!!c.trial}));
 const old=get(b),current=get(a);if(type==='methods'){assert.ok(old.some(c=>c.proposal));assert.ok(current.every(c=>!c.action&&!c.proposal))}else{assert.ok(current.some(c=>c.outcome==='focus'&&c.proposal));assert.ok(current.filter(c=>c.outcome!=='focus').every(c=>!c.proposal))}
 results.push({type,option,sessions:rows.length,days:240,observationStatus:ea.status,estimate:ea.estimate,inferenceUnchanged:true,before:old,after:current,beforeHeadlines:b.cards.map(c=>c.action).filter(Boolean),afterHeadlines:a.cards.map(c=>c.action).filter(Boolean)});
}
const protectedFiles=['src/core/evidence.ts','src/core/statisticalMath.ts','src/core/followupEvidence.ts','src/core/timer.ts','src/main/session.ts','src/core/adviceCatalog.ts','src/core/adviceCopy.json','src/core/advice.ts','src/core/learnCopy.json','src/core/learnExpansionCopy.json'];
const hashes=protectedFiles.map(file=>{const current=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),original=cp.execFileSync('git',['show','ecb96e2:'+file],{maxBuffer:10*1024*1024,encoding:'utf8'}).replaceAll('\r\n','\n');assert.equal(current,original,file);return {file,unchanged:true,lineEndings:'LF-normalized',sha256:crypto.createHash('sha256').update(current).digest('hex')}});
const receipt={baseline:'ecb96e2',scope:'Recorded associations retained; no method is promoted from immediate self-ratings. No changes to statistical calculations, timing or canonical advice/Learn.',results,protectedFiles:hashes};fs.writeFileSync(path.join(output,'policy-simulations.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({scenarios:results.length,inferenceUnchanged:true,protectedFiles:hashes.length}));
