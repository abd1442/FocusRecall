// Native Electron UI verification; only the marked fictional demo fixture is copied.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require(process.env.FOCUSRECALL_PLAYWRIGHT_PATH||'playwright');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve(process.env.FOCUSRECALL_LOCALIZATION_QA_ROOT||'out/qa-temp/localization-preview-20261016'),source=path.resolve('out/qa-temp/brand-upgrade-beta24');
const output=path.resolve(process.env.FOCUSRECALL_LOCALIZATION_QA_OUTPUT||'docs/verification/localization-20261016');
assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));
const executable=process.env.FOCUSRECALL_QA_EXECUTABLE&&path.resolve(process.env.FOCUSRECALL_QA_EXECUTABLE);
if(executable)assert.ok(executable.startsWith(path.resolve('dist')+path.sep));
(async()=>{
 assert.equal(fs.readFileSync(path.join(source,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
 assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep),'QA profiles must stay inside the workspace');
 assert.ok(!fs.existsSync(root),'Use a fresh isolated fixture');fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');
 fs.copyFileSync(path.join(source,'learnalyt-demo.db'),path.join(root,'learnalyt-demo.db'));
 fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:true}));
 const env={...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
 const args=['--remote-debugging-port=9460','--inspect=9461'];
 const app=cp.spawn(executable||require('electron'),executable?args:[path.resolve('.'),...args],{cwd:root,env,windowsHide:true,stdio:'ignore'});
 let inspector,browser,page;
 try{
  for(let i=0;i<120;i++){try{inspector=(await fetch('http://127.0.0.1:9461/json/list').then(r=>r.json()))[0];await fetch('http://127.0.0.1:9460/json/version').then(r=>r.json());if(inspector)break}catch{}await pause(250)}
  assert.ok(inspector,'Isolated app did not open its inspector');browser=await chromium.connectOverCDP('http://127.0.0.1:9460');
  page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/out/renderer/index.html'));assert.ok(page);const rendererErrors=[];page.on('pageerror',error=>rendererErrors.push(error.message));await pause(900);
  const invoke=(channel,...args)=>page.evaluate(([channel,args])=>window.api.invoke(channel,...args),[channel,args]);
  assert.equal(await invoke('app:demo'),true);assert.equal((await invoke('settings:getAll')).foregroundTrackingEnabled,false);
  await invoke('settings:set','starterGuideCompleted',true);await invoke('settings:set','minimizeOnStart',false);await invoke('session:endSitting');
  await page.reload();await pause(700);await page.getByRole('button',{name:'Home',exact:true}).click();
  while(await page.getByRole('button',{name:'Leave for later',exact:true}).count())await page.getByRole('button',{name:'Leave for later',exact:true}).first().click();
  const items=await invoke('library:listPickerItems'),namesBefore=items.map(item=>item.name),item=items[0];
  await page.locator('button[role=option]').filter({hasText:item.name}).first().click();
  const sentinel='PRIVATE DRAFT — عربي 中文';await page.getByPlaceholder('What do I want to get done?',{exact:true}).fill(sentinel);
  const catalogs=Object.fromEntries(['ar','es','fr','zh-Hans','pt-BR','de'].map(language=>[language,JSON.parse(fs.readFileSync('src/core/locales/'+language+'.json'))]));
  const text=(language,key)=>catalogs[language]?.[key]||key,checks=[];
  for(const language of ['en','ar','es','fr','zh-Hans','pt-BR','de']){
   await invoke('settings:set','language',language);await pause(200);
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
   await page.getByRole('button',{name:text(language,'Home'),exact:true}).waitFor();
   assert.equal(await page.getByPlaceholder(text(language,'What do I want to get done?'),{exact:true}).inputValue(),sentinel);
   assert.deepEqual((await invoke('library:listPickerItems')).map(item=>item.name),namesBefore);
   await page.getByRole('button',{name:text(language,'Start'),exact:true}).first().waitFor();
   if(['ar','de'].includes(language))await page.screenshot({path:path.join(output,language+'-home.png')});
   checks.push({language,htmlLanguage:true,direction:true,draftPreserved:true,subjectNamesPreserved:true,startControl:true});
  }
  await page.getByRole('button',{name:text('de','Settings'),exact:true}).click();
  await page.locator('[data-language-setting] select').selectOption('ar');await pause(200);assert.equal((await invoke('settings:getAll')).language,'ar');
  await page.screenshot({path:path.join(output,'ar-settings.png')});
  await page.getByRole('button',{name:text('ar','Home'),exact:true}).click();
  await page.setViewportSize({width:980,height:760});await pause(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.screenshot({path:path.join(output,'ar-small-home.png')});
  await page.setViewportSize({width:1600,height:1000});await pause(200);
  await invoke('preparation:begin',{itemId:item.id,timerMode:'flow',targetSeconds:1500});
  await pause(400);const panel=browser.contexts()[0].pages().find(p=>p.url().endsWith('#panel'));assert.ok(panel);
  await panel.getByRole('button',{name:text('ar','Ready to start'),exact:true}).waitFor();assert.equal(await panel.locator('html').getAttribute('dir'),'rtl');
  await invoke('preparation:confirm');await pause(700);
  const previousPhone=(await invoke('reasons:counts')).phone||0;
  await page.getByRole('button',{name:text('ar','Distracted'),exact:true}).click();await pause(150);
  await page.getByRole('button',{name:text('ar','Back'),exact:true}).click();
  const reasons=browser.contexts()[0].pages().find(p=>p.url().endsWith('#reasons'));assert.ok(reasons);
  await reasons.getByRole('button',{name:text('ar','Phone'),exact:true}).click();
  assert.equal((await invoke('reasons:counts')).phone,previousPhone+1);
  await invoke('session:finish');await pause(350);
  await page.getByRole('button',{name:text('ar','Keep it'),exact:true}).click();
  await page.getByRole('button',{name:text('ar','Type notes'),exact:true}).click();
  await page.locator('textarea').first().fill(sentinel);await invoke('settings:set','language','fr');await pause(150);
  assert.equal(await page.locator('textarea').first().inputValue(),sentinel);
  await page.getByRole('button',{name:text('fr','Continue to session log'),exact:true}).click();
  await pause(350);const sessionId=(await invoke('session:get')).finished[0].sessionId;
  const logBefore=await invoke('session:getLogDraft',sessionId);assert.ok(logBefore);
  assert.ok(Object.values(logBefore.perSubject).some(answer=>answer.untouched?.length),'Expected suggested unanswered fields');
  await invoke('settings:set','language','ar');await pause(150);
  assert.deepEqual(await invoke('session:getLogDraft',sessionId),logBefore,'Changing language must not confirm, reset or rewrite answers');
  await invoke('settings:set','language','fr');await pause(100);
  await page.getByRole('button',{name:text('fr','Continue to rest'),exact:true}).click();
  await page.getByRole('button',{name:text('fr','Start rest'),exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'fr-rest-setup.png')});
  assert.deepEqual(rendererErrors,[]);
  fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify({fictionalOnly:true,realInstallationModified:false,checks,arabicPreparation:true,arabicRecall:true,arabicDistractionReasonKeepsCanonicalId:true,recallDraftSurvivesLanguageChange:true,logDraftAndUnconfirmedValuesSurviveLanguageChange:true,frenchLogAndRest:true,settingsLanguageSelector:true,narrowArabicViewport:true,rendererErrors},null,2));
  console.log('PASS seven languages, RTL, unchanged subject names, live draft preservation, review/log/rest.');
 }finally{
  if(inspector){const ws=new WebSocket(inspector.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:`(()=>{if(process.env.FOCUSRECALL_DATA_DIR!==${JSON.stringify(root)})throw Error('Wrong test profile');setTimeout(()=>process.getBuiltinModule('module').createRequire(process.execPath)('electron').app.quit(),100)})()`}}));await pause(300);ws.close()}
  if(browser)await browser.close();await Promise.race([new Promise(resolve=>app.once('exit',resolve)),pause(1500)]);
 }
})().catch(error=>{console.error(error);process.exitCode=1});
