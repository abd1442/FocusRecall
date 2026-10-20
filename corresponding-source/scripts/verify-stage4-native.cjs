// Invoked by the existing guarded fictional-profile native harness only.
const assert=require('node:assert/strict'),path=require('node:path');
const copy=require('../src/core/adviceCopy.json');
module.exports=async({page,invoke,main,language,text,output,results})=>{
 const t=k=>text(language,k),record={language,cycles:[]};
 const item=(await invoke('library:listPickerItems'))[0];
 const beforeLearn=await invoke('learn:get'),beforeBlocks=(await invoke('stats:raw')).blocks.length;
 const shot=async(target,name)=>{await target.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));await target.screenshot({path:path.join(output,language+'-'+name+'.png')})};
 const example=async(target,phase)=>{
  const card=target.locator('[data-advice-id]');await target.waitForFunction(()=>!!document.querySelector('[data-advice-id]')?.getAttribute('data-advice-id'));
  const id=await card.getAttribute('data-advice-id'),learn=await invoke('learn:get'),session=await invoke('session:get');
  const button=card.getByRole('button',{name:t('See a visual example'),exact:true});await button.focus();await target.keyboard.press('Enter');
  const dialog=target.getByRole('dialog');await dialog.waitFor();await dialog.locator(`[data-strategy-visual="${id}"]`).waitFor();
  assert.ok((await dialog.innerText()).includes(copy[id][language].action));assert.ok((await dialog.innerText()).includes(copy[id][language].detail));
  assert.equal(await dialog.locator('input,textarea,select').count(),0);
  await target.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
  await shot(target,phase+'-example');
  if(language==='ar'&&phase==='recall'){
   await target.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await shot(target,phase+'-forced');assert.equal(await dialog.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);await target.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  }
  if(language==='en'&&phase==='recall'){
   await target.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});await shot(target,phase+'-200');
   assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+2));
   await target.evaluate(()=>{document.documentElement.style.zoom='';document.documentElement.style.removeProperty('--tf-zoom')});
   const appearance=await invoke('appearance:get');await invoke('appearance:set',{...appearance,mode:'dark'});await shot(target,phase+'-dark');await invoke('appearance:set',appearance);
   await invoke('settings:set','language','ar');await target.waitForFunction(()=>document.documentElement.lang==='ar');assert.ok((await dialog.innerText()).includes(copy[id].ar.action));
   await invoke('settings:set','language',language);await target.waitForFunction(l=>document.documentElement.lang===l,language);
  }
  if(phase==='return')await dialog.getByRole('button',{name:t('Return to study'),exact:true}).click();else await target.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.equal(await button.evaluate(el=>el===document.activeElement),true,'Focus restored to opener');
  assert.equal(await card.getAttribute('data-advice-id'),id,'Visual must not rotate the advice');
  assert.deepEqual(await invoke('learn:get'),learn,'No exposure, view, completion or use recorded');
  assert.deepEqual(await invoke('session:get'),session,'Example must not change the workflow');
  return id;
 };
 for(const engage of [false,true]){
  await invoke('advice:reset');await page.getByRole('button',{name:t('Home'),exact:true}).click();
  await invoke('preparation:begin',{itemId:item.id,timerMode:'flow',targetSeconds:1500,goal:'Stage 4 fictional goal عربي 中文'},true);
  await page.waitForFunction(()=>true);
  let panel;
  for(let n=0;n<50;n++){panel=page.context().pages().find(p=>p.url().endsWith('#panel'));if(panel&&await panel.getByRole('heading',{name:t('Get ready'),exact:true}).isVisible())break;await page.waitForTimeout(100)}
  assert.ok(panel);const checks=panel.locator('input[type=checkbox]');await checks.first().check();
  if(engage){await example(panel,'prepare');assert.equal(await checks.first().isChecked(),true);assert.ok(await invoke('preparation:get'))}
  else assert.equal(await panel.getByRole('dialog').count(),0);
  await invoke('preparation:confirm');await page.getByRole('button',{name:t('Finish session'),exact:true}).waitFor();
  assert.equal(await page.locator('[data-advice-id],[data-study-example]').count(),0);assert.equal(await panel.locator('[data-study-example]').count(),0);
  assert.equal(await invoke('advice:choose','prepare','any',true),null);
  await page.getByRole('button',{name:t('Finish session'),exact:true}).click();
  await page.getByRole('button',{name:t('Keep it'),exact:true}).click();
  await page.getByRole('button',{name:t('Type notes'),exact:true}).click();
  const draft='Stage 4 private draft عربي 中文',editor=page.locator('textarea').first();await editor.fill(draft);
  if(engage){await example(page,'recall');assert.equal(await editor.inputValue(),draft)}
  await page.getByRole('button',{name:t('Continue to session log'),exact:true}).click();
  await page.getByRole('heading',{name:t('How did it go?'),exact:true}).waitFor();
  assert.equal(await page.locator('[data-study-example]').count(),0);
  await page.getByRole('button',{name:t('Continue to rest'),exact:true}).click();
  await page.getByRole('button',{name:t('Start rest'),exact:true}).waitFor();
  if(engage)await example(page,'rest-plan');
  await page.getByRole('button',{name:t('Start rest'),exact:true}).click();
  await page.getByRole('button',{name:t('End rest early'),exact:true}).waitFor();
  assert.equal(await page.locator('[data-advice-id],[data-study-example]').count(),0);
  await page.getByRole('button',{name:t('End rest early'),exact:true}).click();
  await page.getByRole('button',{name:t('Continue to next session'),exact:true}).click();
  await page.getByRole('heading',{name:t('Next session'),exact:true}).waitFor();
  if(engage)await example(page,'return');
  assert.equal((await invoke('session:get')).running,null);
  await shot(page,engage?'return-context':'never-opened-return');
  await page.getByRole('button',{name:t('Finish studying'),exact:true}).click();
  assert.equal((await invoke('session:get')).stage,'idle');
  assert.deepEqual(await invoke('learn:get'),beforeLearn);
  if(language==='en'&&!engage)assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('StudyStrategyExample-'))),false,'Ignoring the control must not load the optional example chunk');
  record.cycles.push({openedExamples:engage,completeCycle:true,learnUnchanged:true,focusAndRunningRestSilent:true,draftPreserved:true});
 }
 assert.equal((await invoke('stats:raw')).blocks.length,beforeBlocks+2);
 (results.stage4??=[]).push(record);
};
