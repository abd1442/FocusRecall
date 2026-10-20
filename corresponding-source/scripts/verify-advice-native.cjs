// Called only by the existing guarded fictional-profile packaged harness.
const assert=require('node:assert/strict'),path=require('node:path');
const copy=require('../src/core/adviceCopy.json');
module.exports=async({phase,page,browser,invoke,language,text,output,results})=>{
 const t=key=>text(language,key),record={language,phase};results.advice??=[];
 if(phase==='focus'){
   assert.equal(await invoke('advice:choose','prepare','any',true),null);
   assert.equal(await page.locator('[data-advice-id]').count(),0);record.silent=true;results.advice.push(record);return;
 }
 if(phase==='running-rest'){
   await page.locator('[data-advice-id]').waitFor({state:'detached'});record.silent=true;results.advice.push(record);return;
 }
 if(phase==='stats'){
   await require('./qa-stats-navigation.cjs')(page,t,'insights');await page.locator('#stats-insights > details.stats-methodology > summary').click();await invoke('advice:reset');await page.getByRole('button',{name:t('General study strategies'),exact:true}).click();
 }
 let target=page;
 if(phase==='prepare'){
   for(let i=0;i<40;i++){target=browser.contexts()[0].pages().find(p=>p.url().endsWith('#panel'));if(target)break;await new Promise(r=>setTimeout(r,50))}
   assert.ok(target,'Preparation panel missing');
 }
 const card=target.locator('[data-advice-id]');await card.waitFor();
 await target.waitForFunction(()=>!!document.querySelector('[data-advice-id]')?.getAttribute('data-advice-id'));
 const initial=await card.getAttribute('data-advice-id');assert.ok(copy[initial]);
 assert.ok((await card.innerText()).includes(copy[initial][language].action),'Advice not localized: '+language+phase);
 assert.equal(await target.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
 const purpose=phase==='stats'?'remember':phase==='rest'?'any':'practice';
 await card.locator('select').selectOption(purpose);
 await card.getByRole('button',{name:t('Another suggestion'),exact:true}).click({trial:true});
 await target.waitForFunction(()=>!!document.querySelector('[data-advice-id]')?.getAttribute('data-advice-id'));
 const selected=await card.getAttribute('data-advice-id');
 await card.locator('summary').filter({hasText:t('Why and when')}).click();
 assert.ok((await card.innerText()).includes(copy[selected][language].detail));
 record.concept=selected;record.localizedActionAndQualifications=true;
 if(['ar','de','zh-Hans','en'].includes(language))await target.screenshot({path:path.join(output,language+'-advice-'+phase+'.png')});
 const size=await target.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+2);record.noHorizontalOverflow=true;
 if(phase==='stats'){
   // Real controls, persisted across a renderer restart. Source links are not
   // followed: the check must remain offline and must not open user browsers.
   await card.locator('summary').filter({hasText:t('Suggestion controls')}).click();
   await card.getByRole('button',{name:t('Reset study suggestions'),exact:true}).click();
   await card.getByRole('button',{name:t('Another suggestion'),exact:true}).waitFor();
   const first=await card.getAttribute('data-advice-id');
   await card.getByRole('button',{name:t('Another suggestion'),exact:true}).click();
   await target.waitForFunction(id=>document.querySelector('[data-advice-id]')?.getAttribute('data-advice-id')!==id,first);
   await card.getByRole('button',{name:t('Less of this topic'),exact:true}).click();
   await card.locator('select').selectOption('any');
   await page.reload();await page.getByRole('button',{name:t('Stats'),exact:true}).click();
   await page.locator('#stats-insights > details.stats-methodology > summary').click();await page.getByRole('button',{name:t('General study strategies'),exact:true}).click();
   await page.locator('[data-advice-id]').waitFor();
   const persisted=await invoke('advice:choose','stats','any',false);assert.equal(await page.locator('[data-advice-id]').getAttribute('data-advice-id'),persisted??'');
   record.rotationAndTopicControls=true;record.rendererReloadPersistence=true;
 }
 if(phase==='recall'){
   const type=page.getByRole('button',{name:t('Type notes'),exact:true});await type.click();
   const editor=page.locator('textarea').first();await editor.fill('Fictional Stage 2 draft عربي 中文');
   const other=language==='en'?'ar':'en';await invoke('settings:set','language',other);
   await page.waitForFunction(l=>document.documentElement.lang===l,other);
   assert.equal(await editor.inputValue(),'Fictional Stage 2 draft عربي 中文');
   assert.equal(await card.getAttribute('data-advice-id'),selected);
   assert.ok((await card.innerText()).includes(copy[selected][other].action));
   await invoke('settings:set','language',language);await page.waitForFunction(l=>document.documentElement.lang===l,language);
   assert.equal(await editor.inputValue(),'Fictional Stage 2 draft عربي 中文');record.languageSwitchPreservesDraftAndConcept=true;
 }
 if(phase==='return'){
   await page.getByText(t('focused'),{exact:true}).waitFor();
   assert.equal(await page.getByText(language==='en'?'focused':t('focused'),{exact:true}).count(),1);
   record.sittingLabelsLocalized=true;
 }
 results.advice.push(record);
};
