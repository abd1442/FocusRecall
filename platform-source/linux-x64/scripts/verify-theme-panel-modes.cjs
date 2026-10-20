// Additional native panel checks: compact/expanded, Arabic, system and explicit mode.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {open,pause}=require('./lib/theme-qa.cjs');
(async()=>{
 const q=await open({root:process.env.FOCUSRECALL_THEME_PANEL_ROOT||'out/qa-temp/theme-panel-modes',output:process.env.FOCUSRECALL_THEME_PANEL_OUTPUT||'docs/verification/theme-integration-20261018/panel-modes'});
 const {page,invoke,main,context,output}=q,results={success:false,checks:[],archiveSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(q.exe),'resources/app.asar'))).digest('hex')};
 const active=async(p,id)=>p.waitForFunction(id=>document.documentElement.dataset.frTheme===id,id);
 try{
  const a=await invoke('appearance:get'),item=(await invoke('library:listPickerItems'))[0];
  await invoke('appearance:set',{...a,mode:'system',lightTheme:'ivory-ink',darkTheme:'ink-dim'});await invoke('settings:set','panelOpen',true);await invoke('session:start',{itemId:item.id,timerMode:'flow',targetSeconds:1500});await pause(200);
  const panel=context.pages().find(p=>p.url().endsWith('#panel'));assert.ok(panel);await panel.emulateMedia({colorScheme:null});await main.evaluate('qaElectron.BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith("#panel")).forEach(w=>w.showInactive());true');
  for(const mode of ['light','dark','light']){await main.evaluate(`qaElectron.nativeTheme.themeSource=${JSON.stringify(mode)};true`);const id=mode==='dark'?'ink-dim':'ivory-ink';await active(page,id);await active(panel,id);results.checks.push({systemMode:mode,mainAndPanelAgree:true});}
  await invoke('appearance:set',{...a,mode:'dark',darkTheme:'deep-sea'});await active(panel,'deep-sea');await main.evaluate('qaElectron.nativeTheme.themeSource="light";true');await active(panel,'deep-sea');results.explicitModeIgnoresSystem=true;
  for(const language of ['en','ar'])for(const expanded of [false,true])for(const size of ['small','large']){
   await invoke('settings:set','language',language);await invoke('settings:set','panelExpanded',expanded);await invoke('appearance:set',{...a,mode:'dark',darkTheme:'deep-sea',panelSize:size,panelOpacity:0.95});await pause(120);assert.equal(await panel.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
   const controls=await panel.locator('button').evaluateAll(bs=>bs.filter(b=>{const r=b.getBoundingClientRect();return r.width&&r.height}).map(b=>{const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label')||b.textContent.trim(),left:r.left,right:r.right,width:innerWidth}}));assert.ok(controls.length);for(const c of controls)assert.ok(c.left>=-2&&c.right<=c.width+2,JSON.stringify(c));
   const file=[language,expanded?'expanded':'compact',size].join('-')+'.png';await panel.screenshot({path:path.join(output,file)});results.checks.push({language,expanded,size,controlsInsideWindow:true});
  }
  await invoke('session:finish');await invoke('session:discardFinished');await invoke('session:endSitting');await invoke('settings:set','panelOpen',false);assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);results.success=true;results.rendererErrors=[];results.observedNetworkRequests=[];
 }finally{await q.close();fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2)+'\n')}
 console.log('PASS panel modes '+JSON.stringify({checks:results.checks.length,archive:results.archiveSHA256}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
