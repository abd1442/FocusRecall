const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/theme-qa.cjs');
(async()=>{
 const q=await open({root:process.env.FOCUSRECALL_HOME_LAYOUT_ROOT||'out/qa-temp/home-usability-layout',output:process.env.FOCUSRECALL_HOME_LAYOUT_OUTPUT||'docs/verification/home-usability-20261018/layout'}),{page,invoke,output}=q;
 const langs=['en','ar','es','fr','zh-Hans','pt-BR','de'],catalogs=Object.fromEntries(langs.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));const t=(l,k)=>catalogs[l][k]||k;
 const r={checks:[],success:false},old=await q.snapshot();
 const capture=async name=>{const png=await q.main.evaluate('(async()=>{const w=qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html"));return(await w.webContents.capturePage()).toPNG().toString("base64")})()');fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(png,'base64'))};
 try{
  const a=await invoke('appearance:get');await invoke('appearance:set',{...a,mode:'light',uiScale:1});
  await q.main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).webContents.setZoomFactor(2);true');
  for(const l of langs){
   await invoke('settings:set','language',l);const sort=page.getByRole('combobox',{name:t(l,'Sort subjects'),exact:true});await sort.waitFor();
   await sort.selectOption('manual');await page.getByRole('button',{name:t(l,'Arrange subjects'),exact:true}).waitFor();await pause(80);
   const search=page.getByRole('textbox',{name:t(l,'Search subjects'),exact:true});await search.focus();
   const s=await search.boundingBox(),b=await sort.boundingBox();assert.ok(Math.abs(s.y-b.y)<2,l+' aligned');assert.ok(s.width>=100,l+' search remains usable at 200%');
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.width+2,l+' no overflow');
   await page.getByRole('button',{name:t(l,'Arrange subjects'),exact:true}).click();const dialog=page.getByRole('dialog',{name:t(l,'Arrange subjects'),exact:true});await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   assert.equal(await page.getByRole('button',{name:t(l,'Arrange subjects'),exact:true}).evaluate(el=>el===document.activeElement),true);
   r.checks.push({language:l,zoom:2,sameSearchRow:true,searchWidth:s.width,noDocumentOverflow:true,dialogEscapeRestoresFocus:true});
   if(l==='ar'||l==='en')await capture(l+'-home-200');
  }
  await q.main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).webContents.setZoomFactor(1);true');
  await invoke('settings:set','language','en');
  for(const [mode,id] of [['light','ivory-ink'],['light','library'],['dark','deep-sea'],['dark','darkroom']]){
   await invoke('appearance:set',{...a,mode,[mode+'Theme']:id});await page.waitForFunction(id=>document.documentElement.dataset.frTheme===id,id);await capture(id+'-home');r.checks.push({theme:id,newControlsVisible:true});
  }
  assert.deepEqual(await q.snapshot(),old);assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);r.success=true;
 }finally{fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(r,null,2)+'\n');await q.close()}
 console.log(JSON.stringify(r));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
