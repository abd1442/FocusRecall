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

 await page.getByRole('button',{name:'Home',exact:true}).click();
 for(const [width,height,scale] of [[1920,620,1],[1920,1080,1.25],[900,620,1.5]]){
  await size(width,height);const a=await invoke('appearance:get');await invoke('appearance:set',{...a,uiScale:scale});await page.waitForTimeout(200);
  const boxes=await page.getByRole('button',{name:'Start',exact:true}).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
  assert.ok(boxes.some(r=>r.width>0&&r.y>=0&&r.y+r.height<=height&&r.x>=0&&r.x+r.width<=width),JSON.stringify({width,height,scale,boxes}));result[`start-${width}x${height}-${scale}`]=boxes;
 }
 await invoke('appearance:set',{...await invoke('appearance:get'),uiScale:1});await size(1588,948);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('searchbox',{name:'Search settings',exact:true}).fill('Sound');await page.getByRole('button',{name:'Sound',exact:true}).click();await page.locator('[data-field-id]').first().waitFor();assert.ok(await page.getByRole('button',{name:'Log questions',exact:true}).getAttribute('aria-pressed')==='true');result.settingsSearchIncludesLogQuestions=true;
 await page.getByRole('button',{name:'Stats',exact:true}).click();await page.locator('#stats-insights article').first().waitFor();await page.locator('#stats-factors > header select').selectOption('recall');const question=page.getByLabel('Question',{exact:true});const previous=await question.inputValue();const filters=await page.getByLabel('Current Stats filters').innerText();
 const card=page.locator('#stats-insights article').filter({has:page.getByText(/Music with lyrics: lower focus ratings/)});await card.getByRole('button',{name:'Explore →',exact:true}).scrollIntoViewIfNeeded();const before=await page.locator('#stats-scroll').evaluate(e=>e.scrollTop);await card.getByRole('button',{name:'Explore →',exact:true}).click();
 await page.waitForFunction(()=>{const section=document.getElementById('stats-factors'),bar=document.getElementById('stats-bar');return section.getBoundingClientRect().top>=bar.getBoundingClientRect().bottom-3&&section.getBoundingClientRect().top<bar.getBoundingClientRect().bottom+65});
 await page.waitForTimeout(300);assert.match(await question.locator('option:checked').innerText(),/Sound/);assert.equal(await page.locator('#stats-factors > header select').inputValue(),'focus');assert.equal(await page.locator('[data-selected-insight=true]').count(),1);result.exactQuestionOptionOutcomeAndVisibleLanding=true;await capture('stage2-stats-exploration-settled');
 await page.getByRole('button',{name:'Back to your insights'}).click();await page.waitForTimeout(150);assert.equal(await question.inputValue(),previous);assert.equal(await page.locator('#stats-factors > header select').inputValue(),'recall');assert.equal(await page.getByLabel('Current Stats filters').innerText(),filters);assert.ok(Math.abs(await page.locator('#stats-scroll').evaluate(e=>e.scrollTop)-before)<3);result.backRestoresOutcomeQuestionFiltersAndScroll=true;
 const targetBlock=raw.blocks[0],dest={kind:'none',vaultPath:'',vaultName:'',file:'',heading:'',page:'',parentBlock:'',placement:'inside'};
 await invoke('notes:save',{id:'stage2-deep-link',itemId:targetBlock.itemId,blockId:targetBlock.id,title:'Stage 2 deep link',text:'Fictional archived session lookup',strokes:[],image:null,destination:dest},false);
 await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('button',{name:'Saved notes',exact:true}).click();await page.getByRole('textbox',{name:'Search history',exact:true}).fill('Fictional archived session lookup');await page.getByRole('button',{name:'Open session',exact:true}).click();await page.locator(`#history-session-${targetBlock.sessionId} [id^=history-details-]`).waitFor();result.oldSessionDeepLinkOpensDetails=true;
 fs.writeFileSync(path.join(root,'stage2-navigation-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));ws.close();await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1)});
