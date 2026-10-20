// Scientific recommendation policy in an actual packaged Windows app, new fictional profile only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.FOCUSRECALL_PLAYWRIGHT_PATH||'playwright');
const exe=path.resolve('dist/recommendation-policy-20261017/win-unpacked/FocusRecall.exe');
const [rootArg,outputArg]=process.argv.slice(2),scenario='known',root=path.resolve(rootArg),output=path.resolve(outputArg);
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep));assert.ok(!fs.existsSync(root),'Use a NEW fictional profile');
assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));assert.ok(['known','null'].includes(scenario));
const fixture=path.resolve('out/qa-temp/brand-upgrade-beta24');assert.equal(fs.readFileSync(path.join(fixture,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');
fs.copyFileSync(path.join(fixture,'learnalyt-demo.db'),path.join(root,'learnalyt-demo.db'));fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:true}));
cp.execFileSync('python',[path.resolve('scripts/prepare-recommendation-fixture.py'),root],{stdio:'inherit',windowsHide:true});
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'],catalogs=Object.fromEntries(languages.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),text=(l,k)=>catalogs[l][k]||k;
async function inspector(){
 const targets=await fetch('http://127.0.0.1:9591/json/list',{signal:AbortSignal.timeout(1500)}).then(r=>r.json());
 const ws=new WebSocket(targets[0].webSocketDebuggerUrl),pending=new Map();let id=0;
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 return {close:()=>ws.close(),evaluate:async expression=>{const r=await new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}};
}
(async()=>{
 const results={scenario,profile:root,executable:exe,languages:[],success:false},errors=[],network=[];let main,browser,app;
 try{
  const env={...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
  app=cp.spawn(exe,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9590','--inspect=127.0.0.1:9591'],{cwd:root,env,windowsHide:true,stdio:'ignore'});
  for(let i=0;i<100;i++){try{main=await inspector();await fetch('http://127.0.0.1:9590/json/version',{signal:AbortSignal.timeout(1000)});break}catch{main?.close();main=null;await delay(200)}}
  assert.ok(main);assert.equal(await main.evaluate('process.env.FOCUSRECALL_DATA_DIR'),root);
  await main.evaluate('globalThis.qaElectron=process.getBuiltinModule("module").createRequire(process.execPath)("electron")');
  browser=await chromium.connectOverCDP('http://127.0.0.1:9590');const page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/out/renderer/index.html'));assert.ok(page.url().includes('/app.asar/'));page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});await page.waitForFunction(()=>!!window.api);
  const invoke=(c,...a)=>page.evaluate(([c,a])=>window.api.invoke(c,...a),[c,a]);
  assert.equal(await invoke('app:demo'),true);assert.equal((await invoke('settings:getAll')).foregroundTrackingEnabled,false);
  for(const [k,v] of Object.entries({starterGuideCompleted:true,minimizeOnStart:false,panelAutoShow:false,panelOpen:false,restMusic:false,studyReminderDailyEnabled:false,studyReminderSmartEnabled:false}))await invoke('settings:set',k,v);
  await invoke('session:endSitting');const history=(await invoke('stats:raw')).blocks;assert.equal(history.length,180);
  await main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).setContentSize(1200,900)');
  const methodNote=fs.readFileSync('src/core/recommendations.ts','utf8').match(/METHOD_OBSERVATION_NOTE='([^']+)'/)[1],experimentNote=fs.readFileSync('src/core/recommendations.ts','utf8').match(/EXPERIMENT_NOTE='([^']+)'/)[1];
  const item=(await invoke('library:listPickerItems'))[0];assert.ok(item);
  const origin={id:'legacy-method-observation',title:'Try Re-reading',factorKey:'field:24',option:'Re-reading',outcome:'recall',range:{from:'2026-04-20',to:'2026-10-16'},calculation:'Historical saved calculation',limitations:'Historical saved limits',evidence:'Preliminary pattern',contexts:[{itemId:item.id,activity:'problems'}]};
  await invoke('tools:saveExperiment',{id:'legacy-method-plan',name:'Legacy fictional method plan',change:'Try Re-reading',origin,itemId:item.id,activity:'problems',baselineFrom:'2026-04-20',changeOn:'2026-07-01',endDay:'2026-10-16',outcome:'recall',notes:'Historical fictional plan, preserved',status:'completed',includeUntouched:false});
  const savedLegacy=(await invoke('tools:get')).experiments.find(e=>e.id==='legacy-method-plan');
  for(const language of languages){
   const t=k=>text(language,k);await invoke('settings:set','language',language);await delay(120);await page.getByRole('button',{name:t('Stats'),exact:true}).click();
   await page.getByRole('button',{name:t('Adjust filters'),exact:true}).click();await page.getByLabel(t('Dates'),{exact:true}).selectOption('all');await page.getByRole('button',{name:t('Close filters'),exact:true}).click();
   await require('./qa-stats-navigation.cjs')(page,t,'factors');const factors=page.locator('#stats-factors');await factors.getByLabel(t('Question'),{exact:true}).selectOption('field:24');
   assert.ok((await factors.innerText()).includes(t(methodNote)));if(language!=='en'){assert.ok(!(await factors.innerText()).includes('Study methods used'),'Built-in method label untranslated');assert.ok(!(await factors.innerText()).includes('higher reported focus'),'Ranking direction untranslated');}assert.ok(await factors.getByLabel(t('Exploratory association'),{exact:true}).count());await page.screenshot({path:path.join(output,language+'-methods.png')});
   await require('./qa-stats-navigation.cjs')(page,t,'insights');const methods=page.locator('#stats-insights [data-insight-id^="field:24:"]');assert.ok(await methods.count());assert.equal(await methods.getByRole('button',{name:t('Plan a focus comparison'),exact:true}).count(),0);assert.ok((await methods.first().innerText()).includes(t(methodNote)));await methods.first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,language+'-observation.png')});
   await page.getByRole('button',{name:t('Saved views'),exact:true}).first().click();const tools=page.locator('#stats-tools');assert.ok((await tools.innerText()).includes(t(methodNote)));await page.screenshot({path:path.join(output,language+'-saved-view.png')});await tools.getByRole('button',{name:t('Close Stats companion'),exact:true}).click();
   await require('./qa-stats-navigation.cjs')(page,t,'report');const written=page.locator('article.stats-report');if(!await written.isVisible())await page.locator('#stats-report summary').filter({hasText:t('Written report / archive')}).click();const reportText=await written.innerText();assert.ok(reportText.includes(t(methodNote)));assert.ok(!reportText.includes('Try Re-reading'));fs.writeFileSync(path.join(output,language+'-report.txt'),reportText);
   await page.getByRole('button',{name:t('Experiments'),exact:true}).first().click();assert.ok((await tools.innerText()).includes(t(experimentNote)));
   const legacy=tools.locator('article').filter({has:page.getByRole('heading',{name:'Legacy fictional method plan',exact:true})});await legacy.getByRole('button',{name:t('Edit experiment'),exact:true}).click();
   await tools.locator('summary').filter({hasText:t('Original finding')}).first().click();assert.ok(!(await tools.locator('fieldset > details').first().locator('p').first().innerText()).includes('Try Re-reading'),'Historical recommendation leaked into current origin summary');assert.equal(await tools.getByLabel(t('Experiment change'),{exact:true}).inputValue(),'Try Re-reading');await page.screenshot({path:path.join(output,language+'-legacy-plan.png')});
   await tools.getByRole('button',{name:t('Close editor'),exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:t('Continue'),exact:true}).click();
   await tools.getByRole('button',{name:t('Plan an experiment'),exact:true}).click();await tools.getByLabel(t('Experiment name'),{exact:true}).fill('Fictional method question '+language);await tools.getByLabel(t('Experiment change'),{exact:true}).fill('Compare Re-reading and Self-testing; check a relevant task later');await tools.getByLabel(t('Experiment subject'),{exact:true}).selectOption(String(item.id));
   if(language==='en'){
    await tools.locator('summary').filter({hasText:t('Advanced comparison controls')}).click();await tools.getByLabel(t('Experiment outcome'),{exact:true}).selectOption('recall');await tools.getByRole('button',{name:t('Save experiment'),exact:true}).click();await delay(150);const manual=(await invoke('tools:get')).experiments.find(e=>e.name==='Fictional method question en');assert.ok(manual&&!manual.origin&&manual.outcome==='recall');results.manualMethodPlanSaved=true;
    await page.evaluate(o=>window.dispatchEvent(new CustomEvent('tf-experiment-suggestion',{detail:{change:'Try Re-reading',outcome:'focus',origin:{...o,outcome:'focus'}}})),origin);await delay(100);assert.equal(await tools.getByLabel(t('Experiment name'),{exact:true}).count(),0);results.legacyMethodReplayBlocked=true;
   }else{await tools.getByRole('button',{name:t('Close editor'),exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:t('Continue'),exact:true}).click();}
   await tools.getByRole('button',{name:t('Close Stats companion'),exact:true}).click();
   if(language==='en'){
    await require('./qa-stats-navigation.cjs')(page,t,'insights');const environment=page.locator('#stats-insights [data-insight-id^="field:6:"]').filter({has:page.getByRole('button',{name:t('Plan a focus comparison'),exact:true})}).first();await environment.getByRole('button',{name:t('Plan a focus comparison'),exact:true}).click();await tools.getByLabel(t('Experiment name'),{exact:true}).waitFor();assert.ok((await tools.getByLabel(t('Experiment change'),{exact:true}).inputValue()).includes('not a recommendation to adopt'));await page.screenshot({path:path.join(output,language+'-focus-proposal.png')});await tools.getByRole('button',{name:t('Close editor'),exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:t('Continue'),exact:true}).click();await tools.getByRole('button',{name:t('Close Stats companion'),exact:true}).click();results.environmentFocusQuestion=true;
   }
   await invoke('settings:set','studyReminderSmartEnabled',true);await page.getByRole('button',{name:t('Settings'),exact:true}).click();const checkbox=page.getByLabel(t('Personal study reminders'),{exact:true});await checkbox.waitFor();assert.ok(await checkbox.isChecked());assert.ok(await checkbox.isEnabled());assert.deepEqual((await invoke('studyReminders:status')).patterns,[]);await checkbox.click();assert.equal((await invoke('settings:getAll')).studyReminderSmartEnabled,false);await page.screenshot({path:path.join(output,language+'-retired-reminder.png')});
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,language:document.documentElement.lang,dir:document.documentElement.dir}));assert.ok(layout.scroll<=layout.width+2);assert.equal(layout.language,language);assert.equal(layout.dir,language==='ar'?'rtl':'ltr');results.languages.push({language,methodsRemainVisible:true,noMethodProposal:true,manualEditor:true,legacyPlanPreserved:true,reminderCanBeTurnedOff:true,layout});
  }
  assert.deepEqual((await invoke('tools:get')).experiments.find(e=>e.id==='legacy-method-plan'),savedLegacy);results.legacyPlanUnchanged=true;
  assert.deepEqual((await invoke('stats:raw')).blocks,history);results.historyUnchanged=true;assert.deepEqual(errors,[]);assert.deepEqual(network,[]);results.rendererErrors=errors;results.observedNetworkRequests=network;
  results.asarSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(exe),'resources/app.asar'))).digest('hex');results.success=true;
 }finally{
  try{if(main){await main.evaluate('setTimeout(()=>qaElectron.app.quit(),100);true');main.close()}if(browser)await browser.close();await delay(900)}catch{if(app&&app.exitCode===null)app.kill()}
  fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2)+'\n');
 }
 console.log('PASS '+JSON.stringify(results));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
