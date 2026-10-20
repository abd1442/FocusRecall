// Mutates ONLY a fresh copy of the local production package. No installed files.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const output=path.resolve(process.env.FOCUSRECALL_SECURITY_QA_OUTPUT||'docs/verification/release-security-20261018');assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));fs.mkdirSync(output,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const original=path.resolve(process.argv[2]);assert.ok(original.startsWith(path.resolve('dist')+path.sep));assert.ok(fs.existsSync(path.join(original,'FocusRecall.exe')));
 const root=path.resolve('out/qa-temp/asar-security-'+Date.now());assert.ok(!fs.existsSync(root));fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'PRODUCTION-FICTIONAL.txt'),'FocusRecall fictional profile only');
 const copy=path.join(root,'package');fs.cpSync(original,copy,{recursive:true});
 const asar=path.join(copy,'resources/app.asar'),bytes=fs.readFileSync(asar),text=Buffer.from('Untrusted IPC caller.');const at=bytes.indexOf(text);assert.ok(at>0);bytes[at]=88;fs.writeFileSync(asar,bytes);
 const profile=path.join(root,'profile');fs.mkdirSync(profile);const env={...process.env,FOCUSRECALL_DATA_DIR:profile,LEARNALYT_DATA_DIR:profile,TRIFOCUS_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
 const child=cp.spawn(path.join(copy,'FocusRecall.exe'),[],{env,cwd:profile,windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',()=>{});await pause(6000);
 const result={archiveContentTampered:true,exitCode:child.exitCode,profileCreated:fs.readdirSync(profile).some(n=>/\.db$/.test(n)),stderr:stderr.replaceAll(root,'<fictional-fixture>')};
 if(child.exitCode===null){try{cp.execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})}catch{}}
 assert.notEqual(result.exitCode,null,'Tampered main-process source must not run');assert.equal(result.profileCreated,false);assert.match(stderr,/integrity|hash|asar/i);
 // Attempt Electron's legacy resources/app fallback after removing only the copied ASAR.
 fs.renameSync(asar,asar+'.tampered');const fallback=path.join(copy,'resources/app'),marker=path.join(root,'FALLBACK_EXECUTED.txt');fs.mkdirSync(fallback);
 fs.writeFileSync(path.join(fallback,'package.json'),JSON.stringify({name:'fictional-fallback',version:'1.0.0',main:'index.js'}));fs.writeFileSync(path.join(fallback,'index.js'),'require("fs").writeFileSync('+JSON.stringify(marker)+',"executed");require("electron").app.exit(0)');
 result.fallback=[];
 for(const noAsar of [false,true]){
  const nextEnv={...env};if(noAsar)nextEnv.ELECTRON_NO_ASAR='1';else delete nextEnv.ELECTRON_NO_ASAR;
  const next=cp.spawn(path.join(copy,'FocusRecall.exe'),[],{env:nextEnv,cwd:profile,windowsHide:true,stdio:'ignore'});await pause(4000);
  result.fallback.push({noAsarEnvironment:noAsar,executed:fs.existsSync(marker),exitCode:next.exitCode});
  if(next.exitCode===null){try{cp.execFileSync('taskkill',['/PID',String(next.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})}catch{}}
  assert.equal(fs.existsSync(marker),false,'Legacy unpacked app must not execute');
 }
 fs.writeFileSync(path.join(output,'asar-integrity.json'),JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e);process.exitCode=1});
