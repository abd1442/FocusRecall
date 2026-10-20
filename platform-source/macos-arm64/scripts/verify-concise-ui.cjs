const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'out/qa-temp/concise-ui-20261015'),delay=()=>new Promise(r=>setTimeout(r,450));
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep),'Disposable QA root required');
async function connect(port,pick){const target=(await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json())).find(pick);assert.ok(target);const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});return {call,evaluate:async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value},close:()=>ws.close()};}
(async()=>{
 const main=await connect(9341,()=>true),page=await connect(9340,t=>t.url.endsWith('/out/renderer/index.html')),panel=await connect(9340,t=>t.url.endsWith('#panel'));
 assert.equal(await main.evaluate('process.env.LEARNALYT_DATA_DIR'),root);assert.equal(await page.evaluate("window.api.invoke('app:demo')"),true);
 await main.evaluate('globalThis.qaElectron=process.getBuiltinModule("module").createRequire(process.execPath)("electron")');
 const item=await page.evaluate("window.api.invoke('library:listPickerItems').then(items=>items.find(i=>i.name==='Structures II')??items[0])");
 const begin=`window.api.invoke('preparation:begin',{itemId:${item.id},timerMode:'flow',targetSeconds:1500,goal:'Recall three ideas'})`;
 await page.evaluate(begin);const real=await page.evaluate("window.api.invoke('preparation:get')");await delay();
 assert.ok(real.suggestions.length>0,'Genuine demo-derived suggestions');
 assert.equal(await panel.evaluate("document.querySelectorAll('details').length"),1);
 assert.equal(await panel.evaluate("document.body.innerText.includes('Higher reported')"),false,'Evidence hidden until requested');
 await panel.evaluate("document.querySelector('details summary').focus();document.querySelector('details summary').click()");
 assert.equal(await panel.evaluate("document.querySelector('details').open"),true);assert.equal(await panel.evaluate("document.body.innerText.includes('Higher reported')"),true);await panel.evaluate("document.querySelector('details summary').click()");
 await panel.evaluate("document.querySelector('input[type=checkbox]').click()");assert.equal(await panel.evaluate("document.querySelector('input[type=checkbox]').checked"),true);
 await main.evaluate(`qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#panel')).webContents.send('preparation:changed',${JSON.stringify({...real,suggestions:[]})})`);await delay();
 assert.equal(await panel.evaluate("document.querySelectorAll('input[type=checkbox]').length"),2,'Sparse history keeps only fixed checks');assert.equal(await panel.evaluate("document.querySelectorAll('details').length"),0,'No misleading personal signal for sparse history');
 const bounds=[];
 // Maximum-card layout stress fixture only. Never use this injected fixture for publication screenshots.
 const fixture={...real,suggestions:Array.from({length:5},(_,i)=>({...real.suggestions[i%real.suggestions.length],id:'layout-only-'+i}))};
 for(const [width,height] of [[900,650],[720,520]])for(const uiScale of [0.85,1,1.25,1.5])for(const mode of ['light','dark']){
  await page.evaluate(`window.api.invoke('appearance:get').then(a=>window.api.invoke('appearance:set',{...a,uiScale:${uiScale},mode:${JSON.stringify(mode)}}))`);
  await main.evaluate(`qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#panel')).webContents.send('preparation:changed',${JSON.stringify(fixture)})`);
  await panel.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay();
  const measured=await panel.evaluate(`(()=>{const tip=document.querySelector('[aria-label="Study tip"]').getBoundingClientRect(),footer=document.querySelector('footer').getBoundingClientRect(),list=document.querySelector('[aria-label="Optional preparation checklist"]').getBoundingClientRect();return {tipTop:tip.top,tipBottom:tip.bottom,footerTop:footer.top,footerBottom:footer.bottom,height:innerHeight,listHeight:list.height,checks:document.querySelectorAll('input[type=checkbox]').length}})()`);
  assert.equal(measured.checks,7);assert.ok(measured.tipTop>=0&&measured.tipBottom<=measured.footerTop+1&&measured.footerBottom<=measured.height+1&&measured.listHeight>30,JSON.stringify({width,height,uiScale,mode,...measured}));bounds.push({width,height,uiScale,mode,...measured});
 }
 await panel.call('Emulation.clearDeviceMetricsOverride');await page.evaluate("window.api.invoke('preparation:cancel')");await page.evaluate("window.api.invoke('appearance:get').then(a=>window.api.invoke('appearance:set',{...a,uiScale:1,mode:'light'}))");await page.evaluate(begin);await delay();
 assert.equal(await panel.evaluate("document.querySelectorAll('details').length"),1,'Shared evidence disclosure restored after layout fixture');
 const shot=await panel.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preparation-real.png'),Buffer.from(shot.data,'base64'));
 await page.evaluate("window.api.invoke('settings:set','panelOpen',true)");await page.evaluate("window.api.invoke('settings:set','panelExpanded',true)");await page.evaluate("window.api.invoke('preparation:confirm')");await delay();
 assert.equal(await page.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Park a thought')"),false);
 assert.equal(await panel.evaluate("!!document.querySelector('button[aria-label="+JSON.stringify('Park a thought')+"]')"),true);
 fs.writeFileSync(path.join(root,'concise-ui-results.json'),JSON.stringify({realSuggestions:real.suggestions,optionalEvidence:true,layoutFixture:'5 repeated real suggestions, layout stress only, not publication images',bounds,mainParkRemoved:true,floatingParkRetained:true},null,2));
 await page.evaluate("window.api.invoke('session:finish')");await delay();if(await page.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Keep it')"))await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Keep it').click()");
 const state=await page.evaluate("window.api.invoke('session:get')");await page.evaluate(`window.api.invoke('session:leaveWorkflow',${state.finished[0].sessionId})`);await page.evaluate("window.api.invoke('session:endSitting')");
 console.log('PASS: '+bounds.length+' max-card layout/theme/scale cases, real personal evidence disclosure, main/floating controls.');panel.close();page.close();main.close();
})().catch(e=>{console.error(e.stack);process.exitCode=1});
