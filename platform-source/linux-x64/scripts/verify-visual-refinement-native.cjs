// Real packaged renderer and SQLite, inside the parent harness's marked fictional profile.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const authoredRows=fs.readFileSync('scripts/localization/visual-refinement.txt','utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#')).map(line=>line.split('|'));
module.exports=async({page,invoke,main,language,text,output,results,learn=true})=>{
 const t=k=>text(language,k),record={language},appearance=await invoke('appearance:get');
 const layout=async selector=>{const r=await page.locator(selector).evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));if(r.scroll>r.width+2){const wide=await page.locator(selector).evaluate(root=>[...root.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().width&&el.scrollWidth>el.clientWidth+2).map(el=>({tag:el.tagName,class:el.className,w:el.clientWidth,s:el.scrollWidth,text:el.textContent?.slice(0,80)})).slice(0,30));fs.writeFileSync(path.join(output,language+'-overflow-details.json'),JSON.stringify(wide,null,2));}assert.ok(r.scroll<=r.width+2,selector+' overflow '+JSON.stringify(r));return r};
 const screenshot=async name=>{await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:path.join(output,language+'-'+name+'.png'),timeout:30000});};
 const size=async(width,height)=>{await main.evaluate(`(async()=>{const w=qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/out/renderer/index.html'));if(w.isMaximized()){const ready=new Promise(resolve=>w.once('unmaximize',resolve));w.unmaximize();await ready;}w.setContentSize(${width},${height});return w.getContentSize()})()`);await page.waitForFunction(w=>Math.abs(innerWidth-w)<3,width);(record.windowSizes??=[]).push(await page.evaluate(()=>({width:innerWidth,height:innerHeight})));};
 await size(1100,820);
 const blocks=JSON.stringify((await invoke('stats:raw')).blocks);
 if(learn){
  if(language==='en'){for(const action of [{type:'activity',id:'familiarity'},{type:'check',id:'familiarity',choice:1},{type:'complete',id:'familiarity'},{type:'remind',id:'familiarity'}])await invoke('learn:act',action);}
  const prior=await invoke('learn:get');
  await page.getByRole('button',{name:t('Learn'),exact:true}).click();
  await page.locator('[data-learn-page]').waitFor();if(await page.getByRole('button',{name:t('Back to Learn'),exact:true}).isVisible())await page.getByRole('button',{name:t('Back to Learn'),exact:true}).click();await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Today'),exact:true}).click();
  // A prior complete set of daily ideas may be exhausted; Explore is always available.
  if(language==='en'){await screenshot('learn-today-light');const original=await page.locator('[data-learn-idea]').getAttribute('data-learn-idea');await page.getByRole('button',{name:t('Another idea'),exact:true}).click();assert.notEqual(await page.locator('[data-learn-idea]').getAttribute('data-learn-idea'),original);await page.getByRole('button',{name:t('Hide today’s idea'),exact:true}).click();assert.equal(await page.locator('[data-learn-idea]').count(),0);await page.getByRole('button',{name:t('Another idea'),exact:true}).click();await page.locator('[data-learn-idea]').waitFor();}
  await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Explore'),exact:true}).click();
  assert.equal(await page.locator('[data-idea-card]').count(),8);
  assert.equal(await page.locator('[data-strategy-id]').count(),24);
  assert.equal(await page.locator('input[type=radio]').count(),0);
  assert.equal(await page.getByRole('button',{name:t('Mark lesson complete'),exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:t('Practice lab'),exact:true}).count(),0);
  if(['en','ar','de','zh-Hans'].includes(language))await screenshot('learn-explore');
  for(const id of ['familiarity','retrieve','spacing','explain','examples','feedback','mix','reflect']){
   await page.locator('[data-idea-card="'+id+'"]').click();const article=page.locator('[data-learn-idea="'+id+'"]');await article.waitFor();
   assert.equal(await article.locator('[data-principle="'+id+'"] figcaption').count(),1);
   if(id==='examples'){const stages=article.locator('.example-page');for(const [index,expected] of [0,1,2].entries())assert.equal(await stages.nth(index).locator('.own-line').count(),expected,'Support must visibly fade before any interaction');}
   const caption=await article.locator('figcaption').innerText();assert.ok(authoredRows.some(row=>row[languages.indexOf(language)]?.trim()===caption),'Untranslated diagram caption: '+language+id);
   const compare=article.locator('.visual-compare');if(await compare.count()){await compare.focus();await page.keyboard.press('Space');assert.equal(await article.locator('.spacing-visit').count(),8);await article.locator('[data-principle]').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)))}
   if(id==='spacing'){
    // Equal visits; the static geometry communicates concentration versus gaps.
    const lanes=article.locator('.spacing-lane');
    for(const lane of await lanes.all())assert.equal(await lane.locator('.spacing-visit').count(),4);
    const spans=await lanes.evaluateAll(lanes=>lanes.map(l=>{const r=[...l.querySelectorAll('.spacing-visit')].map(e=>e.getBoundingClientRect());return Math.max(...r.map(x=>x.right))-Math.min(...r.map(x=>x.left))}));
    assert.ok(spans[1]>spans[0]*1.5,'Distributed visits must visibly span more time');
   }
   await layout('[data-learn-page]');assert.ok(await article.locator('.sr-only').count());
   if(['en','ar'].includes(language)||(['de','zh-Hans'].includes(language)&&['spacing','familiarity','explain'].includes(id)))await screenshot('learn-'+id);
   if(['en','ar'].includes(language)){
    const zoom=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,token:document.documentElement.style.getPropertyValue('--tf-zoom')}));
    await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});
    await article.locator('[data-principle]').scrollIntoViewIfNeeded();await layout('[data-learn-page]');await screenshot('learn-'+id+'-zoom-diagram');
    await page.evaluate(s=>{document.documentElement.style.zoom=s.zoom;document.documentElement.style.setProperty('--tf-zoom',s.token)},zoom);
   }
   const details=article.locator('details.learn-deeper').first();await details.locator(':scope > summary').click();assert.ok((await details.innerText()).length>70);
   if(id==='spacing'){
    const savedBefore=(await invoke('learn:get')).saved.includes('lesson:spacing');await article.locator('.learn-idea-heading button').click();assert.equal((await invoke('learn:get')).saved.includes('lesson:spacing'),!savedBefore);
    await page.reload();await size(1100,820);await page.getByRole('button',{name:t('Learn'),exact:true}).click();assert.equal((await invoke('learn:get')).saved.includes('lesson:spacing'),!savedBefore);
    // Return to the same detail after reload via the public Explore route.
    await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Explore'),exact:true}).click();await page.locator('[data-idea-card="spacing"]').click();
   }
   await page.getByRole('button',{name:t('Back to Learn'),exact:true}).click();
  }
  const after=await invoke('learn:get');for(const [id,p] of Object.entries(prior.lessons))for(const field of ['activityAt','completedAt','checks','lastCheck','revisitAt','revisitCount','revisitEnabled','draft'])assert.deepEqual(after.lessons[id][field],p[field],id+' legacy '+field);
  assert.ok(Object.entries(after.lessons).filter(([id])=>!prior.lessons[id]).every(([,p])=>!p.checks&&!p.completedAt&&!p.activityAt),'Visual browsing must not create activity/assessment/completion records');
  await page.getByLabel(t('Search Learn'),{exact:true}).fill('no-match-fictional-721');assert.equal(await page.locator('[data-idea-card]').count(),0);assert.equal(await page.locator('[data-strategy-id]').count(),0);await page.getByRole('button',{name:t('Clear filters'),exact:true}).click();
  await page.getByRole('button',{name:t('Saved'),exact:true}).click();assert.ok(await page.locator('[data-idea-card="spacing"]').count() || !after.saved.includes('lesson:spacing'));
  await page.getByRole('navigation',{name:t('Learn views')}).getByRole('button',{name:t('Explore'),exact:true}).click();
  const rest=page.locator('[data-strategy-id="rest-recovery"]');await rest.locator('summary').first().click();assert.equal(await rest.locator('[data-principle=rest]').count(),1);if(['en','ar'].includes(language)){await rest.locator('[data-principle=rest]').scrollIntoViewIfNeeded();await screenshot('learn-rest');const attention=page.locator('[data-strategy-id="thought-parking"]');await attention.locator('summary').first().click();await attention.locator('[data-principle=attention]').scrollIntoViewIfNeeded();await screenshot('learn-attention');}
  if(['en','ar'].includes(language)){
   await page.locator('[data-idea-card="spacing"]').click();await invoke('appearance:set',{...appearance,mode:'dark'});await page.waitForTimeout(100);await screenshot('learn-spacing-dark');await invoke('appearance:set',appearance);
   await size(900,760);await layout('[data-learn-page]');await screenshot('learn-narrow');
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);await page.locator('[data-learn-idea=spacing] .visual-compare').click();assert.equal(await page.locator('[data-learn-idea=spacing] .spacing-lane').nth(1).locator('.spacing-visit').first().evaluate(el=>getComputedStyle(el).animationName),'none');
   const learnZoom=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,token:document.documentElement.style.getPropertyValue('--tf-zoom')}));await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});await screenshot('learn-200-percent');await layout('[data-learn-page]');await page.evaluate(s=>{document.documentElement.style.zoom=s.zoom;document.documentElement.style.setProperty('--tf-zoom',s.token)},learnZoom);
   await page.emulateMedia({forcedColors:'active'});await screenshot('learn-forced-colors');await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});await size(1100,820);
  }
  record.visualIdeas=8;record.strategies=24;record.noQuizOrCompletion=true;record.bookmarkReload=true;record.legacyActivityPreserved=true;
 }
 await page.getByRole('button',{name:t('Stats'),exact:true}).click();
 await require('./qa-stats-navigation.cjs')(page,t,'insights');
 await page.locator('.recorded-dashboard').waitFor();await layout('#stats-scroll');
 assert.equal(await page.getByRole('navigation',{name:t('Stats sections'),exact:true}).getByRole('button').count(),4);
 assert.equal(await page.locator('#stats-insights button').filter({hasText:'Recorded progress:'}).count(),0);
 const raw=await invoke('stats:raw');record.rawSessions=raw.sessions.length;record.dashboard=await page.locator('.recorded-dashboard').innerText();
 if(process.env.FOCUSRECALL_VISUAL_FIXTURE_COUNT!==undefined){const count=Number(process.env.FOCUSRECALL_VISUAL_FIXTURE_COUNT);if(count<400)assert.equal(raw.sessions.length,count,'Incorrect fictional fixture size');else assert.ok(raw.sessions.length>=100);if(count===0){assert.equal(await page.locator('.recorded-start').isVisible(),true);const tools=await invoke('tools:get');if(!(tools.discoveries??[]).some(d=>d.status==='saved'||d.status==='dismissed'))assert.equal(await page.locator('#stats-insights').count(),0,'Seen findings must not create an empty patterns panel');}if(count===4)assert.equal(await page.locator('.recorded-counts b').nth(1).innerText(),await page.evaluate(l=>new Intl.NumberFormat(l).format(2),language));}
 if(raw.sessions.length){const days=page.locator('.recorded-day');await days.first().focus();await page.keyboard.press('Enter');assert.equal(await days.first().getAttribute('aria-pressed'),'true');assert.ok((await page.locator('.recorded-chart-readout').innerText()).length>3);await screenshot('stats-day-detail');}
 await screenshot('stats-summary-light');
 if(['en','ar'].includes(language)&&await page.locator('#stats-insights').count()){await page.locator('#stats-insights').scrollIntoViewIfNeeded();await screenshot('stats-findings');const comparison=page.locator('#stats-insights .finding-comparison').first();if(await comparison.count()){await comparison.scrollIntoViewIfNeeded();await screenshot('stats-comparison');}await page.locator('#stats-scroll').evaluate(el=>el.scrollTo({top:0}));}
 if(['en','ar'].includes(language)){
  await invoke('appearance:set',{...appearance,mode:'dark'});await page.waitForTimeout(100);await screenshot('stats-summary-dark');await invoke('appearance:set',appearance);
  await size(900,760);await layout('#stats-scroll');await screenshot('stats-narrow');const originalZoom=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,token:document.documentElement.style.getPropertyValue('--tf-zoom')}));await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.style.setProperty('--tf-zoom','2')});await screenshot('stats-200-percent');record.statsZoomGeometry=await layout('#stats-scroll');await page.locator('#stats-scroll').evaluate(el=>el.scrollTop=document.getElementById('stats-bar').offsetHeight);await screenshot('stats-200-content');await page.evaluate(s=>{document.documentElement.style.zoom=s.zoom;document.documentElement.style.setProperty('--tf-zoom',s.token)},originalZoom);record.statsZoom200=true;await size(1100,820);
 }
 // Every prior analytical destination is still reachable through visible controls.
 for(const id of ['weekly','overview','subjects','factors','setup','time','rhythm','distractions','rest','methods','stage','modes','report']){await require('./qa-stats-navigation.cjs')(page,t,id);assert.equal(await page.locator('#stats-'+id).isVisible(),true,id+' unavailable');await layout('#stats-scroll');if(['en','ar'].includes(language))await screenshot('stats-'+id);if(id==='report'&&raw.sessions.length&&['en','ar'].includes(language)){const calendar=page.locator('.report-calendar');await calendar.scrollIntoViewIfNeeded();assert.equal(await calendar.locator('.report-weekday').count(),7);await screenshot('stats-report-calendar')}}
 await require('./qa-stats-navigation.cjs')(page,t,'insights');
 assert.equal(JSON.stringify((await invoke('stats:raw')).blocks),blocks,'Visual browsing changed study records');
 record.groupedNavigation=true;record.studyDataUnchanged=true;(results.visualRefinement??=[]).push(record);
};
