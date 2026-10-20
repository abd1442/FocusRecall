// Native packaged/source review. Every mutation is confined to a new marked
// fictional profile; no installed application or ordinary userData is opened.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require(process.env.FOCUSRECALL_PLAYWRIGHT_PATH||'playwright');
const executable=process.env.FOCUSRECALL_QA_EXECUTABLE&&path.resolve(process.env.FOCUSRECALL_QA_EXECUTABLE);
if(executable){assert.ok(executable.startsWith(path.resolve('dist')+path.sep),'Packaged test executable must be inside dist');assert.ok(fs.existsSync(path.join(path.dirname(executable),'QA_BUILD.txt')),'Use a separate QA build for inspector-driven workflows.');}
const root=path.resolve(process.env.FOCUSRECALL_REVIEW_QA_ROOT||'out/qa-temp/product-review-native');
const output=path.resolve(process.env.FOCUSRECALL_REVIEW_QA_OUTPUT||process.env.FOCUSRECALL_REVIEW_OUTPUT||'docs/verification/final-product-review-20261016/runtime');
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep));
assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));
assert.ok(!fs.existsSync(root),'Use a new fictional profile, never an existing profile');
const fixture=path.resolve('out/qa-temp/brand-upgrade-beta24');
assert.equal(fs.readFileSync(path.join(fixture,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');
fs.copyFileSync(path.join(fixture,'learnalyt-demo.db'),path.join(root,'learnalyt-demo.db'));
fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:true}));
if(process.env.FOCUSRECALL_VISUAL_FIXTURE_COUNT!==undefined){assert.equal(process.env.FOCUSRECALL_VISUAL_QA_ONLY,'1');cp.execFileSync('python',[path.resolve('scripts/prepare-visual-fixture.py'),root,process.env.FOCUSRECALL_VISUAL_FIXTURE_COUNT],{stdio:'inherit',windowsHide:true});}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const catalogs=Object.fromEntries(languages.slice(1).map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const text=(l,key)=>catalogs[l]?.[key]||key;
async function inspector(){
  const targets=await fetch('http://127.0.0.1:9471/json/list',{signal:AbortSignal.timeout(1500)}).then(r=>r.json());
  const socket=new WebSocket(targets[0].webSocketDebuggerUrl),pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)};
  const evaluate=async expression=>{const r=await new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
  return {evaluate,close:()=>socket.close()};
}
(async()=>{
  const env={...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
  const started=performance.now(),args=['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9470','--inspect=127.0.0.1:9471'];
  const app=cp.spawn(executable||require('electron'),executable?args:[path.resolve('.'),...args],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe']});
  let diagnostics='',main,browser,success=false;app.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-12000)});
  try{
    for(let i=0;i<100;i++){try{main=await inspector();await fetch('http://127.0.0.1:9470/json/version',{signal:AbortSignal.timeout(1500)});break}catch{main?.close();main=undefined}if(app.exitCode!==null)throw Error('App exited: '+app.exitCode+' '+diagnostics);await delay(300)}
    assert.ok(main,'No native inspector: '+diagnostics);assert.equal(await main.evaluate('process.env.FOCUSRECALL_DATA_DIR'),root);
    await main.evaluate('globalThis.qaElectron=process.getBuiltinModule("module").createRequire(process.execPath)("electron")');
    browser=await chromium.connectOverCDP('http://127.0.0.1:9470');
    const page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/out/renderer/index.html'));assert.ok(page);page.setDefaultTimeout(10000);
    // Electron owns beforeunload through will-prevent-unload. Playwright's
    // automatic beforeunload acceptance races that native cancellation.
    page.on('dialog',dialog=>{if(dialog.type()!=='beforeunload')void dialog.dismiss().catch(()=>{})});
    await page.waitForFunction(()=>!!window.api);
    const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
    const invoke=(channel,...args)=>page.evaluate(([c,a])=>window.api.invoke(c,...a),[channel,args]);
    const results={fixture:root,packaged:page.url().includes('/app.asar/'),executable:executable||'development Electron',readyMs:Math.round(performance.now()-started),version:await main.evaluate('qaElectron.app.getVersion()'),languages:[]};
    if(executable)results.asarSHA256=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(path.dirname(executable),'resources/app.asar'))).digest('hex');
    assert.equal(await invoke('app:demo'),true);assert.equal((await invoke('settings:getAll')).foregroundTrackingEnabled,false);
    for(const [key,value] of Object.entries({starterGuideCompleted:true,minimizeOnStart:false,restMusic:false,studyReminderDailyEnabled:false,studyReminderSmartEnabled:false}))await invoke('settings:set',key,value);
    await invoke('session:endSitting');await invoke('settings:set','language','en');await page.reload();await delay(400);
    const item=(await invoke('library:listPickerItems'))[0];assert.ok(item);
    const names=(await invoke('library:listPickerItems')).map(i=>i.name);
    const before=(await invoke('stats:raw')).blocks.length;
    await main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).setContentSize(1100,820)');
    if(process.env.FOCUSRECALL_VISUAL_QA_ONLY==='1'){
      const visualLanguages=process.env.FOCUSRECALL_VISUAL_LANGUAGE?process.env.FOCUSRECALL_VISUAL_LANGUAGE.split(','):languages;assert.ok(visualLanguages.every(l=>languages.includes(l)));
      for(const language of visualLanguages){await invoke('settings:set','language',language);await delay(100);await require(process.env.FOCUSRECALL_STAGE4_QA==='1'?'./verify-stage4-native.cjs':process.env.FOCUSRECALL_COVERAGE_QA==='1'?'./verify-learn-coverage.cjs':process.env.FOCUSRECALL_STRATEGY_VISUALS_QA==='1'?'./verify-learn-visuals.cjs':process.env.FOCUSRECALL_CONTINUATION_QA==='1'?'./verify-learn-continuation.cjs':process.env.FOCUSRECALL_EXPANSION_QA==='1'?'./verify-learn-expansion.cjs':'./verify-visual-refinement-native.cjs')({page,invoke,main,language,text,output,results,learn:process.env.FOCUSRECALL_VISUAL_FIXTURE_COUNT==='400'});}
      assert.deepEqual(errors,[]);assert.deepEqual(network,[]);results.rendererErrors=errors;results.observedMainPageNetwork=network;fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2));success=true;console.log('PASS visual refinement '+JSON.stringify(results));return;
    }
    for(const language of languages){
      await invoke('settings:set','language',language);await delay(100);
      assert.equal(await page.locator('html').getAttribute('lang'),language);
      assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
      const visits=[];
      if(process.env.FOCUSRECALL_VISUAL_REFINEMENT_QA==='1')await require('./verify-visual-refinement-native.cjs')({page,invoke,main,language,text,output,results});
      if(process.env.FOCUSRECALL_LEARN_STAGE3_QA==='1')await require('./verify-learn-native.cjs')({page,invoke,language,text,output,results});
      for(const tab of ['Home','History','Stats','Library','Settings']){
        await page.getByRole('button',{name:text(language,tab),exact:true}).click();await delay(120);
        const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+2,language+' '+tab+' horizontal overflow');
        visits.push(tab);
        if(['ar','de','zh-Hans'].includes(language))await page.screenshot({path:path.join(output,language+'-'+tab.toLowerCase()+'.png')});
      }
      const settingsPages=page.getByRole('navigation',{name:text(language,'Settings pages'),exact:true});
      await settingsPages.getByRole('button',{name:text(language,'Appearance'),exact:true}).click();
      await page.locator('summary').filter({hasText:text(language,'Fonts')}).click();
      await page.getByRole('heading',{name:text(language,'Fonts'),exact:true}).waitFor();
      await page.getByRole('heading',{name:text(language,'Fonts'),exact:true}).scrollIntoViewIfNeeded();
      for(const label of ['Interface font','Timer font','Writing font'])assert.equal(await page.getByLabel(text(language,label),{exact:true}).count(),1,'Font label missing in '+language);
      const appearanceSize=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,zoom:getComputedStyle(document.documentElement).zoom,wide:[...document.querySelectorAll('input,select,button,label')].filter(el=>el.getBoundingClientRect().right>innerWidth+2||el.getBoundingClientRect().left< -2).slice(0,12).map(el=>({tag:el.tagName,label:el.getAttribute('aria-label'),text:el.textContent.slice(0,50),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))}));
      fs.writeFileSync(path.join(output,language+'-appearance-layout.json'),JSON.stringify(appearanceSize,null,2));
      if(['ar','de','zh-Hans'].includes(language))await page.screenshot({path:path.join(output,language+'-appearance.png')});
      assert.ok(appearanceSize.scroll<=appearanceSize.width+2,'Appearance overflow in '+language+': '+JSON.stringify(appearanceSize));
      await page.getByRole('button',{name:text(language,'Stats'),exact:true}).click();
      if(process.env.FOCUSRECALL_STATS_STAGE1_QA==='1')await require('./verify-scientific-stats-native.cjs')({page,invoke,language,text,output,results});
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'stats',page,browser,invoke,language,text,output,results});
      await page.getByRole('button',{name:text(language,'Experiments'),exact:true}).first().click();
      const workspace=page.locator('#stats-tools');
      await workspace.getByRole('button',{name:text(language,'Plan an experiment'),exact:true}).click();
      const outcomes=workspace.getByLabel(text(language,'Experiment outcome'),{exact:true});
      assert.deepEqual(await outcomes.locator('option').evaluateAll(options=>options.map(o=>o.value)),['focus','recall','understanding','distractionsPerHour','lostShare','longestStretch','length','progressRate'],'Translated outcome IDs in '+language);
      await workspace.getByRole('button',{name:text(language,'Close editor'),exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:text(language,'Continue'),exact:true}).click();
      await workspace.getByRole('button',{name:text(language,'Close Stats companion'),exact:true}).click();
      await require('./qa-stats-navigation.cjs')(page,key=>text(language,key),'report');
      const written=page.locator('[data-stats-section="report"] article.stats-report');
      assert.ok((await written.textContent()).includes(text(language,'What was measured')),'Written report heading missing in '+language);
      if(language!=='en')for(const english of ['What was measured','Main findings','Limits of the data','After each session:'])assert.ok(!(await written.textContent()).includes(english),'English report fallback in '+language+': '+english);
      const markdownPath=path.join(root,language+' report.md');
      await main.evaluate('qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:'+JSON.stringify(markdownPath)+'})');
      await page.locator('[data-stats-section="report"]').getByRole('button',{name:text(language,'Markdown'),exact:true}).click();
      for(let i=0;i<100&&!fs.existsSync(markdownPath);i++)await delay(50);
      assert.ok(fs.readFileSync(markdownPath,'utf8').includes(text(language,'What was measured')),'Markdown export not localized in '+language);
      await invoke('preparation:begin',{itemId:item.id,timerMode:'flow',targetSeconds:1500,goal:'Fictional goal عربي 中文'});
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'prepare',page,browser,invoke,language,text,output,results});
      assert.equal((await invoke('session:get')).stage,'idle');
      await invoke('preparation:confirm');await delay(1100);assert.equal((await invoke('session:get')).stage,'focus');
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'focus',page,browser,invoke,language,text,output,results});
      let unrelated;
      if(language==='en'){
        const blockId=(await invoke('session:get')).running.id;
        unrelated={id:'independent-session-note',itemId:item.id,blockId,title:'Independent note',text:'This must never seed or be overwritten by recall',strokes:[],image:null,destination:{kind:'none',vaultPath:'',vaultName:'',file:'',page:'',heading:'',parentBlock:'',placement:'inside'}};
        await invoke('notes:save',unrelated,false);
      }
      await invoke('session:distracted');await delay(60);await invoke('session:back');
      await invoke('session:finish');await delay(100);
      const keep=page.getByRole('button',{name:text(language,'Keep it'),exact:true});if(await keep.count())await keep.click();
      if(language==='en'){
        await page.getByRole('button',{name:'Type notes',exact:true}).click();
        assert.equal(await page.locator('textarea').first().inputValue(),'','Independent note leaked into recall');
        await page.getByRole('button',{name:'Obsidian / save note',exact:true}).click();
        const editor=page.getByRole('dialog');await editor.getByLabel('Study note text',{exact:true}).fill('Fictional unsaved note عربي 中文');
        await main.evaluate('qaElectron.dialog.showMessageBox=async(...args)=>{globalThis.qaNotePrompt=args.at(-1);return {response:0}};qaElectron.app.quit();true');
        await delay(500);assert.equal(page.isClosed(),false);
        assert.equal(await editor.getByLabel('Study note text',{exact:true}).inputValue(),'Fictional unsaved note عربي 中文');
        assert.equal(await main.evaluate('qaNotePrompt.message'),'Quit without saving note changes?');
        await editor.getByRole('button',{name:'Save in FocusRecall',exact:true}).click();
        await editor.getByText('Saved in FocusRecall.',{exact:true}).waitFor();
        await editor.getByRole('button',{name:'Close',exact:true}).click();
        assert.equal((await invoke('notes:list',item.id,unrelated.blockId)).find(n=>n.id===unrelated.id).text,unrelated.text);
        results.recallKeepsIndependentNotes=true;results.unsavedNoteQuitVeto=true;
        results.quitPromptScope='Native app quit and renderer veto exercised; native message-box response stubbed to Keep editing.';
      }
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'recall',page,browser,invoke,language,text,output,results});
      await invoke('session:completeRecall');
      const state=await invoke('session:get');await invoke('session:submitLog',state.finished.map(b=>({blockId:b.id,values:{},notes:{}})));
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'rest',page,browser,invoke,language,text,output,results});
      await invoke('rest:start',60);
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'running-rest',page,browser,invoke,language,text,output,results});
      await invoke('rest:endEarly');await invoke('rest:finish','Fictional rest');
      if(process.env.FOCUSRECALL_ADVICE_STAGE2_QA==='1')await require('./verify-advice-native.cjs')({phase:'return',page,browser,invoke,language,text,output,results});
      await invoke('session:endSitting');
      assert.equal((await invoke('session:get')).stage,'idle');assert.deepEqual((await invoke('library:listPickerItems')).map(i=>i.name),names);
      results.languages.push({language,tabs:visits,workflow:true,direction:true,noDocumentOverflow:true,privateNamesPreserved:true,appearanceLabels:true,writtenReport:true,realMarkdownExport:true});
    }
    assert.equal((await invoke('stats:raw')).blocks.length,before+7);
    const preferences=await main.evaluate('qaElectron.BrowserWindow.getAllWindows().map(w=>{const p=w.webContents.getLastWebPreferences();return {sandbox:p.sandbox,isolation:p.contextIsolation,node:p.nodeIntegration}})');
    assert.ok(preferences.every(p=>p.sandbox&&p.isolation&&!p.node));assert.equal(await page.evaluate('typeof process'),'undefined');results.rendererIsolation=preferences;
    assert.equal(await page.evaluate(()=>window.api.invoke('shell:open','file:///C:/fictional.exe').then(()=>false,()=>true)),true);
    const panel=browser.contexts()[0].pages().find(p=>p.url().endsWith('#panel'));assert.ok(panel);
    assert.equal(await panel.evaluate(()=>window.api.invoke('backup:openFolder').then(()=>false,()=>true)),true);results.ipcCapabilityBoundary=true;
    const note={id:'product-review-note',itemId:item.id,blockId:null,title:'Private title عربي 中文',text:'Fictional note — سلام 中文 <script>not markup</script>',strokes:[],image:null,destination:{kind:'none',vaultPath:'',vaultName:'',file:'',page:'',heading:'',parentBlock:'',placement:'inside'}};
    await invoke('notes:save',note,false);assert.equal((await invoke('notes:list',item.id)).find(n=>n.id===note.id).text,note.text);results.noteRoundTrip=true;
    const backup=path.join(root,'review-backup.db');
    await main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(backup)}})`);
    await invoke('backup:create');assert.ok(fs.statSync(backup).size>512);
    await main.evaluate(`qaElectron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(backup)}]})`);
    assert.ok((await invoke('backup:inspectRestore')).token);results.snapshotAndRestoreValidation=true;
    await invoke('settings:set','language','ar');await page.getByRole('button',{name:text('ar','Stats'),exact:true}).click();await delay(250);
    await require('./qa-stats-navigation.cjs')(page,key=>text('ar',key),'report');
    const report=page.locator('[data-stats-section="report"]');
    assert.equal(await report.locator('[data-report="visual"] .tabular-nums').first().evaluate(el=>getComputedStyle(el).direction),'ltr','Numeric report values must preserve unit order in RTL');
    const comparisonTracks=report.locator('.finding-comparison-track i');
    if(await comparisonTracks.count())assert.ok(await comparisonTracks.evaluateAll(elements=>elements.every(el=>Number.isFinite(parseFloat(el.style.width))&&parseFloat(el.style.width)>=0&&parseFloat(el.style.width)<=100)),'Comparison widths must use finite canonical values');
    results.directlyLabelledComparisons=await comparisonTracks.count();
    results.numericDirections=true;
    const png=path.join(root,'Arabic study report.png'),pdf=path.join(root,'Arabic study report.pdf');
    await main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(png)}})`);
    await report.getByRole('button',{name:text('ar','Export image (PNG)'),exact:true}).click();
    for(let i=0;i<100&&!fs.existsSync(png);i++)await delay(100);
    assert.ok(fs.existsSync(png),'Report image did not export');assert.equal(fs.readFileSync(png).subarray(1,4).toString(),'PNG');
    await report.getByRole('button',{name:text('ar','Export image (PNG)'),exact:true}).waitFor({state:'visible'});
    await main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(pdf)}})`);
    await report.locator('summary').filter({hasText:text('ar','Other formats')}).click();
    await report.getByRole('button',{name:text('ar','Export PDF'),exact:true}).click();
    for(let i=0;i<100&&!fs.existsSync(pdf);i++)await delay(100);
    assert.ok(fs.existsSync(pdf),'Report PDF did not export');assert.equal(fs.readFileSync(pdf).subarray(0,4).toString(),'%PDF');
    results.realReportExports={language:'ar',pngBytes:fs.statSync(png).size,pdfBytes:fs.statSync(pdf).size,nativePickerStubbed:true};
    const mediaScript=fs.readFileSync('src/main/music.ts','utf8').match(/String\.raw`([\s\S]*?)`/)[1].replace('<ARITY>',String.fromCharCode(96));
    results.nativeSpotifyStatus=await main.evaluate(`(async()=>{const cp=process.getBuiltinModule('child_process'),path=process.getBuiltinModule('path');return await new Promise(resolve=>cp.execFile(path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',${JSON.stringify(mediaScript)}],{windowsHide:true,timeout:15000,env:{...process.env,FOCUSRECALL_MEDIA_ACTION:'status',FOCUSRECALL_MEDIA_ID:'',FOCUSRECALL_MEDIA_WAIT:'0'}},(error,stdout)=>{try{resolve(error?{error:error.message}:JSON.parse(stdout.trim()))}catch{resolve({error:'Invalid native response'})}}))})()`);
    results.spotifyScope='Native status only; no playback command, metadata, credentials or other media-player control.';
    results.metrics=await main.evaluate('qaElectron.app.getAppMetrics().map(p=>({type:p.type,workingSetKB:p.memory.workingSetSize,cpuPercent:p.cpu.percentCPUUsage}))');
    results.navigationMetrics=[];
    for(let i=0;i<6;i++){
      await page.getByRole('button',{name:text('ar',i%2?'Stats':'Home'),exact:true}).click();await delay(1000);
      results.navigationMetrics.push(await main.evaluate('qaElectron.app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,workingSetKB:p.memory.workingSetSize,cpuPercent:p.cpu.percentCPUUsage}))'));
    }
    results.metricsScope='Six short navigation samples after a baseline. CPU uses intervals between calls. Not a multi-hour leak, cold-start benchmark or sleep/wake certification.';
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);results.rendererErrors=errors;results.observedMainPageNetwork=network;
    fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2)+'\n');success=true;console.log('PASS '+JSON.stringify(results));
    if(process.env.FOCUSRECALL_QA_KEEP_OPEN==='1'){
      await main.evaluate('(()=>{const w=qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html"));w.restore();w.show();w.focus();w.setTitle("FocusRecall — fictional QA");return true})()');
      await delay(45000);
    }
  } finally {
    if(main){try{await main.evaluate('setTimeout(()=>qaElectron.app.quit(),100);true');await delay(300)}finally{main.close()}}
    if(browser)await browser.close();if(!success&&app.exitCode===null)app.kill();
    await Promise.race([new Promise(resolve=>app.once('exit',resolve)),delay(1200)]);
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1});
