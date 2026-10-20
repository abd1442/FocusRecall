// Actual packaged Chromium/IPC checks. No ordinary profile or vault is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const root=path.resolve(process.argv[2]||'out/qa-temp/security-release-20261015');
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep),'Disposable QA root required');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(port,pick){
 const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json()),target=targets.find(pick);assert.ok(target,`Debug target ${port}`);
 const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;
 await new Promise((yes,no)=>{socket.onopen=yes;socket.onerror=no});
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 return {call,evaluate,close:()=>socket.close(),target};
}
(async()=>{
 const main=await connect(9341,()=>true),page=await connect(9340,t=>t.url.endsWith('/out/renderer/index.html'));
 const evaluate=page.evaluate,results={};
 await page.call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await main.evaluate('globalThis.qaElectron = process.getBuiltinModule("module").createRequire(process.execPath)("electron")');
 assert.equal(await main.evaluate('process.env.LEARNALYT_DATA_DIR'),root);
 assert.equal(await evaluate("window.api.invoke('app:demo')"),true);
 const prefs=await main.evaluate('qaElectron.BrowserWindow.getAllWindows().map(w=>{const p=w.webContents.getLastWebPreferences();return {sandbox:p.sandbox,isolation:p.contextIsolation,node:p.nodeIntegration,url:w.webContents.getURL()}})');
 assert.equal(prefs.length,4);assert.ok(prefs.every(p=>p.sandbox&&p.isolation&&!p.node));results.rendererIsolation=prefs;
 assert.equal(await evaluate('typeof process'),'undefined');
 assert.equal(await evaluate("window.api.invoke('settings:getAll').then(s=>s.foregroundTrackingEnabled)"),false);
 const rejects=async(expression)=>{assert.equal(await evaluate(`(async()=>{try{await (${expression});return false}catch{return true}})()`),true)};
 await rejects("window.api.invoke('arbitrary:execute')");await rejects("window.api.invoke('settings:set','foregroundTrackingEnabled','true')");await rejects("window.api.invoke('shell:open','C:\\\\fictional.exe')");
 await rejects("window.api.invoke('shell:open','C:\\\\fictional.exe. ')");
 const panel=await connect(9340,t=>t.url.endsWith('#panel'));
 assert.equal(await panel.evaluate("window.api.invoke('session:get').then(s=>s.stage)"),'idle');
 assert.equal(await panel.evaluate("window.api.invoke('backup:openFolder').then(()=>false,()=>true)"),true);panel.close();results.runtimeBoundary=true;
 let requests=0;const server=http.createServer((_q,r)=>{requests++;r.end('untrusted fixture')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const initial=await evaluate('location.href');await evaluate(`location.href='http://127.0.0.1:${server.address().port}/untrusted'`);await delay(400);
 assert.equal(await evaluate('location.href'),initial);assert.equal(requests,0);server.close();
 const windowsBefore=await main.evaluate('qaElectron.BrowserWindow.getAllWindows().length');await evaluate("window.open('https://example.invalid/')");await delay(150);assert.equal(await main.evaluate('qaElectron.BrowserWindow.getAllWindows().length'),windowsBefore);results.navigationBlocked=true;
 const click=async(text)=>{assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(text)})`),true,`Button ${text}`);await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await delay(200)};
 await click('Library');await evaluate("globalThis.qaDialogTrigger=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Add category');qaDialogTrigger.focus();qaDialogTrigger.click()");await delay(150);
 assert.equal(await evaluate("document.querySelector('dialog[open]').matches(':modal')"),true);
 assert.equal(await evaluate("document.querySelector('dialog[open]').contains(document.activeElement)"),true);
 for(let i=0;i<12;i++){await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await evaluate("document.querySelector('dialog[open]').contains(document.activeElement)"),true,'Modal tab containment')}
 await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(100);
 assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"),0);assert.equal(await evaluate('document.activeElement===qaDialogTrigger'),true);results.modalKeyboard=true;
 for(const scale of [0.85,1.25]){
  await evaluate(`window.api.invoke('appearance:get').then(a=>window.api.invoke('appearance:set',{...a,uiScale:${scale}}))`);
  await evaluate('qaDialogTrigger.focus();qaDialogTrigger.click()');await delay(150);
  assert.equal(await evaluate("(()=>{const r=document.querySelector('dialog[open]').getBoundingClientRect();return r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1})()"),true,'Modal fits interface scale '+scale);
  await evaluate("document.querySelector('dialog[open] button[aria-label^=Close]').click()");await delay(100);
 }
 await evaluate("window.api.invoke('appearance:get').then(a=>window.api.invoke('appearance:set',{...a,uiScale:1}))");results.modalScaleBounds=true;
 const before=await evaluate("window.api.invoke('stats:raw').then(r=>r.blocks.length)"),itemId=await evaluate("window.api.invoke('stats:raw').then(r=>r.items[0].id)");
 const begin=`window.api.invoke('preparation:begin',{itemId:${itemId},timerMode:'flow',targetSeconds:1500,goal:'Fictional release workflow'})`;
 await evaluate(begin);assert.equal(await evaluate("window.api.invoke('stats:raw').then(r=>r.blocks.length)"),before);await evaluate("window.api.invoke('preparation:cancel')");await evaluate(begin);await evaluate("window.api.invoke('preparation:confirm')");await delay(1500);
 const running=await evaluate("window.api.invoke('session:get')");assert.equal(running.stage,'focus');
 await evaluate("window.api.invoke('session:distracted')");await delay(300);await evaluate("window.api.invoke('session:back')");await evaluate("window.api.invoke('session:finish')");await delay(250);
 if(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Keep it')"))await click('Keep it');
 assert.equal(await evaluate("window.api.invoke('session:get').then(s=>s.step)"),'recall');
 await evaluate("window.api.invoke('session:completeRecall')");await evaluate("window.api.invoke('session:get').then(s=>window.api.invoke('session:submitLog',s.finished.map(b=>({blockId:b.id,values:{},notes:{}}))))");await evaluate("window.api.invoke('rest:start',60)");await delay(200);await evaluate("window.api.invoke('rest:endEarly')");await evaluate("window.api.invoke('rest:finish','Fictional quiet rest')");await evaluate("window.api.invoke('session:endSitting')");
 assert.equal(await evaluate("window.api.invoke('session:get').then(s=>s.stage)"),'idle');results.studyWorkflow=true;
 // Exercise real snapshot/validation/export paths with picker destinations stubbed
 // only in this inspector-attached disposable app. Native dialogs remain manual.
 const backup=path.join(root,'runtime-backup.db'),invalid=path.join(root,'invalid-backup.db');fs.writeFileSync(invalid,'not a database',{flag:'wx'});
 await main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(backup)}})`);
 const created=await evaluate("window.api.invoke('backup:create')");assert.ok(created.name);assert.ok(fs.statSync(backup).size>512);
 await main.evaluate(`qaElectron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(invalid)}]})`);await rejects("window.api.invoke('backup:inspectRestore')");
 await main.evaluate(`qaElectron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(backup)}]})`);const restore=await evaluate("window.api.invoke('backup:inspectRestore')");assert.ok(restore.token);results.backupCreateAndValidation=true;
 const png=path.join(root,'report.png');await main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(png)}})`);
 await evaluate("window.api.invoke('stats:exportPng','<html><body><h1>Fictional release report</h1></body></html>','QA.png',800)");assert.equal(fs.readFileSync(png).subarray(1,4).toString(),'PNG');results.reportExport=true;
 await evaluate("window.api.invoke('settings:set','nextGoal','Restore must remove this later change')");
 fs.writeFileSync(path.join(root,'runtime-results.json'),JSON.stringify({...results,backup,restoreToken:restore.token,pickerStubbed:true,restoreRelaunch:'pending'},null,2));
 console.log('PASS packaged runtime checks:',JSON.stringify(results));page.close();main.close();
})().catch(e=>{console.error(e.stack);process.exitCode=1});
