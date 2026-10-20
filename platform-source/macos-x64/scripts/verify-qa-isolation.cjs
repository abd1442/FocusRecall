// Only new fictional directories. Never inspect the owner's profile contents.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),qa=path.resolve(process.argv[2]),prod=path.resolve(process.argv[3]);
for(const exe of [qa,prod])assert.ok(exe.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(exe));
const archive=path.join(path.dirname(qa),'resources/app.asar');assert.ok(asar.extractFile(archive,path.join('out','main','index.js')).includes(Buffer.from('QA requires the fictional-profile marker.')),'Do not test missing overrides against an old unsafe QA build');
const output=path.resolve(process.env.FOCUSRECALL_SECURITY_QA_OUTPUT||'docs/verification/audit-blockers-20261018');assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));fs.mkdirSync(output,{recursive:true});
const root=path.resolve('out/qa-temp/qa-isolation-packaged-'+Date.now());fs.mkdirSync(root,{recursive:true});const rows=[];
async function run(name,exe,mode){
 const dir=path.join(root,name);fs.mkdirSync(dir);const other=path.join(root,name+'-other');fs.mkdirSync(other);
 const sentinel=path.join(dir,'sentinel.txt');fs.writeFileSync(sentinel,'Fictional untouched profile sentinel');const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(sentinel)).digest('hex'),before=hash();
 const env={...process.env};for(const key of ['FOCUSRECALL_DATA_DIR','LEARNALYT_DATA_DIR','TRIFOCUS_DATA_DIR','ELECTRON_RUN_AS_NODE','NODE_OPTIONS'])delete env[key];
 if(mode!=='missing'&&mode!=='legacy-only')env.FOCUSRECALL_DATA_DIR=mode==='relative'?'.':dir;
 if(mode!=='unmarked')fs.writeFileSync(path.join(dir,'QA-FICTIONAL.txt'),mode==='bad-marker'?'invalid':'FocusRecall fictional profile only');
 if(mode==='conflict')env.LEARNALYT_DATA_DIR=other;if(mode==='legacy-only')env.LEARNALYT_DATA_DIR=dir;
 const child=cp.spawn(exe,[],{env,cwd:dir,windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stdout.on('data',()=>{});child.stderr.on('data',b=>stderr+=b);await pause(mode==='valid'?6500:2000);
 const row={name,exitCode:child.exitCode,databaseCreated:fs.readdirSync(dir).some(f=>f.endsWith('.db')),profileCreated:fs.existsSync(path.join(dir,'profile')),sentinelUnchanged:hash()===before,stderr};rows.push(row);
 if(child.exitCode===null)try{cp.execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})}catch{}
 assert.ok(row.sentinelUnchanged);if(mode==='valid'){assert.equal(row.exitCode,null);assert.ok(row.databaseCreated)}else{assert.equal(row.exitCode,1);assert.equal(row.databaseCreated,false);assert.equal(row.profileCreated,false);assert.match(stderr,/startup refused/)}
}
(async()=>{for(const mode of ['missing','relative','unmarked','bad-marker','legacy-only','conflict'])await run('qa-'+mode,qa,mode);await run('qa-valid',qa,'valid');await run('production-refuses-qa',prod,'marked');fs.writeFileSync(path.join(output,'qa-isolation.json'),JSON.stringify({success:true,rows},null,2));console.log('PASS packaged QA isolation and reciprocal production refusal')})().catch(e=>{fs.writeFileSync(path.join(output,'qa-isolation-failure.json'),JSON.stringify({rows,error:String(e)},null,2));console.error(e);process.exitCode=1});
