// Runs only in verify-product-review's newly created marked fictional profile.
const assert=require('node:assert/strict'),path=require('node:path');
const copy=require('../src/core/learnExpansionCopy.json');
const legacy=['familiarity','retrieve','spacing','explain','examples','feedback','mix','reflect'],ids=[...legacy,...Object.keys(copy)];
module.exports=async({page,invoke,main,language,text,output,results})=>{
 const t=k=>text(language,k),record={language,visits:[],checks:[]},before=JSON.stringify((await invoke('stats:raw')).blocks),appearance=await invoke('appearance:get');
 const size=async()=>{await main.evaluate('(async()=>{const w=qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html"));if(w.isMaximized()){const ready=new Promise(r=>w.once("unmaximize",r));w.unmaximize();await ready;}w.setContentSize(1100,820);return w.getContentSize()})()');await page.waitForFunction(()=>Math.abs(innerWidth-1100)<3)};
 const shot=async name=>{await size();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:path.join(output,language+'-'+name+'.png'),timeout:30000})};
 const layout=async()=>{const r=await page.locator('[data-learn-page]').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(r.scroll<=r.width+2,JSON.stringify(r));const over=await page.locator('[data-learn-idea] figure').evaluateAll(els=>els.flatMap(root=>[...root.querySelectorAll('p,figcaption,button')].filter(e=>!e.classList.contains('sr-only')&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent)));assert.deepEqual(over,[])};
 const explore=async()=>{const back=page.getByRole('button',{name:t('Back to Learn'),exact:true});if(await back.isVisible())await back.click();await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Explore'),exact:true}).click()};
 await size();
 await invoke('appearance:set',{...appearance,mode:'light'});
 await page.getByRole('button',{name:t('Learn'),exact:true}).click();await page.locator('[data-learn-page]').waitFor();
 await explore();assert.equal(await page.locator('[data-idea-card]').count(),16);assert.equal(await page.locator('[data-strategy-id]').count(),24);assert.equal(await page.locator('.learn-collection').count(),5);
 await shot('explore');
 await page.locator('[data-idea-card="starting"]').scrollIntoViewIfNeeded();
 const browseScroll=await page.locator('[data-learn-page]').evaluate(el=>el.scrollTop);
 await page.locator('[data-idea-card="starting"]').click();await page.getByRole('button',{name:t('Back to Learn'),exact:true}).click();
 await page.waitForFunction(top=>Math.abs(document.querySelector('[data-learn-page]').scrollTop-top)<3,browseScroll);
 assert.equal(await page.locator('[data-idea-card="starting"]').evaluate(el=>el===document.activeElement),true);
 for(const id of ids){
  await page.locator(`[data-idea-card="${id}"]`).click();const article=page.locator(`[data-learn-idea="${id}"]`);await article.waitFor();await layout();
  assert.ok((await article.locator('figcaption').innerText()).trim());
  assert.equal(await page.locator('input[type=radio]').count(),0);
  if(copy[id])assert.equal(await article.locator('h2').innerText(),copy[id][language].title);
  const button=article.locator('.visual-compare');if(await button.count()){await button.focus();await page.keyboard.press('Space');await layout()}
  if(copy[id]||['en','ar'].includes(language))await shot(id);
  await article.locator('.learn-deeper').last().locator('summary').click();assert.ok(await article.locator('.learn-sources button').count());
  if(copy[id])assert.ok((await article.locator('.learn-sources').innerText()).includes(copy[id][language].detail));
  if(copy[id]&&['en','ar'].includes(language)){
   await article.locator('.learn-deeper').last().locator('summary').click();
   await invoke('appearance:set',{...appearance,mode:'dark'});await shot(id+'-dark');await invoke('appearance:set',{...appearance,mode:'light'});
   await page.emulateMedia({reducedMotion:'reduce'});if(await button.count())await button.click();assert.equal(await article.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);await shot(id+'-reduced');
   const zoom=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,token:document.documentElement.style.getPropertyValue('--tf-zoom')}));await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});await article.locator('figure').scrollIntoViewIfNeeded();await layout();await shot(id+'-200');await page.evaluate(s=>{document.documentElement.style.zoom=s.zoom;document.documentElement.style.setProperty('--tf-zoom',s.token)},zoom);await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'active'});await layout();await shot(id+'-forced');await page.emulateMedia({forcedColors:'none'});
  }
  record.visits.push(id);await explore();
 }
 await page.getByLabel(t('Topic'),{exact:true}).selectOption('rest');assert.equal(await page.locator('[data-idea-card="sleep"]').count(),1);assert.equal(await page.locator('[data-idea-card="incubation"]').count(),1);await page.getByRole('button',{name:t('Clear filters'),exact:true}).click();
 // Search in the actual language, then prove new content survives a reload.
 await page.getByLabel(t('Search Learn'),{exact:true}).fill(copy.starting[language].keywords.split(' ')[0]);assert.equal(await page.locator('[data-idea-card="starting"]').count(),1);await page.getByRole('button',{name:t('Clear filters'),exact:true}).click();
 await page.getByLabel(t('Search Learn'),{exact:true}).fill(copy.palace[language].title);assert.equal(await page.locator('[data-idea-card]').count(),1);await page.getByRole('button',{name:t('Clear filters'),exact:true}).click();
 await page.locator('[data-idea-card="palace"]').click();const savedBefore=(await invoke('learn:get')).saved.includes('lesson:palace');if(!savedBefore)await page.locator('.learn-idea-heading button').click();
 await page.reload();await page.getByRole('button',{name:t('Learn'),exact:true}).click();assert.ok((await invoke('learn:get')).saved.includes('lesson:palace'));await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Saved'),exact:true}).click();assert.equal(await page.locator('[data-idea-card="palace"]').count(),1);await shot('saved');
 await invoke('learn:act',{type:'another'});await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Today'),exact:true}).click();await shot('today');
 if(language==='en'){
  const current=await page.locator('[data-learn-idea]').getAttribute('data-learn-idea');await page.getByRole('button',{name:t('Another idea'),exact:true}).click();assert.notEqual(await page.locator('[data-learn-idea]').getAttribute('data-learn-idea'),current);await page.getByRole('button',{name:t('Hide today’s idea'),exact:true}).click();assert.equal(await page.locator('[data-learn-idea]').count(),0);
 }
 await page.getByRole('button',{name:t('Stats'),exact:true}).click();await shot('stats');
 assert.equal(JSON.stringify((await invoke('stats:raw')).blocks),before);record.studyDataUnchanged=true;record.checks=['16 visuals','24 strategies','five collections','localized search','sources and qualifications','bookmark reload','no quizzes'];
 await invoke('appearance:set',appearance);(results.expansion??=[]).push(record);
};
