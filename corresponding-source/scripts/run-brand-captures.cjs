// Current packaged UI only; never use a personal profile or an installed app.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const version=require('../package.json').version,tag=version.replace('0.1.0-','').replace('.','');
const root=path.resolve('out/qa-temp/brand-upgrade-'+tag),exe=path.resolve('dist/focusrecall-'+tag+'/win-unpacked/FocusRecall.exe');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 assert.equal(fs.readFileSync(path.join(root,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
 const app=cp.spawn(exe,['--remote-debugging-port=9390','--inspect=9391'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root}});
 let target;
 for(let i=0;i<100;i++){try{target=(await fetch('http://127.0.0.1:9391/json/list').then(r=>r.json()))[0];if(target)break}catch{}await pause(300)}
 assert.ok(target,'Isolated app inspector unavailable');await pause(1500);
 try{
  for(const script of ['scripts/verify-focusrecall.cjs','scripts/capture-focusrecall-workflow.cjs']){
   const result=cp.spawnSync(process.execPath,[script],{cwd:process.cwd(),encoding:'utf8',timeout:120000,env:{...process.env,FOCUSRECALL_QA_ROOT:root,FOCUSRECALL_QA_PORT:'9390'}});
   process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');assert.equal(result.status,0,script);
  }
 }finally{
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:`(()=>{if(process.env.FOCUSRECALL_DATA_DIR!==${JSON.stringify(root)})throw Error('Wrong QA profile');setTimeout(()=>process.getBuiltinModule('module').createRequire(process.execPath)('electron').app.quit(),100);return true})()`}}));
  await pause(300);ws.close();await Promise.race([new Promise(r=>app.once('exit',r)),pause(3000)]);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
