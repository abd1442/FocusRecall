// Packaged Quick/Full acceptance using only a fresh, marked fictional profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/timer-qa.cjs');
const output=path.resolve('docs/verification/quick-mode-'+Date.now()),root='out/qa-temp/quick-mode-fictional-'+Date.now();
let q,p,stage='welcome';const checks=[],shots=[];
async function shot(name,page=p){await page.screenshot({path:path.join(output,name+'.png'),scale:'device'});shots.push(name+'.png')}
async function appearance(patch){await q.invoke('appearance:set',{...await q.invoke('appearance:get'),...patch});await pause(70)}
async function matrix(name){for(const language of ['en','ar','es','fr','zh-Hans','pt-BR','de']){
 await q.invoke('settings:set','language',language);await pause(80);
 const translated=key=>language==='en'?key:require('../src/core/locales/'+language+'.json')[key];
 if(name==='Rest'||name==='Rest complete')assert.equal(await p.locator('.fp-subject').innerText(),translated('Break'));
 if(name==='Rest complete')assert.ok((await p.locator('.floating-panel').innerText()).includes(translated('Break over')));
 if(name==='Paused'){
  assert.equal(await p.locator('.fp-btn-primary').innerText(),translated('Resume'));
  assert.equal(await p.getByRole('button',{name:translated('Break'),exact:true}).evaluate(e=>e.classList.contains('fp-btn-primary')),false);
 }
 if(name==='Focus')assert.equal(await p.locator('.fp-switch svg').count(),1);
 for(const panelSize of ['small','medium','large'])for(const panelTimerDisplay of ['digital','circular'])for(const expanded of [false,true]){
  await appearance({panelSize,panelTimerDisplay});await q.invoke('settings:set','panelExpanded',expanded);await pause(60);
  const result=await p.evaluate(()=>({w:innerWidth,h:innerHeight,buttons:[...document.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent||e.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height}}),ring:document.querySelector('.fr-ring')?.getBoundingClientRect().toJSON()}));
  for(const b of result.buttons)assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.w<=result.w+1&&b.y+b.h<=result.h+1,name+language+JSON.stringify(result));
  if(result.ring)assert.ok(Math.abs(result.ring.x+result.ring.width/2-result.w/2)<2);
  checks.push({state:name,language,panelSize,panelTimerDisplay,expanded});
 }}console.log(name+': 84 layouts passed')}
async function english(){await q.invoke('settings:set','language','en');await appearance({panelSize:'medium',panelTimerDisplay:'digital'});await q.invoke('settings:set','panelExpanded',true)}
(async()=>{try{
 q=await open({root,output});
 await q.page.getByRole('dialog').waitFor();assert.equal((await q.invoke('settings:getAll')).studyExperience,'full');
 if(process.argv.includes('--onboarding-only')){
  for(const language of ['en','ar','es','fr','zh-Hans','pt-BR','de']){
   await q.invoke('settings:set','language',language);await appearance({mode:language==='ar'?'dark':'light',uiScale:1.5});
   const quick=q.page.locator('input[name="study-experience"][value="quick"]'),full=q.page.locator('input[name="study-experience"][value="full"]');
   await quick.focus();await q.page.keyboard.press('Space');assert.equal((await q.invoke('settings:getAll')).studyExperience,'quick');
   await full.focus();await q.page.keyboard.press('Space');assert.equal((await q.invoke('settings:getAll')).studyExperience,'full');
   assert.equal((await q.invoke('settings:getAll')).foregroundTrackingEnabled,false);await shot('setup-'+language,q.page);checks.push({language,keyboardModes:true,uiScale:1.5,trackingOff:true});
  }
  await q.invoke('settings:set','language','ar');await q.page.locator('input[name="study-experience"][value="quick"]').check();
  await q.page.getByRole('button',{name:require('../src/core/locales/ar.json')['Start studying'],exact:true}).click();await q.page.getByRole('dialog').waitFor({state:'hidden'});
  const category=await q.invoke('library:createCategory',{name:'دراسة خيالية',color:'#4C989C',icon:null,parentId:null});
  const item=await q.invoke('library:createItem',{categoryId:category.id,name:'التاريخ — مقارنة روايتين من مصادر مختلفة',color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false});
  await appearance({mode:'dark',panelSize:'medium',panelTimerDisplay:'circular'});await q.invoke('settings:set','panelExpanded',true);await q.invoke('session:start',{itemId:item.id,timerMode:'flow',targetSeconds:60});
  for(let i=0;i<80&&!q.context.pages().some(p=>p.url().endsWith('#panel'));i++)await pause(100);p=q.context.pages().find(p=>p.url().endsWith('#panel'));await p.locator('.floating-panel').waitFor();await pause(1300);await shot('quick-arabic-circular');
  await q.invoke('session:toggleDistracted');await shot('quick-arabic-paused');await q.invoke('session:finish');
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);assert.equal((await q.snapshot()).activity.length,0);fs.writeFileSync(path.join(output,'onboarding.json'),JSON.stringify({success:true,checks,shots,arabicTimer:true},null,2));console.log('PASS seven-language keyboard onboarding choices and Arabic timer');return;
 }
 assert.equal(await q.page.locator('input[name="study-experience"][value="full"]').isChecked(),true);await shot('setup-full-default',q.page);
 await q.page.locator('input[name="study-experience"][value="quick"]').check();await q.page.getByRole('button',{name:'Start studying',exact:true}).waitFor();assert.equal(await q.page.getByRole('button',{name:'Skip guide',exact:true}).count(),0);await shot('setup-quick',q.page);
 await q.page.getByRole('button',{name:'Start studying',exact:true}).focus();await q.page.keyboard.press('Enter');await q.page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal((await q.invoke('settings:getAll')).studyExperience,'quick');assert.equal((await q.invoke('settings:getAll')).foregroundTrackingEnabled,false);
 const cat=await q.invoke('library:createCategory',{name:'Fictional Quick checks',color:'#4C989C',icon:null,parentId:null});const items=[];
 for(const name of ['Biology','History — comparing accounts from several different sources'])items.push(await q.invoke('library:createItem',{categoryId:cat.id,name,color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false}));
 await q.invoke('settings:set','lastItemId',items[1].id);await q.invoke('settings:set','focusTargetMinutes',1);await q.invoke('settings:set','preparationEnabled',true);await q.invoke('settings:set','panelAutoShow',false);await appearance({mode:'light'});
 // Fixtures created through main IPC need the ordinary renderer store reload.
 await q.page.reload();await q.page.getByRole('heading',{name:'Quick Mode',exact:true}).waitFor();await shot('quick-launcher',q.page);
 stage='focus';await q.page.getByRole('button',{name:'Start',exact:true}).click();
 for(let i=0;i<100&&!q.context.pages().some(p=>p.url().endsWith('#panel'));i++)await pause(100);p=q.context.pages().find(p=>p.url().endsWith('#panel'));await p.locator('.floating-panel').waitFor();assert.equal(await q.invoke('preparation:get'),null);assert.ok((await q.invoke('session:get')).running);await pause(2200);await shot('quick-digital-light');await appearance({mode:'dark',panelTimerDisplay:'circular'});await shot('quick-circular-dark');
 await matrix('Focus');await english();
 await q.page.getByRole('button',{name:'Settings',exact:true}).click();await q.page.locator('input[name="study-experience"]').first().waitFor();assert.equal(await q.page.locator('input[name="study-experience"]').first().isDisabled(),true);
 await assert.rejects(()=>q.invoke('settings:set','studyExperience','full'),/Finish the current study step/);
 await p.getByRole('button',{name:'Switch subject; the session goes on',exact:true}).click();await q.page.getByRole('dialog').waitFor();assert.equal(await q.page.getByRole('button',{name:'Finish this subject first',exact:true}).count(),0);
 const sessionBefore=(await q.invoke('session:get')).running.sessionId;await q.page.getByRole('dialog').getByRole('option').filter({hasText:'Biology'}).click();await q.page.getByRole('button',{name:'Switch now',exact:true}).focus();await q.page.keyboard.press('Enter');await q.page.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await q.invoke('session:get')).running.itemId,items[0].id);assert.equal((await q.invoke('session:get')).running.sessionId,sessionBefore);await pause(200);await shot('quick-switched-short-title');
 stage='pause';await p.getByRole('button',{name:'Distracted',exact:true}).click();const before=await p.locator('.fp-digits').innerText();await pause(1600);assert.equal(await p.locator('.fp-digits').innerText(),before);await shot('quick-paused');await matrix('Paused');await english();
 stage='break';await p.getByRole('button',{name:'Resume',exact:true}).click();assert.equal((await q.invoke('session:get')).running.pauses.some(p=>p.endedAt===null),false);await p.getByRole('button',{name:'Distracted',exact:true}).click();await p.getByRole('button',{name:'Break',exact:true}).click();assert.equal((await q.invoke('session:get')).rest.phase,'running');assert.equal((await q.invoke('session:get')).step,null);await appearance({panelTimerDisplay:'circular'});await shot('quick-break');await matrix('Rest');await q.invoke('rest:endEarly');await matrix('Rest complete');await english();await shot('quick-break-over');await p.getByRole('button',{name:'Resume',exact:true}).click();assert.ok((await q.invoke('session:get')).running);
 stage='next';await pause(1200);await p.getByRole('button',{name:'Switch subject; the session goes on',exact:true}).click();await q.page.getByRole('dialog').waitFor();const old=(await q.invoke('session:get')).running.id;assert.equal(await p.getByRole('button',{name:'Next',exact:true}).count(),0);await q.invoke('session:quickAction','next',old);const current=(await q.invoke('session:get')).running.id;assert.notEqual(current,old);await q.page.getByRole('dialog').waitFor({state:'hidden'});await q.invoke('session:quickAction','next',old);assert.equal((await q.invoke('session:get')).running.id,current);await shot('quick-next');
 stage='recovery';assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);await q.close();q=await open({root,output:path.join(output,'restart'),restart:true});assert.equal((await q.invoke('settings:getAll')).studyExperience,'quick');assert.ok((await q.invoke('session:get')).recovery);await shot('quick-recovery',q.page);await q.invoke('session:resolveRecovery','continue');await q.invoke('settings:set','panelOpen',true);p=q.context.pages().find(p=>p.url().endsWith('#panel'));await p.locator('.floating-panel').waitFor();await english();await pause(1100);await p.getByRole('button',{name:'Finish',exact:true}).click();assert.equal((await q.invoke('session:get')).stage,'idle');assert.equal((await q.invoke('session:get')).sitting,null);assert.deepEqual((await q.invoke('session:get')).unfinished,[]);await matrix('Ready');await english();await shot('quick-saved-ready');
 const raw=await q.snapshot();assert.equal(raw.blocks.length,4);assert.equal(raw.activity.length,0);for(const block of raw.blocks){assert.equal(block.log_status,'done');assert.equal(block.recall_text,null);assert.equal(block.recall_seconds,null);assert.equal(block.recall_rating,null)}
 assert.equal(await q.main.evaluate('qaDb.prepare("SELECT COUNT(*) n FROM block_log_values").get().n'),0);assert.ok((await q.main.evaluate('qaDb.prepare("SELECT kind FROM distractions").all()')).some(d=>d.kind==='timer-pause'));
 stage='backup';const backup=path.join(q.root,'fictional-quick-backup.db');
 await q.main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(backup)}});true`);
 assert.ok(await q.invoke('backup:create'));
 const saved=await q.main.evaluate(`(()=>{const b=new(qaRequire('better-sqlite3'))(${JSON.stringify(backup)},{readonly:true,fileMustExist:true});try{return{integrity:b.pragma('integrity_check',{simple:true}),blocks:b.prepare('SELECT * FROM blocks ORDER BY id').all(),experience:JSON.parse(b.prepare("SELECT value FROM settings WHERE key='studyExperience'").get().value)}}finally{b.close()}})()`);
 assert.equal(saved.integrity,'ok');assert.equal(saved.experience,'quick');assert.deepEqual(saved.blocks,raw.blocks);
 stage='full';await q.invoke('settings:set','studyExperience','full');await q.invoke('settings:set','preparationEnabled',true);await q.invoke('preparation:begin',{itemId:items[0].id,timerMode:'flow',targetSeconds:60},true);assert.ok(await q.invoke('preparation:get'));await q.invoke('preparation:cancel');await q.invoke('session:start',{itemId:items[0].id,timerMode:'flow',targetSeconds:60});await pause(1100);await q.invoke('session:finish');assert.equal((await q.invoke('session:get')).stage,'recall');assert.equal((await q.invoke('session:get')).step,'recall');assert.deepEqual((await q.snapshot()).blocks.slice(0,raw.blocks.length),raw.blocks);
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({success:true,checks,shots,quickBlocks:raw.blocks,errors:q.errors,network:q.network,fullModePreserved:true},null,2));console.log('PASS '+checks.length+' Quick layouts, first setup, persisted choices, real cycles, restart/recovery and Full Mode preservation');
}catch(e){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({stage,error:e.stack,checks},null,2));console.error(stage,e);process.exitCode=1}finally{await q?.close()}})();
