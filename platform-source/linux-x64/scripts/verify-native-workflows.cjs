// Native packaged UI smoke. Unknown Linux desktop observation must fail closed;
// it is never replaced by a pretend logind provider to make CI pass.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/timer-qa.cjs');
const output=path.resolve(process.env.FOCUSRECALL_NATIVE_QA_OUTPUT||'docs/verification/native-ci'),root='out/qa-temp/native-ui-'+Date.now();
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
  await q.invoke('settings:set','lastItemId',item.id);await q.invoke('settings:set','panelOpen',true);
  for(const display of ['digital','circular'])for(const size of ['small','medium','large']){
   await q.invoke('appearance:set',{...await q.invoke('appearance:get'),panelTimerDisplay:display,panelSize:size});await pause(350);
   const panel=q.context.pages().find(p=>p.url().endsWith('#panel'));assert.ok(panel);await panel.locator('.floating-panel').waitFor();
   const clipped=await panel.evaluate(()=>[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.x< -1||r.y< -1||r.right>innerWidth+1||r.bottom>innerHeight+1)}).map(e=>e.getAttribute('aria-label')||e.textContent));assert.deepEqual(clipped,[]);
   await panel.screenshot({path:path.join(output,'ready-'+display+'-'+size+'.png')});
  }
  results.checks.push('actual '+(process.env.FOCUSRECALL_NATIVE_DISPLAY||'x11')+' compositor: both ready timer styles at three sizes, controls unclipped');
  await q.invoke('settings:set','studyExperience','full');
  await assert.rejects(()=>q.invoke('preparation:begin',start,true),/lock status|timing|paused/i);
  assert.equal((await q.invoke('session:get')).running,null);assert.equal((await q.snapshot()).blocks.length,0);
  results.checks.push('Full preparation also refuses unobservable timing without writing study records');
  results.limitations.push('Quick/Full live timing and X11/Wayland lock behavior require a real logged-in Linux desktop. Engine timing regressions run natively in Vitest.');
 }else{
  await q.invoke('session:start',start);await pause(2200);await q.invoke('session:toggleDistracted');
  const paused=await q.invoke('session:get');assert.ok(paused.running.pauses.some(p=>p.endedAt===null));await pause(1200);await q.invoke('session:back');await pause(1200);
  for(const display of ['digital','circular']){
   await q.invoke('appearance:set',{...await q.invoke('appearance:get'),panelTimerDisplay:display});await q.invoke('settings:set','panelOpen',true);await pause(500);
   const panel=q.context.pages().find(p=>p.url().endsWith('#panel'));assert.ok(panel);await panel.locator('.floating-panel').waitFor();await panel.screenshot({path:path.join(output,'timer-'+display+'.png')});
   for(const name of ['Distracted','Finish'])assert.ok(await panel.getByRole('button',{name,exact:true}).isVisible());
  }
  await q.invoke('session:finish');assert.equal((await q.invoke('session:get')).stage,'idle');const blocks=(await q.snapshot()).blocks;assert.equal(blocks.length,1);assert.equal(blocks[0].recall_seconds,null);
  results.checks.push('real elapsed Quick focus, pause, resume, both packaged timers, finish');
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
 results.limitations.push('Physical sleep/lock, screen readers, tray and desktop integration remain manual hardware checks.');results.fixture=path.basename(q.root);results.success=true;
}catch(e){results.error=e.stack;process.exitCode=1;console.error(e);if(q){try{results.diagnostic=await q.page.evaluate(()=>({visibility:document.visibilityState,width:innerWidth,height:innerHeight,radio:[...document.querySelectorAll('input[name="study-experience"]')].map(e=>({value:e.value,rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display})),animations:document.getAnimations().map(a=>({state:a.playState,currentTime:a.currentTime}))}));results.windows=await q.main.evaluate('qaElectron.BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),bounds:w.getBounds(),url:w.webContents.getURL()}))');await q.page.screenshot({path:path.join(output,'failure.png'),timeout:5000});const logs=fs.readdirSync(q.root).filter(n=>n.startsWith('qa-launch-')).sort();results.launchLog=fs.readFileSync(path.join(q.root,logs.at(-1)),'utf8').slice(-8000)}catch(d){results.diagnosticError=String(d)}}}finally{await q?.close();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results))}})();
