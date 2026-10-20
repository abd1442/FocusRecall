// Isolated packaged keyboard/AX checks; never targets an installed profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/theme-qa.cjs');
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const catalogs=Object.fromEntries(languages.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const text=(l,k)=>catalogs[l][k]||k;
async function tabTo(page,locator){
 await locator.waitFor({state:'visible'});
 for(let i=0;i<220;i++){if(await locator.evaluate(el=>el===document.activeElement))return i;await page.keyboard.press('Tab')}
 throw Error('Keyboard could not reach '+await locator.getAttribute('aria-label')+' '+await locator.textContent());
}
async function activate(page,locator){await tabTo(page,locator);await page.keyboard.press('Enter')}
const focused=page=>page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,100),name:document.activeElement?.getAttribute('aria-label')}));
(async()=>{
 const stage=process.env.FOCUSRECALL_A11Y_STAGE||'before';
 const q=await open({root:process.env.FOCUSRECALL_A11Y_ROOT||'out/qa-temp/accessibility-'+stage,output:process.env.FOCUSRECALL_A11Y_OUTPUT||'docs/verification/accessibility-20261018/'+stage});
 const {page,output,invoke}=q,r={stage,checks:[],screens:[]},original=await q.snapshot();
 try{
  await page.getByRole('button',{name:'Home',exact:true}).click();
  const calendar=page.getByRole('region',{name:'Study activity calendar',exact:true});
  r.calendar=await calendar.evaluate(el=>({days:el.querySelectorAll('button[title]').length,tabStops:[...el.querySelectorAll('button[title]')].filter(b=>!b.disabled&&b.tabIndex===0).length}));
  const cdp=await q.context.newCDPSession(page);r.homeAX=(await cdp.send('Accessibility.getFullAXTree')).nodes.filter(n=>!n.ignored).map(n=>({role:n.role?.value,name:n.name?.value,properties:n.properties}));
  await page.screenshot({path:path.join(output,'home.png')});
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings pages',exact:true}).getByRole('button',{name:'Appearance',exact:true}).click();
  const group=page.getByRole('radiogroup').first(),checked=group.getByRole('radio',{checked:true});await checked.focus();await page.keyboard.press('ArrowRight');
  r.radio=await group.evaluate(el=>({focused:document.activeElement?.getAttribute('data-radio'),selected:el.querySelector('[aria-checked=true]')?.getAttribute('data-radio'),focusTabIndex:document.activeElement?.tabIndex}));
  if(stage!=='before'){
   assert.equal(r.calendar.tabStops,1);await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-checked')==='true');
   r.languages=[];
   for(const [i,l] of languages.entries()){
    await invoke('settings:set','language',l);await invoke('settings:set','weekStartsOn',i%7);
    await page.waitForFunction(l=>document.documentElement.lang===l,l);
    await activate(page,page.getByRole('button',{name:text(l,'Home'),exact:true}));
    const grid=page.getByRole('grid',{name:text(l,'Study activity calendar'),exact:true});
    assert.equal(await grid.locator('button[tabindex="0"]:not(:disabled)').count(),1);
    const entry=grid.locator('button[tabindex="0"]');const tabs=await tabTo(page,entry);const day=await entry.getAttribute('data-grid-key');
    // The visible calendar has weekdays downwards and weeks across.
    await page.keyboard.press(l==='ar'?'ArrowRight':'ArrowLeft');
    const moved=await page.evaluate(()=>document.activeElement.dataset.gridKey);
    const d=new Date(day+'T12:00:00');d.setDate(d.getDate()-7);
    assert.equal(moved,`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    assert.equal(await grid.locator('button[tabindex="0"]').getAttribute('data-grid-key'),moved);
    await page.keyboard.press('Tab');assert.equal(await grid.evaluate(el=>el.contains(document.activeElement)),false);
    await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.gridKey),moved);
    await page.keyboard.press('Enter');await grid.waitFor({state:'detached'});await pause(80);
    assert.notEqual((await focused(page)).tag,'BODY');const historyFocus=await focused(page);
    await activate(page,page.getByRole('button',{name:text(l,'Settings'),exact:true}));
    await activate(page,page.getByRole('navigation',{name:text(l,'Settings pages'),exact:true}).getByRole('button',{name:text(l,'Appearance'),exact:true}));
    const radios=page.getByRole('radiogroup').first();await tabTo(page,radios.getByRole('radio',{checked:true}));
    await page.keyboard.press(l==='ar'?'ArrowLeft':'ArrowRight');await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-checked')==='true');
    assert.equal(await radios.locator('[tabindex="0"]').count(),1);assert.equal(await page.evaluate(()=>document.activeElement.tabIndex),0);
    await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await radios.evaluate(el=>el.contains(document.activeElement)),true);
    r.languages.push({language:l,calendarTabStops:1,calendarEntryTabs:tabs,spatialArrows:true,rememberedEntry:true,activationOpensHistory:true,appearanceArrowsSelect:true,historyFocus});console.log('CHECK language '+l);
   }
   r.checks.push('Seven languages: one calendar Tab stop, spatial and RTL arrows, Tab exit/reentry, Enter opens History; appearance radios move/select and reenter');
   await invoke('settings:set','language','en');await invoke('settings:set','preparationEnabled',true);
   await activate(page,page.getByRole('button',{name:'Home',exact:true}));
   await activate(page,page.getByRole('button',{name:'Start',exact:true}));
   let panel;
   for(let i=0;i<80;i++){panel=q.context.pages().find(p=>p.url().endsWith('#panel'));if(panel&&await panel.getByRole('heading',{name:'Get ready',exact:true}).count())break;await pause(100)}
   assert.ok(panel);await panel.waitForFunction(()=>document.activeElement?.textContent==='Get ready');
   assert.equal(await q.main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("#panel")).isFocusable()'),true);
   await panel.screenshot({path:path.join(output,'preparation.png')});
   await activate(panel,panel.getByRole('button',{name:'Ready to start',exact:true}));
   await page.getByRole('button',{name:'Finish session',exact:true}).waitFor();
   assert.notEqual((await focused(page)).tag,'BODY');
   await activate(page,page.getByRole('button',{name:'Switch',exact:true}));
   const dialog=page.getByRole('dialog');await dialog.waitFor();
   assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
   for(let i=0;i<15;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true)}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   assert.equal(await page.getByRole('button',{name:'Switch',exact:true}).evaluate(el=>el===document.activeElement),true);
   await activate(page,page.getByRole('button',{name:'Finish session',exact:true}));
   await activate(page,page.getByRole('button',{name:'Keep it',exact:true}));
   await page.getByRole('heading',{name:'Review & connect',exact:true}).waitFor();await pause(100);assert.notEqual((await focused(page)).tag,'BODY');
   await activate(page,page.getByRole('button',{name:'Continue to session log',exact:true}));
   await page.getByRole('heading',{name:'How did it go?',exact:true}).waitFor();await pause(100);assert.notEqual((await focused(page)).tag,'BODY');
   await page.keyboard.press('Control+Enter');await page.getByRole('button',{name:'Start rest',exact:true}).waitFor();assert.notEqual((await focused(page)).tag,'BODY');
   await activate(page,page.getByRole('button',{name:'Start rest',exact:true}));await page.getByRole('heading',{name:'Resting',exact:true}).waitFor();assert.notEqual((await focused(page)).tag,'BODY');
   await activate(page,page.getByRole('button',{name:'End rest early',exact:true}));await page.getByRole('heading',{name:'Rest ended early',exact:true}).waitFor();assert.notEqual((await focused(page)).tag,'BODY');
   // Optional rest activity can be omitted, using the existing skip action.
   const state=await invoke('session:get');r.workflowState=state.stage;
   await invoke('rest:finish',null);await invoke('session:endSitting');
   r.checks.push('Keyboard start → preparation → Focus → trapped Switch dialog/Escape restoration → Recall → Log → Rest plan/running/early-end; surviving focus at each transition');
   await page.getByRole('button',{name:'Stats',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-stats-analysis]')?.getAttribute('aria-busy')==='false');
   await page.waitForFunction(()=>document.querySelector('[data-analysis-announcement]')?.textContent==='Analysis complete.');
   assert.equal(await page.locator('[data-analysis-announcement]').first().evaluate(el=>!!el.closest('[aria-busy=true]')),false);
   await page.locator('.stats-primary-nav').getByRole('button',{name:'Activity',exact:true}).click();await page.locator('.stats-secondary-nav').getByRole('button',{name:'Study rhythm',exact:true}).click();
   const matrix=page.getByRole('grid',{name:'Recorded focus by start time',exact:true});assert.equal(await matrix.locator('[tabindex="0"]').count(),1);
   await matrix.locator('[tabindex="0"]').focus();await page.keyboard.press('End');assert.ok((await page.evaluate(()=>document.activeElement.dataset.gridKey)).endsWith('-23'));await page.keyboard.press('Tab');assert.equal(await matrix.evaluate(el=>el.contains(document.activeElement)),false);
   await page.getByText('Data table',{exact:true}).click();assert.ok(await page.getByRole('table').count()>0);
   r.checks.push('Stats completion live region outside busy subtree; 168-cell grid has one Tab stop; chart point values have a keyboard-readable table');
   await invoke('settings:set','language','ar');await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
   await page.getByRole('button',{name:text('ar','Home'),exact:true}).click();
   const dayCell=page.getByRole('grid').locator('button[tabindex="0"]');await tabTo(page,dayCell);
   r.forcedColors=await dayCell.evaluate(el=>({active:matchMedia('(forced-colors: active)').matches,outline:getComputedStyle(el).outlineStyle,border:getComputedStyle(el).borderTopStyle}));assert.equal(r.forcedColors.active,true);assert.equal(r.forcedColors.outline,'solid');
   await page.screenshot({path:path.join(output,'ar-forced-colors.png')});await page.emulateMedia({forcedColors:'none',reducedMotion:null});
   r.checks.push('Chromium forced-colors/reduced-motion emulation with Arabic RTL preserves grid focus outlines');
   if(process.env.FOCUSRECALL_A11Y_HOLD==='1'){
    await invoke('settings:set','language','en');await q.main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).setTitle("FocusRecall — accessibility fictional QA");true');
    fs.writeFileSync(path.join(output,'READY.txt'),'Fictional native UIA inspection ready');
    for(let i=0;i<300&&!fs.existsSync(path.join(output,'FINISH.txt'));i++)await pause(1000);
   }
  }
  const current=await q.snapshot();for(const k of ['blocks','activity'])assert.deepEqual(current[k].filter(row=>original[k].some(old=>old.id===row.id)),original[k]);
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);r.historyUnchanged=true;r.success=true;
 }finally{fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(r,null,2)+'\n');await q.close()}
 console.log(JSON.stringify({...r,homeAX:undefined},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
