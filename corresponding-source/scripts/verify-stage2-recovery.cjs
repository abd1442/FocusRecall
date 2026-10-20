const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.LEARNALYT_PLAYWRIGHT_PATH||'playwright');
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9340'),ctx=browser.contexts()[0],page=ctx.pages().find(p=>p.url().endsWith('/out/renderer/index.html'));
 page.setDefaultTimeout(15000);
 assert.ok(page.url().includes('out/qa-temp/stage2-review-package-20261015'));
 const target=(await fetch('http://127.0.0.1:9341/json/list').then(r=>r.json()))[0],ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 const main=async expression=>{const r=await new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 const root=path.resolve(process.argv[2]);assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep)&&path.basename(root).startsWith('stage2-'));assert.equal(path.resolve(await main('process.env.LEARNALYT_DATA_DIR')),root);
 const invoke=(channel,...args)=>page.evaluate(([channel,args])=>window.api.invoke(channel,...args),[channel,args]);
 const state=()=>invoke('session:get'),result={};
 await main("globalThis.qaElectron=process.getBuiltinModule('module').createRequire(process.execPath)('electron');globalThis.qaWindow=qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/out/renderer/index.html'));if(qaWindow.isMinimized())qaWindow.restore();true");
 const size=async(w,h)=>{await main(`qaWindow.setContentSize(${w},${h});true`);await page.waitForTimeout(200)};
 const capture=async name=>{await page.waitForTimeout(150);return main(`(async()=>{const image=await qaWindow.capturePage(undefined,{stayHidden:true,stayAwake:true});process.getBuiltinModule('fs').writeFileSync(process.getBuiltinModule('path').join(process.env.LEARNALYT_DATA_DIR,${JSON.stringify(name+'.png')}),image.toPNG());return image.getSize()})()`)};
 await invoke('settings:set','minimizeOnStart',false);
 const raw=await invoke('stats:raw'),oldIds=new Set(raw.blocks.map(b=>b.id)),oldHash=sha(raw.blocks),fresh=raw.blocks.length===0;
 const panel=ctx.pages().find(p=>p.url().endsWith('#panel'));
 const keep=async key=>{await page.getByRole('button',{name:'Keep it',exact:true}).waitFor();await page.getByRole('button',{name:'Keep it',exact:true}).focus();await page.keyboard.press(key);await page.getByRole('heading',{name:'Session complete',exact:true}).waitFor()};

 const receipt=path.join(root,'stage2-recovery-marker.json');
 if(process.argv[3]==='prepare'){
  await invoke('preparation:begin',{itemId:raw.items[0].id,timerMode:'fixed',targetSeconds:1500});await invoke('preparation:confirm');await page.getByRole('button',{name:'Finish session',exact:true}).waitFor();await page.getByRole('button',{name:'Finish session',exact:true}).click();await keep('Enter');await page.getByRole('button',{name:'Focused',exact:true}).click();await page.getByText('Add a session note',{exact:true}).click();await page.getByLabel('Quick session note',{exact:true}).fill('Fictional resume marker: vectors tomorrow');await page.waitForTimeout(250);
  const id=(await state()).finished[0].sessionId,draft=await invoke('session:getLogDraft',id);assert.match(JSON.stringify(draft),/vectors tomorrow/);fs.writeFileSync(receipt,JSON.stringify({id,draft,stage:'saved before restart'},null,2));console.log('PASS quick draft saved before restart');
 }else{
  const marker=JSON.parse(fs.readFileSync(receipt,'utf8'));await page.getByRole('button',{name:'Resume',exact:true}).first().click();await keep('Space');await page.getByText('Add a session note',{exact:true}).click();await page.getByLabel('Quick session note',{exact:true}).waitFor();assert.match(await page.getByLabel('Quick session note',{exact:true}).inputValue(),/vectors tomorrow/);assert.equal(await page.getByRole('button',{name:'Focused',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Save and finish studying',exact:true}).click();await page.getByRole('button',{name:'Start',exact:true}).first().waitFor();
  const saved=(await invoke('stats:raw')).blocks.find(b=>b.sessionId===marker.id);const schema=await invoke('log:schema');const focus=schema.fields.find(f=>f.key==='focus');assert.ok(saved.values.find(v=>v.fieldId===focus.id&&v.value===4&&v.touched));assert.match(JSON.stringify(saved.values),/vectors tomorrow/);assert.equal((await state()).sitting,null);fs.writeFileSync(path.join(root,'stage2-recovery-results.json'),JSON.stringify({resumedDraft:true,focusConfirmed:true,notePreserved:true,finishedOnce:true,sessionId:marker.id},null,2));console.log('PASS actual restart restores quick-wrap answers and note, then saves once');
 }
 ws.close();await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1)});
