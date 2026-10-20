// Real packaged launcher coverage. Only new, marked fictional profiles are used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/timer-qa.cjs');
const stamp=Date.now(),output=path.resolve('docs/verification/quick-launcher-'+stamp),root='out/qa-temp/quick-launcher-'+stamp;
const themes=fs.readFileSync('src/core/themeSeeds.ts','utf8').split('\n').filter(l=>l.trim().startsWith('{"id"')).map(l=>JSON.parse(l.trim().replace(/,$/,'')));
assert.equal(themes.length,26);
const sizes=[{name:'compact',w:900,h:640},{name:'normal',w:1280,h:820},{name:'maximized'}];
const langs=['en','ar','es','fr','zh-Hans','pt-BR','de'],checks=[],shots=[];let q,stage='start';
const win="qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/out/renderer/index.html'))";
async function appearance(patch){await q.invoke('appearance:set',{...await q.invoke('appearance:get'),...patch});await pause(70)}
async function size(s){await q.main.evaluate(`(()=>{const w=${win};${s.name==='maximized'?'w.maximize()':`w.unmaximize();w.setContentSize(${s.w},${s.h})`};return true})()`);await pause(100)}
async function check(label,options=false){
 await pause(40);
 const r=await q.page.evaluate(()=>{
  const box=e=>e?.getBoundingClientRect().toJSON();const launcher=document.querySelector('.quick-launcher');
  const primary=document.querySelector('.ql-start,.ql-live .ql-actions button');
  return{viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},dir:document.documentElement.dir,zoom:document.documentElement.style.zoom,
   primary:box(primary),card:box(document.querySelector('.ql-card')),frame:box(document.querySelector('.ql-frame')),
   horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1||launcher.scrollWidth>launcher.clientWidth+1,
   internalOverflow:[...document.querySelectorAll('.ql-card,.ql-options-body,.ql-plan-main')].filter(e=>(!e.closest('details')||e.closest('details').open)&&e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({class:e.className,w:e.clientWidth,scroll:e.scrollWidth})),
   controls:[...document.querySelectorAll('.ql-card button,.ql-card input,.ql-card select,.ql-card summary')].filter(e=>e.getClientRects().length).map(e=>({label:e.textContent||e.getAttribute('aria-label'),...box(e)}))};
 });
 assert.equal(r.horizontalOverflow,false,label+' horizontal overflow '+JSON.stringify(r));
 assert.deepEqual(r.internalOverflow,[],label+' internal overflow');
 assert.ok(r.primary&&r.primary.top>=-1&&r.primary.bottom<=r.viewport.h+1&&r.primary.left>=-1&&r.primary.right<=r.viewport.w+1,label+' primary clipped '+JSON.stringify(r));
 for(const c of r.controls)assert.ok(c.width>=24&&c.height>=31,label+' small control '+JSON.stringify(c));
 checks.push({label,options,...r});
}
async function shot(name){await q.page.evaluate(()=>document.activeElement?.blur());await q.page.screenshot({path:path.join(output,name+'.png'),scale:'device'});shots.push(name+'.png')}
async function options(label){const summary=q.page.locator('.ql-options summary');await summary.focus();await q.page.keyboard.press('Enter');assert.equal(await q.page.locator('.ql-options').evaluate(e=>e.open),true);await check(label+'/options',true);await q.page.keyboard.press('Enter');assert.equal(await q.page.locator('.ql-options').evaluate(e=>e.open),false)}
(async()=>{try{
 if(process.argv.includes('--dpi-smoke')){
  for(const deviceScale of [1,1.25,1.5,2]){
   q=await open({root:root+'-dpi-'+deviceScale,output:path.join(output,'dpi-'+deviceScale),deviceScale});await q.page.getByRole('button',{name:'Skip guide',exact:true}).click();await q.invoke('settings:set','studyExperience','quick');
   const c=await q.invoke('library:createCategory',{name:'Fictional DPI tests',color:'#4C989C',icon:null,parentId:null});const i=await q.invoke('library:createItem',{categoryId:c.id,name:'History — a deliberately long subject title for display scaling verification',color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false});await q.invoke('settings:set','lastItemId',i.id);await appearance({uiScale:1});await q.page.reload();await q.page.locator('.ql-start').waitFor();
   for(const s of sizes){await size(s);await check('simulated-dpi/'+deviceScale+'/'+s.name);await options('simulated-dpi/'+deviceScale+'/'+s.name)}
   await q.page.locator('.ql-start').focus();await q.page.keyboard.press('Enter');await q.page.locator('[data-state="running"]').waitFor();for(const s of sizes){await size(s);await check('simulated-dpi-running/'+deviceScale+'/'+s.name)}await q.invoke('session:finish');assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);await q.close();
  }
  fs.writeFileSync(path.join(output,'dpi.json'),JSON.stringify({success:true,checks,simulatedChromiumDisplayScales:[1,1.25,1.5,2],physicalWindowsSettingsChanged:false},null,2));console.log('PASS '+checks.length+' simulated DPI checks; '+output);return;
 }
 q=await open({root,output});await q.page.getByRole('button',{name:'Skip guide',exact:true}).click();await q.invoke('settings:set','studyExperience','quick');
 await q.page.locator('.quick-launcher').waitFor();assert.equal(await q.page.locator('.ql-start').isDisabled(),true);
 const category=await q.invoke('library:createCategory',{name:'Fictional launcher tests',color:'#4C989C',icon:null,parentId:null});const items=[];
 for(const name of ['Biology','التاريخ — مقارنة مصادر متعددة ومراجعة الأدلة والملاحظات ضمن موضوع طويل لاختبار العرض واتجاه الكتابة','History — comparing several sources and revisiting evidence with a deliberately long subject title',...Array.from({length:18},(_,i)=>'Fictional topic '+(i+1))])items.push(await q.invoke('library:createItem',{categoryId:category.id,name,color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false}));
 await q.invoke('settings:set','lastItemId',items[2].id);await q.invoke('settings:set','lastTimerMode','flow');await q.invoke('settings:set','focusTargetMinutes',25);await q.page.reload();await q.page.locator('.ql-start').waitFor();
 stage='idle themes';for(const theme of themes){await appearance({mode:theme.mode,[theme.mode==='light'?'lightTheme':'darkTheme']:theme.id,uiScale:1,roundness:theme.id==='graphite'?0:1});for(const s of sizes){await size(s);await check('idle/'+theme.id+'/'+s.name)}}
 stage='idle languages and scale';for(const language of langs){await q.invoke('settings:set','language',language);await q.invoke('settings:set','lastItemId',items[language==='ar'?1:2].id);await appearance({mode:language==='ar'?'dark':'light',lightTheme:themes.find(t=>t.mode==='light'&&t.isDefault).id,darkTheme:themes.find(t=>t.mode==='dark'&&t.isDefault).id});for(const scale of [.9,1,1.25,1.6]){await appearance({uiScale:scale});for(const s of sizes){await size(s);const label='idle/'+language+'/'+scale+'/'+s.name;await check(label);await options(label);if(scale===1&&['en','ar'].includes(language))await shot(language+'-'+s.name)}}}
 stage='accessibility appearance';await q.invoke('settings:set','language','en');await appearance({uiScale:1,mode:'light',highContrast:true,roundness:2});await size(sizes[0]);await check('app high contrast and roundness');await options('app high contrast and roundness');await appearance({highContrast:false,roundness:1});
 stage='keyboard start';await q.invoke('settings:set','language','en');await appearance({uiScale:1,mode:'light'});await size(sizes[0]);
 await q.page.getByRole('textbox',{name:'Search subjects',exact:true}).fill('Biology');await q.page.keyboard.press('ArrowDown');await q.page.waitForFunction(()=>document.querySelector('.ql-plan .ql-subject')?.textContent==='Biology');await q.page.keyboard.press('Shift+Tab');assert.equal(await q.page.locator('.ql-start').evaluate(e=>e===document.activeElement),true);await q.page.keyboard.press('Enter');await q.page.locator('[data-state="running"]').waitFor();assert.equal((await q.invoke('session:get')).running.itemId,items[0].id);
 stage='running themes';for(const theme of themes){await appearance({mode:theme.mode,[theme.mode==='light'?'lightTheme':'darkTheme']:theme.id});for(const s of sizes){await size(s);await check('running/'+theme.id+'/'+s.name)}}
 stage='running languages and scale';for(const language of langs){await q.invoke('settings:set','language',language);await q.invoke('session:switch',items[language==='ar'?1:2].id);for(const scale of [.9,1,1.25,1.6]){await appearance({uiScale:scale});for(const s of sizes){await size(s);await check('running/'+language+'/'+scale+'/'+s.name);if(language==='ar'&&scale===1)await shot('running-ar-'+s.name)}}}
 stage='main controls';await q.invoke('settings:set','language','en');await appearance({uiScale:1});await size(sizes[0]);
 await q.page.getByRole('button',{name:'Distracted',exact:true}).focus();await q.page.keyboard.press('Enter');await q.page.getByRole('button',{name:'Resume',exact:true}).waitFor();await check('paused');
 await q.page.getByRole('button',{name:'Resume',exact:true}).click();assert.equal(await q.page.getByRole('button',{name:'Next',exact:true}).count(),0);const id=(await q.invoke('session:get')).running.id;
 await q.page.getByRole('button',{name:'Distracted',exact:true}).click();await q.page.getByRole('button',{name:'Break',exact:true}).click();await q.page.locator('[data-state="rest"]').waitFor();for(const s of sizes){await size(s);await check('rest/'+s.name)}
 await q.invoke('rest:endEarly');await check('rest over');await q.page.getByRole('button',{name:'Resume',exact:true}).click();assert.notEqual((await q.invoke('session:get')).running.id,id);
 stage='restart';await q.close();q=await open({root,output:path.join(output,'restart'),restart:true});assert.equal((await q.invoke('settings:getAll')).studyExperience,'quick');assert.ok((await q.invoke('session:get')).recovery);await q.invoke('session:resolveRecovery','continue');await q.page.locator('[data-state="running"]').waitFor();await check('recovered');await q.page.getByRole('button',{name:'Finish',exact:true}).click();await q.page.locator('[data-state="idle"]').waitFor();assert.equal((await q.invoke('session:get')).stage,'idle');
 const raw=await q.snapshot();assert.equal(raw.activity.length,0);for(const b of raw.blocks){assert.equal(b.log_status,'done');assert.equal(b.recall_text,null);assert.equal(b.recall_rating,null)}
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({success:true,checks,shots,themes:themes.map(t=>t.id),languages:langs,scales:[.9,1,1.25,1.6],nativeDisplay:await q.main.evaluate("qaElectron.screen.getPrimaryDisplay().scaleFactor"),scalingNote:'Windows display scale is observed, not changed. Application scaling exercises reflow; physical per-monitor DPI switching remains untested.',errors:q.errors,network:q.network,blocks:raw.blocks.length},null,2));console.log('PASS launcher '+checks.length+' checks; '+output);
}catch(e){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({stage,error:e.stack,checks},null,2));console.error(stage,e);process.exitCode=1}finally{await q?.close()}})();
