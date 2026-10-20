const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict'),ts=require('typescript');
(async()=>{
 const asar=await import('@electron/asar'),base=path.resolve('dist/statistical-reliability-20261018-acceptance'),archive=path.join(base,'win-unpacked/resources/app.asar'),installer=path.join(base,'FocusRecall-0.1.0-beta.27-setup.exe');
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]),normalize=b=>b.toString('utf8').replaceAll('\r\n','\n');
 const files=['out/main','out/preload','out/renderer'].flatMap(walk).map(f=>{const name=f.replaceAll('\\','/'),hash=sha(fs.readFileSync(f));assert.equal(sha(asar.extractFile(archive,path.normalize(name))),hash,name);return {file:name,sha256:hash}});
 const previous=JSON.parse(fs.readFileSync('docs/verification/home-usability-20261018/artifacts.json','utf8'));
 const protectedFiles=[...previous.protectedFiles,{file:previous.archive,sha256:previous.archiveSHA256},{file:previous.installer,sha256:previous.installerSHA256}].map(p=>{assert.equal(sha(fs.readFileSync(p.file)),p.sha256,p.file);return {...p,unchanged:true}});
 const allowed=new Set(['src/core/evidence.ts','src/core/insights.ts']);
 const protectedSources=[...previous.protectedSources.map(p=>p.file),'src/core/followupEvidence.ts','src/core/statsAnalysis.ts','src/renderer/src/tabs/stats/statsAnalysis.worker.ts','src/core/recommendations.ts','src/core/learn.ts'].filter((f,i,a)=>!allowed.has(f)&&a.indexOf(f)===i&&fs.existsSync(f)).map(file=>{const current=normalize(fs.readFileSync(file)),original=normalize(cp.execFileSync('git',['show','5d6ad2f:'+file],{maxBuffer:16*1024*1024}));assert.equal(current,original,file);return {file,unchanged:true,sha256:sha(Buffer.from(current))}});
 const functions=[];
 for(const [file,names]of [['src/core/evidence.ts',['discoveryQuestions','screenEvidence']],['src/core/insights.ts',['screenComparison','rankFactors']]]){
  const current=normalize(fs.readFileSync(file)),original=normalize(cp.execFileSync('git',['show','5d6ad2f:'+file]));
  const extract=(text,name)=>{const sf=ts.createSourceFile(file,text,99,true);return sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)?.getText(sf)};
  for(const name of names){assert.ok(extract(current,name));assert.equal(extract(current,name),extract(original,name),name);functions.push({file,name,unchanged:true})}
 }
 const native='resources/native/win32-x64/foreground.node',packagedNative=path.join(base,'win-unpacked/resources/app.asar.unpacked',native);assert.equal(sha(fs.readFileSync(native)),sha(fs.readFileSync(packagedNative)));assert.equal(sha(fs.readFileSync(packagedNative)),previous.nativeSHA256);
 assert.equal(sha(fs.readFileSync('resources/legal/PRIVACY.txt')),sha(fs.readFileSync(path.join(base,'win-unpacked/resources/legal/PRIVACY.txt'))));
 const audit=walk('docs/audit-final-20261018').map(file=>({file,sha256:sha(fs.readFileSync(file))}));
 const result={baseline:'5d6ad2f',archive,archiveSHA256:sha(fs.readFileSync(archive)),installer,installerSHA256:sha(fs.readFileSync(installer)),installerExecuted:false,allBuiltRuntimeFilesMatch:true,files,protectedFiles,protectedSources,protectedSearchFunctions:functions,nativeSHA256:sha(fs.readFileSync(packagedNative)),auditReadOnlyManifest:audit};
 fs.writeFileSync('docs/verification/statistical-reliability-20261018/artifacts.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,files:files.length,protectedFiles:protectedFiles.length,protectedSources:protectedSources.length,auditReadOnlyManifest:audit.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
