// Actual packaged executable, continuous port polling and safe fictional IPC proof.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict');
const {getCurrentFuseWire}=require('@electron/fuses');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const exe=path.resolve(process.argv[2]||''),baseline=process.argv.includes('--baseline');assert.ok(exe.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(exe));
const root=path.resolve('out/qa-temp/blockers-security-'+Date.now());fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'PRODUCTION-FICTIONAL.txt'),'FocusRecall fictional profile only');
const output=path.resolve(process.env.FOCUSRECALL_SECURITY_QA_OUTPUT||'docs/verification/audit-blockers-20261018');assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));fs.mkdirSync(output,{recursive:true});
const connect=port=>new Promise(r=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();r(true)});s.once('error',()=>r(false));s.setTimeout(100,()=>{s.destroy();r(false)})});
async function bridge(port){
 try{
  const targets=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(300)}).then(r=>r.json());const page=targets.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(!page)return false;
  return await new Promise(resolve=>{const ws=new WebSocket(page.webSocketDebuggerUrl),timer=setTimeout(()=>{ws.close();resolve(false)},500);ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'(async()=>globalThis.api ? Object.keys(await api.invoke("settings:getAll")).length : 0)()',awaitPromise:true,returnByValue:true}}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1){clearTimeout(timer);ws.close();resolve((m.result?.result?.value||0)>0)}};ws.onerror=()=>{clearTimeout(timer);resolve(false)}});
 }catch{return false}
}
const result={baseline,artifact:path.relative(process.cwd(),exe),pollIntervalMs:25,rows:[],fuses:null};
async function run(name,makeArgs,expectBlocked=true,extra={}){
 const port=19500+result.rows.length;assert.equal(await connect(port),false,'Probe port already occupied');
 const profile=path.join(root,name);fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'PRODUCTION-FICTIONAL.txt'),'FocusRecall fictional profile only');
 const marker=path.join(profile,'EXECUTED.txt'),probe=path.join(profile,'probe.cjs');fs.writeFileSync(probe,'require("fs").writeFileSync('+JSON.stringify(marker)+',"executed")');
 const env={...process.env,FOCUSRECALL_DATA_DIR:profile,LEARNALYT_DATA_DIR:profile,TRIFOCUS_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 Object.assign(env,extra);if(extra.NODE_OPTIONS)env.NODE_OPTIONS='--require='+JSON.stringify(probe);const args=makeArgs(port,fs.readFileSync(probe,'utf8'));
 const child=cp.spawn(exe,args,{env,cwd:profile,windowsHide:true,stdio:['ignore','pipe','pipe','pipe','pipe']});let stderr='',pipeResponse=false,everOpen=false,ipc=false,firstOpenMs=null;
 child.stdout.on('data',()=>{});child.stderr.on('data',b=>stderr+=b);for(const index of [3,4]){child.stdio[index].on('error',()=>{});child.stdio[index].on('data',b=>{if(b.length)pipeResponse=true})}
 if(name.includes('pipe')){try{child.stdio[3].write(JSON.stringify({id:1,method:'Target.getTargets'})+String.fromCharCode(0))}catch{}}
 const start=Date.now(),duration=expectBlocked?10000:6500;
 while(Date.now()-start<duration){if(await connect(port)){everOpen=true;firstOpenMs??=Date.now()-start;if(!ipc)ipc=await bridge(port)}if(expectBlocked&&child.exitCode!==null&&Date.now()-start>500)break;await pause(25)}
 const debugPortFileCreated=[path.join(profile,'DevToolsActivePort'),path.join(profile,'profile','DevToolsActivePort')].some(fs.existsSync);
 const row={name,args,elapsedMs:Date.now()-start,debugPortFileCreated,portEverOpen:everOpen,firstOpenMs,privilegedBridgeReached:ipc,pipeResponse,executed:fs.existsSync(marker),exitCode:child.exitCode,databaseCreated:fs.readdirSync(profile).some(n=>n.endsWith('.db')),stderr:stderr.replaceAll(profile,'<fictional-profile>')};
 result.rows.push(row);if(child.exitCode===null)try{cp.execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})}catch{}await pause(200);
 console.log(JSON.stringify(row));
 if(!baseline){assert.equal(debugPortFileCreated,false,name);assert.equal(everOpen,false,name);assert.equal(ipc,false,name);assert.equal(pipeResponse,false,name);assert.equal(row.executed,false,name);if(expectBlocked){assert.equal(row.databaseCreated,false,name);assert.equal(row.exitCode,1,name)}else if(name==='normal'||name==='terminator')assert.ok(row.databaseCreated,name)}
}
(async()=>{
 result.fuses=await getCurrentFuseWire(exe);
 if(baseline&&process.argv.includes('--smoke')){
   await run('single-remote',p=>['-remote-debugging-port='+p]);
   assert.ok(result.rows[0].portEverOpen);assert.ok(result.rows[0].privilegedBridgeReached,'Positive control must reach the fictional bridge');
   await run('single-sandbox',()=>['-no-sandbox']);assert.ok(result.rows[1].databaseCreated);result.success=true;return;
 }
 await run('normal',()=>[],false);
 for(const prefix of ['--','-','/']){
  const label=prefix==='--'?'double':prefix==='-'?'single':'slash';
  await run(label+'-remote',p=>[prefix+'remote-debugging-port='+p]);
  await run(label+'-sandbox',()=>[prefix+'no-sandbox']);
  await run(label+'-single-process',()=>[prefix+'single-process']);
  await run(label+'-pipe',()=>[prefix+'remote-debugging-pipe']);
  await run(label+'-origins',()=>[prefix+'remote-allow-origins=*']);
 }
 await run('mixed-case',p=>['-ReMoTe-DeBuGgInG-PoRt='+p]);
 await run('whitespace',p=>[' -remote-debugging-port='+p+' ']);
 await run('empty',()=>['-remote-debugging-port=']);
 await run('separate-value',p=>['-remote-debugging-port',String(p)]);
 await run('ephemeral',()=>['-remote-debugging-port=0']);
 await run('duplicate',p=>['--remote-debugging-port=0','-remote-debugging-port='+p]);
 await run('combined',p=>['-no-sandbox','-remote-debugging-port='+p]);
 await run('launcher',()=>['-renderer-cmd-prefix=fictional']);
 await run('inspect',p=>['--inspect=127.0.0.1:'+p],false);
 await run('single-inspect',p=>['-inspect=127.0.0.1:'+p],false);
 await run('run-as-node',(p,code)=>['-e',code],false,{ELECTRON_RUN_AS_NODE:'1'});
 await run('node-options',()=>[],false,{NODE_OPTIONS:'probe'});
 await run('terminator',p=>['--','-remote-debugging-port='+p],false);
 if(!baseline){for(const i of [0,2,3])assert.equal(result.fuses[i],48);for(const i of [4,5])assert.equal(result.fuses[i],49)}
 else assert.ok(result.rows.some(r=>r.name==='single-remote'&&r.portEverOpen));
 result.success=true;
})().catch(e=>{result.error=String(e);process.exitCode=1;console.error(e)}).finally(()=>fs.writeFileSync(path.join(output,baseline?'security-baseline.json':'production-security.json'),JSON.stringify(result,null,2)+String.fromCharCode(10)));
