// Native packaged UI smoke. Unknown Linux desktop observation must fail closed;
// it is never replaced by a pretend logind provider to make CI pass.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/timer-qa.cjs');
const output=path.resolve('docs/verification/native-ci'),root='out/qa-temp/native-ui-'+Date.now();
const results={platform:process.platform,arch:process.arch,checks:[],limitations:[]};let q;
(async()=>{try{
 q=await open({root,output});await q.page.getByRole('dialog').waitFor();
 assert.equal((await q.invoke('settings:getAll')).foregroundTrackingEnabled,false);
 await q.page.locator('input[name="study-experience"][value="quick"]').check();
 await q.page.getByRole('button',{name:'Start studying',exact:true}).click();await q.page.getByRole('dialog').waitFor({state:'hidden'});
 const category=await q.invoke('library:createCategory',{name:'Fictional native CI',color:'#4C989C',icon:null,parentId:null});
 const item=await q.invoke('library:createItem',{categoryId:category.id,name:'History — comparing fictional accounts from several sources',color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false});
 await q.page.reload();await q.page.getByRole('heading',{name:'Quick Mode',exact:true}).waitFor();
 for(const language of ['en','ar','es','fr','zh-Hans','pt-BR','de']){
  await q.invoke('settings:set','language',language);await pause(100);assert.equal(await q.page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
  assert.ok(await q.page.locator('main').innerText());results.checks.push('rendered '+language);
 }
 await q.invoke('settings:set','language','en');
 const seeds={};new Function('exports',require('typescript').transpileModule(fs.readFileSync('src/core/themeSeeds.ts','utf8'),{compilerOptions:{module:require('typescript').ModuleKind.CommonJS}}).outputText)(seeds);
 for(const theme of seeds.THEME_SEEDS){const key=theme.mode==='light'?'lightTheme':'darkTheme';await q.invoke('appearance:set',{...await q.invoke('appearance:get'),mode:theme.mode,[key]:theme.id});assert.equal((await q.invoke('appearance:get'))[key],theme.id);await pause(30);}
 results.checks.push('all 26 theme preferences applied to native renderer');
 for(const [w,h] of [[800,600],[1280,800],[1920,1080]]){
  await q.main.evaluate(`qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/out/renderer/index.html')).setContentSize(${w},${h})`);await pause(150);
  await q.page.getByRole('button',{name:'Start',exact:true}).scrollIntoViewIfNeeded();await q.page.screenshot({path:path.join(output,`launcher-${w}.png`)});results.checks.push('launcher '+w+'x'+h);
 }
 const start={itemId:item.id,timerMode:'flow',targetSeconds:60};
 if(process.platform==='linux'){
  // Hosted Xvfb has no logged-in desktop session. Safe refusal is the result.
  assert.equal(process.env.XDG_SESSION_ID,undefined,'Use a genuine desktop separately if logind is available.');
  await assert.rejects(()=>q.invoke('session:start',start),/lock status|timing|paused/i);
  assert.equal((await q.invoke('session:get')).running,null);assert.equal((await q.snapshot()).blocks.length,0);
  results.checks.push('unknown desktop observation blocks timing without writing study records');
  results.limitations.push('Quick/Full live timing and X11/Wayland lock behavior require a real logged-in Linux desktop. Engine timing regressions run natively in Vitest.');
 }else{
  await q.invoke('session:start',start);await pause(2200);await q.invoke('session:toggleDistracted');
  const paused=await q.invoke('session:get');assert.ok(paused.running.pauses.some(p=>p.endedAt===null));await pause(1200);await q.invoke('session:back');await pause(1200);
  for(const display of ['digital','circular']){
   await q.invoke('appearance:set',{...await q.invoke('appearance:get'),panelTimerDisplay:display});await q.invoke('settings:set','panelOpen',true);await pause(500);
   const panel=q.context.pages().find(p=>p.url().endsWith('#panel'));assert.ok(panel);await panel.locator('.floating-panel').waitFor();await panel.screenshot({path:path.join(output,'timer-'+display+'.png')});
   for(const name of ['Distracted','Finish'])assert.ok(await panel.getByRole('button',{name,exact:true}).isVisible());
  }
  if(process.platform==='darwin'){
   const id=(await q.invoke('session:get')).running.id;
   await q.main.evaluate("qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/out/renderer/index.html')).close();true");await pause(300);
   assert.equal(await q.main.evaluate('qaElectron.app.isReady()'),true);
   await q.main.evaluate("qaElectron.app.emit('activate');true");
   for(let i=0;i<60;i++){const page=q.context.pages().find(p=>p.url().endsWith('/out/renderer/index.html'));if(page&&!page.isClosed()){q.page=page;break}await pause(100)}
   await q.page.waitForFunction(()=>!!window.api);q.invoke=(c,...a)=>q.page.evaluate(([c,a])=>window.api.invoke(c,...a),[c,a]);
   assert.equal((await q.invoke('session:get')).running.id,id);results.checks.push('actual window close preserves live timer; programmatic Dock activate recreates main window');
  }
  await q.invoke('session:finish');assert.equal((await q.invoke('session:get')).stage,'idle');const blocks=(await q.snapshot()).blocks;assert.equal(blocks.length,1);assert.equal(blocks[0].recall_seconds,null);
  results.checks.push('real elapsed Quick focus, pause, resume, both packaged timers, finish');
  for(const [stop,resume] of [['lock-screen','unlock-screen'],['suspend','resume']]){
   await q.invoke('session:start',start);await pause(1100);
   await q.main.evaluate('qaElectron.powerMonitor.emit('+JSON.stringify(stop)+');true');assert.ok((await q.invoke('session:get')).recovery);
   await pause(1200);await q.main.evaluate('qaElectron.powerMonitor.emit('+JSON.stringify(resume)+');true');
   assert.equal((await q.invoke('session:get')).running,null);assert.ok((await q.invoke('session:get')).recovery);
   await q.invoke('session:resolveRecovery','continue');await pause(1100);await q.invoke('session:finish');
   results.checks.push('simulated '+stop+'/'+resume+' invokes production recovery handlers without auto-resume');
  }
  await q.invoke('session:start',start);await pause(1100);await q.invoke('session:quickAction','break',(await q.invoke('session:get')).running.id);assert.equal((await q.invoke('session:get')).rest.phase,'running');
  await q.main.evaluate("qaElectron.powerMonitor.emit('suspend');true");const rest=(await q.invoke('session:get')).rest;assert.equal(rest.phase,'over');
  await pause(1300);await q.main.evaluate("qaElectron.powerMonitor.emit('resume');true");assert.equal((await q.invoke('session:get')).rest.actualSeconds,rest.actualSeconds);await q.invoke('rest:finish',null);await q.invoke('session:endSitting');
  results.checks.push('simulated sleep ends rest at observed cutoff; blind gap is excluded');

  await q.invoke('session:start',start);await pause(1100);await q.close();q=await open({root,output,restart:true});
  assert.ok((await q.invoke('session:get')).recovery);assert.equal((await q.invoke('settings:getAll')).studyExperience,'quick');await q.invoke('session:resolveRecovery','continue');await pause(1100);await q.invoke('session:finish');
  await q.invoke('settings:set','studyExperience','full');await q.invoke('session:start',start);await pause(1100);await q.invoke('session:finish');assert.equal((await q.invoke('session:get')).stage,'recall');await q.invoke('session:endSitting');
  results.checks.push('persisted Quick preference, restart/recovery, Full recall workflow');
 }
 const backup=path.join(q.root,'native-fictional-backup.db');await q.main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(backup)}});true`);assert.ok(await q.invoke('backup:create'));
 assert.equal(await q.main.evaluate(`(()=>{const db=new(qaRequire('better-sqlite3'))(${JSON.stringify(backup)},{readonly:true});try{return db.pragma('integrity_check',{simple:true})}finally{db.close()}})()`),'ok');
 const savedBlocks=(await q.snapshot()).blocks,savedMinutes=(await q.invoke('settings:getAll')).focusTargetMinutes;
 await q.invoke('settings:set','focusTargetMinutes',savedMinutes===29?28:29);
 // Exercise real validated/staged restore and app shutdown; relaunch the same
 // marked fixture explicitly so no unattended app process escapes the harness.
 await q.main.evaluate(`qaElectron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(backup)}]});qaElectron.app.relaunch=()=>{};true`);
 const choice=await q.invoke('backup:inspectRestore');assert.ok(choice.token);await q.invoke('backup:restore',choice.token);await pause(700);await q.close();
 q=await open({root,output,restart:true});assert.deepEqual((await q.snapshot()).blocks,savedBlocks);assert.equal((await q.invoke('settings:getAll')).focusTargetMinutes,savedMinutes);
 results.checks.push('validated staged backup restore, restart, exact block and preference preservation');
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);assert.equal((await q.snapshot()).activity.length,0);results.checks.push('packaged native SQLite backup integrity; tracking OFF; no renderer network requests');
 results.limitations.push('Physical sleep/lock, screen readers, tray and desktop integration remain manual hardware checks.');results.success=true;
}catch(e){results.error=e.stack;process.exitCode=1;console.error(e)}finally{await q?.close();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results))}})();
