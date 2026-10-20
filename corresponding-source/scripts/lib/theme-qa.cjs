// Packaged Windows QA only. All data and windows belong to a new marked fixture.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function inspector(){
 const targets=await fetch('http://127.0.0.1:9821/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json());
 const socket=new WebSocket(targets[0].webSocketDebuggerUrl),waiting=new Map();let id=0;
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});socket.onmessage=e=>{const m=JSON.parse(e.data),p=waiting.get(m.id);if(p){waiting.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 return {close:()=>new Promise(resolve=>{if(socket.readyState===3)return resolve();socket.addEventListener('close',()=>resolve(),{once:true});socket.close();setTimeout(resolve,1000)}),evaluate:async expression=>{const r=await new Promise((resolve,reject)=>{waiting.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}};
}
async function open({root,output,legacy,seedDirectory,seedSettings={},restart=false}){
 const {chromium}=require(process.env.FOCUSRECALL_PLAYWRIGHT_PATH||'playwright');
 const exe=path.resolve(process.env.FOCUSRECALL_QA_EXECUTABLE||'dist/qa/win-unpacked/FocusRecall.exe');root=path.resolve(root);output=path.resolve(output);
 assert.ok(exe.startsWith(path.resolve('dist')+path.sep));assert.ok(fs.existsSync(exe));assert.ok(fs.existsSync(path.join(path.dirname(exe),'QA_BUILD.txt')),'Inspector workflows require a separately built QA artifact.');
 assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep));assert.ok(restart||!fs.existsSync(root),'Use a NEW fictional profile');assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));
 if(restart){
  assert.equal(fs.readFileSync(path.join(root,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
  assert.ok(fs.existsSync(path.join(root,'learnalyt-demo.db')));assert.equal(legacy,undefined);assert.deepEqual(seedSettings,{});
  fs.mkdirSync(output,{recursive:true});
 }else{
 const seed=path.resolve(seedDirectory||'out/qa-temp/brand-upgrade-beta24');assert.ok(seed.startsWith(path.resolve('out/qa-temp')+path.sep));assert.equal(fs.readFileSync(path.join(seed,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
 fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');fs.copyFileSync(path.join(seed,'learnalyt-demo.db'),path.join(root,'learnalyt-demo.db'));fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:true}));
 // Seed a real legacy serialized preference before startup, never send obsolete
 // payloads through the current IPC contract or touch the original seed.
 cp.execFileSync('python',['-c',`import sqlite3,json,sys\nd=sqlite3.connect(sys.argv[1]);d.execute("DELETE FROM settings WHERE key='appearance'")\na=json.loads(sys.argv[2])\nif a is not None:d.execute("INSERT INTO settings(key,value) VALUES('appearance',?)",(json.dumps(a),))\nd.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('foregroundTrackingEnabled','false')");d.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('starterGuideCompleted','true')");extra=json.loads(sys.argv[3])\nfor k,v in extra.items():d.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",(k,json.dumps(v)))\nd.commit();d.close()`,path.join(root,'learnalyt-demo.db'),JSON.stringify(legacy??null),JSON.stringify(seedSettings)],{windowsHide:true});
 }
 const env={...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
 let app,main,browser,closed=false;const errors=[],network=[];const started=performance.now();
 const close=async()=>{if(closed)return;closed=true;try{await main?.evaluate('if(globalThis.qaDb)qaDb.close();setTimeout(()=>qaElectron.app.quit(),100);true')}catch{}try{await main?.close();await browser?.close()}catch{}await pause(1500);if(app&&app.exitCode===null){app.kill();await Promise.race([new Promise(resolve=>app.once('exit',resolve)),pause(3000)])};await pause(300);};
 try{
  const launchLog=fs.openSync(path.join(root,'qa-launch-'+Date.now()+'.log'),'a');
  app=cp.spawn(exe,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9820','--inspect=127.0.0.1:9821'],{cwd:root,env,windowsHide:true,stdio:['ignore',launchLog,launchLog]});fs.closeSync(launchLog);
  for(let i=0;i<160;i++){try{main=await inspector();await fetch('http://127.0.0.1:9820/json/version',{signal:AbortSignal.timeout(1000)});break}catch{await main?.close();main=null}assert.equal(app.exitCode,null);await pause(200)}assert.ok(main);assert.equal(await main.evaluate('process.env.FOCUSRECALL_DATA_DIR'),root);
  await main.evaluate(`globalThis.qaRequire=process.getBuiltinModule('module').createRequire(process.resourcesPath+'/app.asar/package.json');globalThis.qaElectron=qaRequire('electron');globalThis.qaDb=new(qaRequire('better-sqlite3'))(${JSON.stringify(path.join(root,'learnalyt-demo.db'))},{readonly:true,fileMustExist:true});`);
  browser=await chromium.connectOverCDP('http://127.0.0.1:9820');const context=browser.contexts()[0];const listen=p=>p.on('pageerror',e=>errors.push(e.message));for(const p of context.pages())listen(p);context.on('page',listen);context.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  const page=context.pages().find(p=>p.url().endsWith('/out/renderer/index.html'));assert.ok(page?.url().includes('/app.asar/'));page.setDefaultTimeout(15000);await page.emulateMedia({colorScheme:null});await page.waitForFunction(()=>!!window.api);
  const invoke=(c,...a)=>page.evaluate(([c,a])=>window.api.invoke(c,...a),[c,a]);
  for(const [k,v]of Object.entries({minimizeOnStart:false,panelAutoShow:false,panelOpen:false,preparationEnabled:false,restMusic:false,studyReminderDailyEnabled:false,studyReminderSmartEnabled:false,language:'en'}))await invoke('settings:set',k,v);
  await invoke('session:endSitting');await main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).setContentSize(1440,1000)');
  const snapshot=()=>main.evaluate('({blocks:qaDb.prepare("SELECT * FROM blocks ORDER BY id").all(),activity:qaDb.prepare("SELECT * FROM window_activity ORDER BY id").all()})');
  return {exe,root,output,page,context,main,invoke,close,errors,network,readyMs:Math.round(performance.now()-started),snapshot};
 }catch(e){await close();throw e}
}
module.exports={open,pause};
