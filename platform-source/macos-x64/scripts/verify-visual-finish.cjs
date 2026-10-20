// Actual packaged QA rendering, using only a fresh marked fictional profile.
// No timer values, DOM content or screenshots are altered by this check.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/timer-qa.cjs');
const langs=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const output=path.resolve('docs/verification/visual-finish-'+Date.now());
const root='out/qa-temp/visual-finish-fictional-'+Date.now(),checks=[];let q;
const translated=(lang,key)=>lang==='en'?key:require('../src/core/locales/'+lang+'.json')[key]||key;
async function appearance(patch){await q.invoke('appearance:set',{...await q.invoke('appearance:get'),...patch});await pause(150)}
async function shot(name,page=q.page){await page.screenshot({path:path.join(output,name+'.png'),scale:'device'})}
async function checklist(page,label){
 const input=page.locator('input[type=checkbox]').first();await input.focus();
 const result=await input.evaluate(e=>{
  const area=e.closest('[aria-label]'),r=e.getBoundingClientRect(),a=area.getBoundingClientRect();
  return {height:a.height,content:area.scrollHeight,y:r.y,bottom:r.bottom,header:document.querySelector('header').getBoundingClientRect().bottom,footer:document.querySelector('footer').getBoundingClientRect().top,focused:e===document.activeElement};
 });
 assert.ok(result.height>0&&result.height>=result.content-1,'Collapsed checklist: '+label+JSON.stringify(result));
 assert.ok(result.focused&&result.y>=result.header-1&&result.bottom<=result.footer+1,'Focused checklist must be visible: '+label+JSON.stringify(result));
}
async function footer(page,label){
 const result=await page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
  return {width:innerWidth,height:innerHeight,dir:document.documentElement.dir,heading:document.activeElement?.tagName,
   controls:[...document.querySelectorAll('header button,footer button,footer input')].map(e=>({text:e.textContent||e.getAttribute('aria-label')||e.type,...box(e)})),
   bdi:document.querySelector('header bdi')?.textContent};
 });
 for(const b of result.controls)assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.w<=result.width+1&&b.y+b.h<=result.height+1,label+JSON.stringify(result));
 assert.equal(result.bdi,'Compare two accounts — مقارنة مصدرين');checks.push({label,...result});
}
(async()=>{try{
 q=await open({root,output});await q.invoke('settings:set','starterGuideCompleted',true);
 const skip=q.page.getByRole('button',{name:'Skip guide',exact:true});if(await skip.isVisible())await skip.click();
 const cat=await q.invoke('library:createCategory',{name:'Fictional visual verification',color:'#4C989C',icon:null,parentId:null});
 const item=await q.invoke('library:createItem',{categoryId:cat.id,name:'History — comparing accounts from different sources',color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false});
 await q.invoke('settings:set','preparationEnabled',true);
 for(const lang of langs){
  await q.invoke('settings:set','language',lang);
  for(const mode of ['light','dark'])for(const uiScale of [1,1.25,1.5]){
   await appearance({mode,uiScale});
   await q.invoke('preparation:begin',{itemId:item.id,timerMode:'flow',targetSeconds:60,goal:'Compare two accounts — مقارنة مصدرين'},true);
   for(let i=0;i<80&&!q.context.pages().some(p=>p.url().endsWith('#panel'));i++)await pause(100);
   const p=q.context.pages().find(p=>p.url().endsWith('#panel'));assert.ok(p,'Native preparation page');
   await p.locator('footer button').last().waitFor();await pause(180);
   await footer(p,`Get Ready/${lang}/${mode}/${uiScale}`);
   assert.equal(await p.locator('h1').evaluate(e=>e===document.activeElement),true,'Initial heading focus');
   await checklist(p,`Get Ready/${lang}/${mode}/${uiScale}`);
   await p.locator('.advice-depth summary').first().click();await footer(p,`expanded advice/${lang}/${mode}/${uiScale}`);await checklist(p,`expanded advice/${lang}/${mode}/${uiScale}`);
   await p.locator('footer button').last().focus();assert.equal(await p.locator('footer button').last().evaluate(e=>e===document.activeElement),true);
   if(uiScale===1)await shot('get-ready-'+lang+'-'+mode,p);
   await p.keyboard.press('Escape');await pause(150);assert.equal(await q.invoke('preparation:get'),null);
   assert.equal((await q.invoke('session:get')).running,null,'Preparation cancellation must not start timing');
  }
  await appearance({mode:lang==='ar'?'dark':'light',uiScale:1});
  await q.page.getByRole('button',{name:translated(lang,'Learn'),exact:true}).click();
  await q.page.getByRole('button',{name:translated(lang,'Explore'),exact:true}).click();
  await q.page.locator('[data-idea-card]').first().waitFor();
  assert.equal(await q.page.locator('[data-idea-card]').count(),27);assert.equal(await q.page.locator('[data-strategy-id]').count(),24);
  for(const selector of ['.sp-story svg','.bridge-preview svg']){
   const svg=q.page.locator(selector).first();assert.ok(await svg.count(),selector);
   const size=await svg.boundingBox();assert.ok(size.width>80&&size.height>30,selector+JSON.stringify(size));
   const mirrored=await svg.evaluate(e=>getComputedStyle(e).transform);if(lang==='ar'&&selector.includes('bridge'))assert.ok(mirrored.startsWith('matrix(-1,'),mirrored);
   await svg.scrollIntoViewIfNeeded();await shot('preview-'+lang+'-'+(selector.includes('bridge')?'effort':'spacing'));
  }
  for(const id of ['spacing','difficulty']){
   const card=q.page.locator(`[data-idea-card="${id}"]`);await card.focus();await q.page.keyboard.press('Enter');
   await q.page.locator('[data-learn-idea="'+id+'"]').waitFor();
   assert.equal(await q.page.locator('.learn-idea-heading h2').evaluate(e=>e===document.activeElement),true);
   await shot('lesson-'+lang+'-'+id);
   if(lang==='ar'){await q.page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await shot('forced-colors-'+id);await q.page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'})}
   await q.page.getByRole('button',{name:translated(lang,'Back to Learn'),exact:true}).click();
   assert.equal(await card.evaluate(e=>e===document.activeElement),true,'Return focus');
  }
  checks.push({label:'Learn/'+lang,ideas:27,strategies:24,keyboardFocusRestored:true});
 }
 await q.invoke('settings:set','preparationEnabled',false);await q.invoke('session:start',{itemId:item.id,timerMode:'flow',targetSeconds:60});await q.invoke('settings:set','panelOpen',true);
 const panel=q.context.pages().find(p=>p.url().endsWith('#panel'));await panel.locator('.floating-panel').waitFor();await q.invoke('session:toggleDistracted');
 for(const lang of langs){await q.invoke('settings:set','language',lang);for(const display of ['digital','circular']){
  await appearance({panelTimerDisplay:display,panelSize:'small'});await q.invoke('settings:set','panelExpanded',true);await pause(100);
  const value=panel.locator('.fp-digits,.fr-ring-value').first();const b=await value.boundingBox();const viewport=await panel.evaluate(()=>({w:innerWidth,h:innerHeight}));
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.w+1&&b.y+b.height<=viewport.h+1);await shot('away-'+lang+'-'+display,panel);checks.push({label:'Away/'+lang+'/'+display,value:await value.innerText()});
 }}
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);assert.equal((await q.snapshot()).activity.length,0);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({success:true,checks,errors:q.errors,network:q.network,scope:'Packaged QA; emulated forced colors/reduced motion, not physical Windows or screen-reader certification'},null,2));
 console.log('PASS '+checks.length+' packaged visual/keyboard cases: '+path.relative(process.cwd(),output));
}catch(e){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,checks},null,2));console.error(e);process.exitCode=1}finally{await q?.close()}})();
