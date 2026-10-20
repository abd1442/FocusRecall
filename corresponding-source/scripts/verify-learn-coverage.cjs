const assert=require('node:assert/strict'),path=require('node:path');
const copy=require('../src/core/learnExpansionCopy.json'),ids=['forgetting','motivation','targeted','pressure','methods'];
module.exports=async context=>{
 const {page,invoke,language,text,output,results}=context,t=k=>text(language,k);
 if(process.env.FOCUSRECALL_COVERAGE_PROTOTYPE!=='1')await require('./verify-learn-visuals.cjs')(context);
 await page.getByRole('button',{name:t('Learn'),exact:true}).click();
 await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Explore'),exact:true}).click();
 const reset=async()=>{const clear=page.getByRole('button',{name:t('Clear filters'),exact:true});if(await clear.isVisible())await clear.click()};await reset();
 const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(output,language+'-coverage-'+name+'.png')})};
 const layout=async()=>{const r=await page.locator('[data-learn-page]').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(r.scroll<=r.width+2,JSON.stringify(r));const clipped=await page.locator('[data-learn-idea] figure').evaluateAll(els=>els.flatMap(root=>[...root.querySelectorAll('p,figcaption,button,span')].filter(e=>!e.classList.contains('sr-only')&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent)));assert.deepEqual(clipped,[])};
 assert.equal(await page.locator('[data-idea-card]').count(),27);
 await page.locator('[data-collection-filter="remember"]').click();assert.equal(await page.locator('.learn-collection').count(),1);assert.equal(await page.locator('[data-strategy-id]').count(),0);assert.equal(await page.locator('[data-idea-card="forgetting"]').count(),1);await shot('remember');
 await page.locator('[data-idea-card="forgetting"]').click();await page.getByRole('button',{name:t('Back to Learn'),exact:true}).click();assert.equal(await page.locator('[data-collection-filter="remember"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-idea-card="forgetting"]').evaluate(el=>el===document.activeElement),true);
 await page.locator('[data-collection-filter="strategies"]').click();assert.equal(await page.locator('[data-idea-card]').count(),0);assert.equal(await page.locator('[data-strategy-id]').count(),24);await shot('strategies');await reset();
 for(const id of ids){
  await page.locator(`[data-idea-card="${id}"]`).click();const article=page.locator(`[data-learn-idea="${id}"]`);assert.equal(await article.locator('h2').innerText(),copy[id][language].title);await layout();
  if(['forgetting','pressure'].includes(id)){const xs=await article.locator('.completion-labels>p').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().left));assert.ok(xs[0]<xs[1]&&xs[1]<xs[2],'Fixed spatial labels must align in RTL')}
  const replay=article.locator('.visual-compare');if(await replay.count()){await replay.focus();await page.keyboard.press('Space');await page.waitForTimeout(1800)}
  await shot(id);await article.locator('.learn-deeper').last().locator('summary').click();assert.ok((await article.locator('.learn-sources').innerText()).includes(copy[id][language].detail));await article.locator('.learn-deeper').last().locator('summary').click();
  if(process.env.FOCUSRECALL_COVERAGE_PROTOTYPE==='1'&&['en','ar'].includes(language)){
   const appearance=await invoke('appearance:get');await invoke('appearance:set',{...appearance,mode:'dark'});await shot(id+'-dark');await invoke('appearance:set',appearance);
   await page.emulateMedia({reducedMotion:'reduce'});if(await replay.count())await replay.click();assert.equal(await article.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
   const zoom=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,token:document.documentElement.style.getPropertyValue('--tf-zoom')}));await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});await article.locator('figure').scrollIntoViewIfNeeded();await layout();await shot(id+'-200');await page.evaluate(s=>{document.documentElement.style.zoom=s.zoom;document.documentElement.style.setProperty('--tf-zoom',s.token)},zoom);await page.emulateMedia({forcedColors:'active'});await shot(id+'-forced');await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
  }
  assert.equal(await article.locator('input').count(),0);await page.getByRole('button',{name:t('Back to Learn'),exact:true}).click();
 }
 await page.getByLabel(t('Search Learn'),{exact:true}).fill(copy.motivation[language].title);assert.equal(await page.locator('[data-idea-card="motivation"]').count(),1);await reset();
 (results.coverage??=[]).push({language,additions:ids,collectionFiltering:true,returnContext:true,localizedSearch:true});
};
