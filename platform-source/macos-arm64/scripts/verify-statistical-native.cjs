// Actual packaged Windows UI, isolated fictional profiles. Never launches an installed app.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.FOCUSRECALL_PLAYWRIGHT_PATH||'playwright');
const exe=path.resolve('dist/statistical-validity-20261017/win-unpacked/FocusRecall.exe');
const [rootArg,outputArg,scenario]=process.argv.slice(2),root=path.resolve(rootArg),output=path.resolve(outputArg);
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep));assert.ok(!fs.existsSync(root),'Use a NEW fictional profile');
assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));assert.ok(['known','null'].includes(scenario));
const fixture=path.resolve('out/qa-temp/brand-upgrade-beta24');assert.equal(fs.readFileSync(path.join(fixture,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');
fs.copyFileSync(path.join(fixture,'learnalyt-demo.db'),path.join(root,'learnalyt-demo.db'));fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:true}));
cp.execFileSync('python',[path.resolve('scripts/prepare-statistical-fixture.py'),root,scenario],{stdio:'inherit',windowsHide:true});
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
  for(const language of languages){
   const t=k=>text(language,k);await invoke('settings:set','language',language);await delay(150);await page.getByRole('button',{name:t('Stats'),exact:true}).click();
   const filters=page.getByRole('button',{name:t('Adjust filters'),exact:true});await filters.click();await page.getByLabel(t('Dates'),{exact:true}).selectOption('all');await page.getByRole('button',{name:t('Close filters'),exact:true}).click();
   await require('./qa-stats-navigation.cjs')(page,t,'factors');const factors=page.locator('#stats-factors');await factors.getByLabel(t('Question'),{exact:true}).selectOption('field:6');
   const evidence=factors.locator('details').filter({has:page.locator('summary').filter({hasText:t('Evidence')})}).first();await evidence.locator('summary').click();
   const content=await evidence.innerText();assert.ok(content.includes(t('Nearby days are grouped into two-week blocks. Different blocks may still be dependent; this is an approximate model.')));
   assert.ok(content.includes(t('These are self-ratings, not measured retention or mastery.')));assert.ok(content.includes(t('Changing filters or repeatedly checking new dates is not covered by this search correction.')));
   assert.ok(await factors.getByLabel(t(scenario==='known'?'Exploratory association':'Recorded comparison'),{exact:true}).count(),'Comparison evidence badge');
   await evidence.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,language+'-comparison.png')});
   await require('./qa-stats-navigation.cjs')(page,t,'insights');const insights=await page.locator('#stats-insights').innerText();
   if(scenario==='known')assert.ok(insights.includes(t('Exploratory association')));else assert.ok(!insights.includes(t('Exploratory association')));
   await page.locator('#stats-insights').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,language+'-insights.png')});
   if(scenario==='known'){
    const shared=page.locator('#stats-insights [data-shared-evidence="true"]').first();await shared.getByRole('button',{name:t('How was this determined?'),exact:true}).click();const method=page.getByRole('dialog').locator('[data-shared-evidence-details]');await method.waitFor();assert.ok((await method.innerText()).includes(t('Sessions are averaged within each subject, activity and study day. Shared contexts are weighted by their smaller number of days.')));await page.screenshot({path:path.join(output,language+'-method.png')});await page.getByRole('dialog').getByRole('button',{name:t('Done'),exact:true}).click();
   }
   if(language==='en'&&scenario==='known'){
    const card=page.locator('#stats-insights [data-shared-evidence="true"]').first();await card.getByRole('button',{name:'Save finding',exact:true}).click();
    const saved=(await invoke('tools:get')).discoveries.find(d=>d.snapshot.question);assert.ok(saved);assert.equal(saved.snapshot.question.algorithmVersion,'matched-context-blocks-v2');
    const old={...saved,snapshot:{...saved.snapshot,question:{...saved.snapshot.question,algorithmVersion:'matched-context-days-v1'}}};await invoke('tools:saveDiscovery',old);
    await page.getByRole('button').filter({hasText:'Saved findings ('}).click();const dialog=page.getByRole('dialog');
    assert.ok((await dialog.innerText()).includes('Analysis method changed; save the question again'));assert.equal((await invoke('tools:get')).discoveries.find(d=>d.key===saved.key).snapshot.title,saved.snapshot.title);
    await dialog.getByRole('button',{name:'Close Saved findings',exact:true}).click();await invoke('tools:saveDiscovery',saved);results.savedQuestionCompatibility=true;
   }
   await page.getByRole('button',{name:t('Saved views'),exact:true}).first().click();const tools=page.locator('#stats-tools');const newView=tools.getByRole('button',{name:t('New view'),exact:true});if(await newView.isVisible())await newView.click();await tools.getByLabel(t('Comparison view name'),{exact:true}).fill('Fictional statistical QA '+language);await tools.getByRole('button',{name:t('Save current view'),exact:true}).click();await delay(200);
   assert.ok((await tools.innerText()).includes(t(scenario==='known'?'Exploratory association':'No screened association in this view. Descriptive comparisons remain available.')));if(scenario==='known')await tools.locator('summary').filter({hasText:t('Evidence')}).click();await page.screenshot({path:path.join(output,language+'-saved-view.png')});await tools.getByRole('button',{name:t('Close Stats companion'),exact:true}).click();
   await require('./qa-stats-navigation.cjs')(page,t,'report');const report=page.locator('article.stats-report');if(!await report.isVisible())await page.locator('#stats-report summary').filter({hasText:t('Written report / archive')}).click();await report.waitFor();const reportText=await report.innerText();
   assert.ok(reportText.includes(t('Matching does not remove unrecorded confounding. A screened association is not an established conclusion or proof of benefit.')));if(scenario==='null')assert.ok(!reportText.includes(t('Exploratory association')));
   fs.writeFileSync(path.join(output,language+'-report.txt'),reportText);await page.screenshot({path:path.join(output,language+'-report.png')});
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,language:document.documentElement.lang,dir:document.documentElement.dir}));assert.ok(layout.scroll<=layout.width+2);assert.equal(layout.language,language);assert.equal(layout.dir,language==='ar'?'rtl':'ltr');results.languages.push({language,selectedComparison:true,insights:true,savedView:true,report:true,layout});
  }
  assert.deepEqual((await invoke('stats:raw')).blocks,history);results.historyUnchanged=true;assert.deepEqual(errors,[]);assert.deepEqual(network,[]);results.rendererErrors=errors;results.observedNetworkRequests=network;
  results.asarSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(exe),'resources/app.asar'))).digest('hex');results.success=true;
 }finally{
  try{if(main){await main.evaluate('setTimeout(()=>qaElectron.app.quit(),100);true');main.close()}if(browser)await browser.close();await delay(900)}catch{if(app&&app.exitCode===null)app.kill()}
  fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2)+'\n');
 }
 console.log('PASS '+JSON.stringify(results));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
