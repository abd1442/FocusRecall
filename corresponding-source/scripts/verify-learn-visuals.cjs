// Reuses the established isolated native review, then checks every canonical
// strategy illustration. No personal profile is opened by this module.
const assert=require('node:assert/strict'),path=require('node:path');
const advice=require('../src/core/adviceCopy.json'),tailored=new Set(['question-design','spacing-adjust','compare-concepts','worked-example','feedback-specific','predict-check','delayed-check','restart-note','plan-feasible','rest-accessible']);
module.exports=async context=>{
 if(process.env.FOCUSRECALL_STRATEGY_ONLY!=='1')await require('./verify-learn-continuation.cjs')(context);
 const {page,invoke,language,text,output,results}=context,t=k=>text(language,k),appearance=await invoke('appearance:get');
 await page.getByRole('button',{name:t('Learn'),exact:true}).click();
 await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Explore'),exact:true}).click();
 if(['en','ar'].includes(language)){
  await page.locator('[data-idea-card="palace"]').click();
  const columns=await page.locator('.palace-legend>span').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().left));assert.ok(columns[0]<columns[1]&&columns[1]<columns[2],'Legend labels must align with fixed room locations');
  await page.locator('[data-learn-idea="palace"] figure').screenshot({path:path.join(output,language+'-palace-detail.png')});
  await page.getByRole('button',{name:t('Back to Learn'),exact:true}).click();
 }
 const before=JSON.stringify(await invoke('learn:get')),study=JSON.stringify((await invoke('stats:raw')).blocks),visited=[];
 const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(output,language+'-strategy-'+name+'.png')})};
 const layout=async figure=>{const size=await page.locator('[data-learn-page]').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(size.scroll<=size.width+2,JSON.stringify(size));const clipped=await figure.evaluate(root=>[...root.querySelectorAll('p,figcaption,button')].filter(e=>!e.classList.contains('sr-only')&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent));assert.deepEqual(clipped,[])};
 for(const id of Object.keys(advice)){
  const article=page.locator(`[data-strategy-id="${id}"]`),details=article.locator('details').first(),summary=details.locator('summary').first();
  await summary.click();const figure=article.locator(`[data-strategy-visual="${id}"] figure`);assert.equal(await figure.count(),1);assert.ok((await figure.locator('figcaption').innerText()).trim());
  await figure.scrollIntoViewIfNeeded();await layout(figure);await shot(id);
  const replay=figure.locator('.visual-compare');if(await replay.count()){await replay.focus();await page.keyboard.press('Space');await page.waitForTimeout(1500)}
  if(tailored.has(id)&&['en','ar'].includes(language)){
   await page.emulateMedia({reducedMotion:'reduce'});if(await replay.count())await replay.click();assert.equal(await figure.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
   await invoke('appearance:set',{...appearance,mode:'dark'});await shot(id+'-dark');await invoke('appearance:set',appearance);
   await page.emulateMedia({forcedColors:'active'});await layout(figure);await shot(id+'-forced');await page.emulateMedia({forcedColors:'none'});
   const zoom=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,token:document.documentElement.style.getPropertyValue('--tf-zoom')}));await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});await figure.scrollIntoViewIfNeeded();await layout(figure);await shot(id+'-200');await page.evaluate(s=>{document.documentElement.style.zoom=s.zoom;document.documentElement.style.setProperty('--tf-zoom',s.token)},zoom);await page.emulateMedia({reducedMotion:'no-preference'});
  }
  visited.push(id);await summary.click();
 }
 assert.equal(JSON.stringify(await invoke('learn:get')),before,'Illustrations must not create Learn activity');assert.equal(JSON.stringify((await invoke('stats:raw')).blocks),study);
 (results.strategyVisuals??=[]).push({language,visited,learnStateUnchanged:true,studyDataUnchanged:true});
};
