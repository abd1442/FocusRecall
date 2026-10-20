const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/theme-qa.cjs');
(async()=>{
 const q=await open({root:process.env.FOCUSRECALL_A11Y_LAYOUT_ROOT||'out/qa-temp/accessibility-layout',output:process.env.FOCUSRECALL_A11Y_LAYOUT_OUTPUT||'docs/verification/accessibility-20261018/layout'}),{page,invoke,output}=q;
 const r={checks:[],failures:[],success:false},old=await q.snapshot();
 const langs=['en','ar','es','fr','zh-Hans','pt-BR','de'],catalogs=Object.fromEntries(langs.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
 const t=(l,k)=>catalogs[l][k]||k;
 const screenshot=async name=>{
  // Electron captures the whole compositor viewport. CDP page.screenshot clips
  // to the wrong physical area when webContents zoom and Windows DPI combine.
  const png=await q.main.evaluate('(async()=>{const w=qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html"));return(await w.webContents.capturePage()).toPNG().toString("base64")})()');
  fs.writeFileSync(path.join(output,name),Buffer.from(png,'base64'));
 };
 async function controls(label){
  const data=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('button,input,select,textarea,summary')].filter(el=>el.checkVisibility()&&!el.closest('[hidden],dialog:not([open])')).map(el=>{const b=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent?.trim().slice(0,70),x:b.x,y:b.y,w:b.width,h:b.height}})}));
  r.checks.push({label,...data});if(data.scroll>data.width+3)r.failures.push({label,kind:'document-overflow',width:data.width,scroll:data.scroll});
 }
 try{
  const search=page.getByRole('textbox',{name:'Search subjects',exact:true});
  await search.fill('Structures');await search.press('End');
  const selected=await page.locator('[role=listbox] [role=option][aria-selected=true]').textContent();
  await search.press('ArrowLeft');assert.equal(await search.evaluate(el=>el.selectionStart),'Structures'.length-1);
  assert.equal(await page.locator('[role=listbox] [role=option][aria-selected=true]').textContent(),selected);await search.fill('');
  const mode=page.getByRole('radiogroup',{name:'Timer mode',exact:true});await mode.getByRole('radio',{checked:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await mode.getByRole('radio',{checked:true}).evaluate(el=>el===document.activeElement),true);await page.keyboard.press('ArrowLeft');
  await page.getByRole('button',{name:'Library',exact:true}).click();const menu=page.getByRole('button',{name:/^Options for /}).first();
  await menu.focus();await page.keyboard.press('Enter');await page.getByRole('menu').waitFor();
  await page.keyboard.press('End');await page.keyboard.press('Escape');assert.equal(await menu.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');await page.getByRole('menu').waitFor();await page.keyboard.press('Tab');await page.getByRole('menu').waitFor({state:'detached'});assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
  r.componentKeyboard=['Subject search preserves Left caret movement and subject selection','Timer mode radio arrows move and select','Portalled menu End/Escape restoration and Tab exit retain focus'];
  await page.getByRole('button',{name:'Home',exact:true}).click();
  const a=await invoke('appearance:get');await invoke('appearance:set',{...a,uiScale:1,mode:'light'});
  // App-local Chromium zoom: no changes to Windows text/contrast settings.
  await q.main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).webContents.setZoomFactor(2);true');
  for(const l of langs){
   await invoke('settings:set','language',l);await page.waitForFunction(l=>document.documentElement.lang===l,l);
   for(const tab of ['Home','History','Stats','Learn','Settings']){
    await page.getByRole('button',{name:t(l,tab),exact:true}).click();await pause(100);await controls(l+'-'+tab+'-200');
    if(tab==='Settings')await page.getByRole('navigation',{name:t(l,'Settings pages'),exact:true}).getByRole('button',{name:t(l,'Appearance'),exact:true}).click();
    if(l==='en'||l==='ar')await screenshot(l+'-'+tab.toLowerCase()+'-200.png');
   }
  }
  await invoke('settings:set','language','en');await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:'Start',exact:true}).click();await page.getByRole('button',{name:'Finish session',exact:true}).waitFor();
  await controls('en-Focus-200');await screenshot('en-focus-200.png');
  const buttons=page.getByRole('button',{name:'Finish session',exact:true});await buttons.focus();
  r.focusFinish=await buttons.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,viewport:[innerWidth,innerHeight]}});
  if(r.focusFinish.y<0||r.focusFinish.y+r.focusFinish.h>r.focusFinish.viewport[1]+2)r.failures.push({label:'Focus Finish',kind:'unreachable-vertical-control',...r.focusFinish});
  await invoke('session:finish');await invoke('session:discardFinished');await invoke('session:endSitting');
  const current=await q.snapshot();for(const k of ['blocks','activity'])assert.deepEqual(current[k].filter(row=>old[k].some(o=>o.id===row.id)),old[k]);assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);r.success=r.failures.length===0;
 }finally{fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(r,null,2)+'\n');await q.close()}
 console.log(JSON.stringify({...r,checks:r.checks.length},null,2));assert.equal(r.success,true);
})().catch(e=>{console.error(e.stack);process.exitCode=1});
