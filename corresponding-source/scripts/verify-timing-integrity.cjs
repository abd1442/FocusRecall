// Timing-integrity verification in a new marked fictional profile only.
// Events are emitted through Electron's real powerMonitor wiring; the stall is
// a deliberate main-process event-loop block, NOT physical hardware sleep.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.FOCUSRECALL_PLAYWRIGHT_PATH||'playwright');
const exe=path.resolve(process.env.FOCUSRECALL_QA_EXECUTABLE||'dist/timing-integrity-20261017/win-unpacked/FocusRecall.exe');
assert.ok(exe.startsWith(path.resolve('dist')+path.sep));
const root=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep));assert.ok(!fs.existsSync(root),'Use a NEW fictional profile');
assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));
const fixture=path.resolve('out/qa-temp/brand-upgrade-beta24');
assert.equal(fs.readFileSync(path.join(fixture,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');
fs.copyFileSync(path.join(fixture,'learnalyt-demo.db'),path.join(root,'learnalyt-demo.db'));
fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:true}));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const catalogs=Object.fromEntries(languages.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const text=(l,k)=>catalogs[l][k]||k;
const results={executable:exe,profile:root,physicalSleepTested:false,scope:'Packaged Windows app; injected OS events and real 16-second event-loop stall; isolated fictional data.',languages:[]};
async function inspector(){
 const targets=await fetch('http://127.0.0.1:9581/json/list',{signal:AbortSignal.timeout(1500)}).then(r=>r.json());
 const ws=new WebSocket(targets[0].webSocketDebuggerUrl),pending=new Map();let id=0;
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 return {close:()=>ws.close(),evaluate:async expression=>{const r=await new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}};
}
(async()=>{
 let app,main,browser,page;const errors=[],network=[];
 const launch=async()=>{
  const env={...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
  app=cp.spawn(exe,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9580','--inspect=127.0.0.1:9581'],{cwd:root,env,windowsHide:true,stdio:'ignore'});
  for(let i=0;i<100;i++){try{main=await inspector();await fetch('http://127.0.0.1:9580/json/version',{signal:AbortSignal.timeout(1000)});break}catch{main?.close();main=null;await delay(200)}}
  assert.ok(main);assert.equal(await main.evaluate('process.env.FOCUSRECALL_DATA_DIR'),root);
  await main.evaluate('globalThis.qaElectron=process.getBuiltinModule("module").createRequire(process.execPath)("electron")');
  browser=await chromium.connectOverCDP('http://127.0.0.1:9580');
  page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/out/renderer/index.html'));assert.ok(page);page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.waitForFunction(()=>!!window.api);
 };
 const shutdown=async()=>{
  if(main){await main.evaluate('setTimeout(()=>qaElectron.app.quit(),100);true');main.close();main=null}
  if(browser){await browser.close();browser=null}await delay(900);
 };
 const invoke=(c,...a)=>page.evaluate(([c,a])=>window.api.invoke(c,...a),[c,a]);
 const emit=e=>main.evaluate(`qaElectron.powerMonitor.emit(${JSON.stringify(e)});true`);
 try{
  await launch();results.asarSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(exe),'resources/app.asar'))).digest('hex');
  for(const [k,v] of Object.entries({starterGuideCompleted:true,minimizeOnStart:false,panelAutoShow:false,panelOpen:false,foregroundTrackingEnabled:false,restMusic:false,studyReminderDailyEnabled:false,studyReminderSmartEnabled:false}))await invoke('settings:set',k,v);
  await invoke('session:endSitting');const item=(await invoke('library:listPickerItems'))[0];assert.ok(item);
  const before=(await invoke('stats:raw')).blocks,oldIds=new Set(before.map(b=>b.id));
  for(let i=0;i<languages.length;i++){
   const language=languages[i],t=k=>text(language,k),mode=['flow','fixed','adaptive'][i%3];
   await invoke('settings:set','language',language);await page.getByRole('button',{name:t('Home'),exact:true}).click();
   await invoke('session:start',{itemId:item.id,timerMode:mode,targetSeconds:1500});await delay(1300);
   await emit('suspend');let state=await invoke('session:get');assert.ok(state.recovery);const cutoff=state.recovery.focusSecondsAtLastKnown;assert.ok(cutoff>0.8&&cutoff<4,cutoff);
   await delay(1200);await emit('resume');await emit('resume');
   await page.getByRole('button',{name:t('Continue the block'),exact:true}).waitFor();
   assert.ok((await page.locator('body').innerText()).includes(t('Continuing excludes the unobserved time from focus.')));
   await page.screenshot({path:path.join(output,language+'-recovery.png')});
   await page.getByRole('button',{name:t('Continue the block'),exact:true}).click();await delay(1200);
   state=await invoke('session:finish');const finished=state.finished[0];assert.ok(finished.focusSeconds>=cutoff+1&&finished.focusSeconds<cutoff+3,JSON.stringify(finished));
   const keep=page.getByRole('button',{name:t('Keep it'),exact:true});if(await keep.isVisible())await keep.click();
   await page.getByRole('button',{name:t('Start review'),exact:true}).click();await delay(1400);
   await emit('lock-screen');await delay(300);await emit('unlock-screen');
   await page.getByRole('button',{name:t('Resume review'),exact:true}).waitFor();
   const timer=page.getByRole('timer',{name:t('Review time remaining'),exact:true}),stopped=await timer.innerText();await delay(1300);assert.equal(await timer.innerText(),stopped);
   await page.getByRole('button',{name:t('Continue to session log'),exact:true}).click();
   const recall=await invoke('recall:get',finished.id);assert.ok(recall.recallSeconds>=1&&recall.recallSeconds<=2,JSON.stringify(recall));
   await invoke('session:submitLog',[{blockId:finished.id,values:{},notes:{}}]);await invoke('rest:start',300);await delay(1300);
   await emit('lock-screen');state=await invoke('session:get');assert.equal(state.rest.phase,'over');assert.ok(state.rest.actualSeconds>=1&&state.rest.actualSeconds<3);
   const actual=state.rest.actualSeconds;await delay(1200);await emit('unlock-screen');assert.equal((await invoke('session:get')).rest.actualSeconds,actual);
   await invoke('rest:finish',null);await invoke('session:endSitting');
   results.languages.push({language,mode,focusSeconds:finished.focusSeconds,cutoffSeconds:cutoff,reviewSeconds:recall.recallSeconds,interruptedRestSeconds:actual,recoveryClicked:true});
  }
  await invoke('settings:set','language','en');await invoke('session:start',{itemId:item.id,timerMode:'flow',targetSeconds:1500});await delay(1600);
  // A real event-loop stall tests recovery without any suspend/resume notification.
  await main.evaluate('(()=>{const until=performance.now()+16000;while(performance.now()<until){};return true})()');
  let state=await invoke('session:get');assert.ok(state.recovery);assert.ok(state.recovery.focusSecondsAtLastKnown<3);
  results.missedEventStall={milliseconds:16000,focusAtCutoff:state.recovery.focusSecondsAtLastKnown};
  await invoke('session:resolveRecovery','end');await invoke('session:finishWrapUp',state=(await invoke('session:get')).finished.map(b=>({blockId:b.id,values:{},notes:{}})),'finish');
  // Restart while interrupted; the persisted cutoff must survive the new process.
  await invoke('session:start',{itemId:item.id,timerMode:'adaptive',targetSeconds:1500});await delay(1200);await emit('suspend');
  const saved=(await invoke('session:get')).recovery;await shutdown();await launch();
  const restored=(await invoke('session:get')).recovery;assert.deepEqual(restored,saved);results.restartCutoffPreserved=true;
  await invoke('session:resolveRecovery','continue');await delay(1200);state=await invoke('session:finish');assert.ok(state.finished[0].focusSeconds<saved.focusSecondsAtLastKnown+3);
  await invoke('session:finishWrapUp',state.finished.map(b=>({blockId:b.id,values:{},notes:{}})),'finish');
  assert.deepEqual((await invoke('stats:raw')).blocks.filter(b=>oldIds.has(b.id)),before);results.fixtureHistoryUnchanged=true;
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);results.rendererErrors=errors;results.observedNetworkRequests=network;results.success=true;
 }finally{
  try{await shutdown()}catch{if(app&&app.exitCode===null)app.kill()}
  fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2)+'\n');
 }
 console.log('PASS '+JSON.stringify(results));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
