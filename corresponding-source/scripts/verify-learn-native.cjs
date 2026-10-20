// Invoked only inside the existing new-marked-fictional-profile harness.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const copy=require('../src/core/learnCopy.json'),ids=['familiarity','retrieve','spacing','explain','examples','feedback','mix','reflect'];
module.exports=async({page,invoke,language,text,output,results})=>{
 const t=key=>text(language,key),record={language,lessons:[]},before=JSON.stringify((await invoke('stats:raw')).blocks);
 const appearance=await invoke('appearance:get');
 const contrasts=async()=>page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
   const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
   const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const vars=getComputedStyle(document.documentElement),background=rgb(vars.getPropertyValue('--tf-surface').trim());
   return ['--tf-text','--tf-muted','--tf-focus','--tf-recall'].map(key=>{const color=vars.getPropertyValue(key).trim();if(!color)return {key,unavailable:true};const a=lum(rgb(color)),b=lum(background);return {key,foreground:color,background:vars.getPropertyValue('--tf-surface').trim(),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}});
 });
 const waitSaved=async predicate=>{for(let i=0;i<100;i++){const state=await invoke('learn:get');if(predicate(state))return state;await new Promise(r=>setTimeout(r,30))}throw Error('Learn progress did not persist')};
 if(language==='en')await invoke('learn:act',{type:'reset'});
 await page.getByRole('button',{name:t('Learn'),exact:true}).click();
 await page.locator('[data-learn-page]').waitFor();
 await page.getByRole('button',{name:t('Explore'),exact:true}).click();
 for(const id of ids){
   const lessonCopy=copy[id][language];
   await page.locator('[data-lesson-card="'+id+'"]').getByRole('button',{name:new RegExp('^(?:'+[t('Start lesson'),t('Continue lesson')].map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')$')}).click();
   const article=page.locator('[data-learn-lesson="'+id+'"]');await article.waitFor();
   assert.equal(await page.locator('h1').innerText(),lessonCopy.title);
   const interaction=article.locator('[data-learn-interaction]');
   await interaction.getByRole('button',{name:t('Reset this example'),exact:true}).click();
   await waitSaved(s=>s.lessons[id]?.draft.length===0);
   if(id==='familiarity'){
     // Enter/Space operate the same meaningful controls as pointer use.
     const hide=interaction.getByRole('button',{name:t('Hide the example'),exact:true});await hide.focus();await page.keyboard.press('Enter');
     for(const label of lessonCopy.items.split('¦'))await interaction.getByRole('button',{name:label,exact:true}).click();
     await interaction.getByRole('button',{name:t('Compare with the example'),exact:true}).click();
     assert.ok((await interaction.innerText()).includes(t('Your sequence matches. The choices supplied cues; this does not measure lasting memory.')));
   }else if(id==='spacing'){
     await interaction.getByRole('button',{name:t('Spread across days'),exact:true}).click();
     const dayButton=interaction.locator('.learn-calendar-day').nth(5);await dayButton.focus();await page.keyboard.press('Space');
     const state=await waitSaved(s=>s.lessons.spacing?.draft[0]===5);assert.equal(state.lessons.spacing.draft.length,5);
   }else if(id==='explain'){
     await interaction.getByRole('button',{name:lessonCopy.items.split('¦')[1],exact:true}).click();assert.ok((await interaction.innerText()).includes('≠'));
     await interaction.getByRole('button',{name:lessonCopy.items.split('¦')[0],exact:true}).click();assert.ok((await interaction.innerText()).includes('16'));
   }else if(id==='reflect'){
     for(let i=0;i<3;i++)await interaction.getByRole('button',{name:t('Add to example plan'),exact:true}).first().click();
   }else{
     const rail=interaction.locator('.learn-stage-rail');await rail.getByRole('button').last().click();
     await interaction.getByRole('button',{name:t('Reveal worked reasoning'),exact:true}).click();
     assert.ok((await interaction.innerText()).includes(id==='examples'?lessonCopy.explanation:lessonCopy.panels.split('¦').at(-1)));
     if(id==='mix'){await interaction.getByRole('button',{name:t('Show mixed practice'),exact:true}).click();assert.equal(await interaction.locator('.learn-practice-set span').count(),4)}
   }
   await waitSaved(s=>!!s.lessons[id]?.activityAt);
   await article.getByLabel(lessonCopy.options.split('¦')[0],{exact:true}).check();
   await article.getByRole('button',{name:t('Check this choice'),exact:true}).click();
   await waitSaved(s=>s.lessons[id]?.lastCheck===0);
   assert.ok((await article.innerText()).includes(lessonCopy.feedback));
   const complete=article.getByRole('button',{name:t('Mark lesson complete'),exact:true});if(await complete.count())await complete.click();
   await waitSaved(s=>!!s.lessons[id]?.completedAt);
   if(['en','ar','de','zh-Hans'].includes(language)){
     await interaction.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,language+'-learn-'+id+'.png')});
   }
   const layout=await page.evaluate(()=>{const root=document.querySelector('[data-learn-page]');return {width:innerWidth,scroll:document.documentElement.scrollWidth,learnWidth:root.clientWidth,learnScroll:root.scrollWidth,dir:document.documentElement.dir}});assert.ok(layout.scroll<=layout.width+2);assert.ok(layout.learnScroll<=layout.learnWidth+2,'Learn inner overflow '+language+id+JSON.stringify(layout));assert.equal(layout.dir,language==='ar'?'rtl':'ltr');
   if(id==='spacing'){
     const state=await invoke('learn:get'),draft=state.lessons.spacing.draft,other=language==='ar'?'en':'ar';await invoke('settings:set','language',other);await page.waitForFunction(l=>document.documentElement.lang===l,other);
     assert.equal(await page.locator('h1').innerText(),copy[id][other].title);assert.deepEqual((await invoke('learn:get')).lessons.spacing.draft,draft);
     await invoke('settings:set','language',language);await page.waitForFunction(l=>document.documentElement.lang===l,language);
     record.languageSwitchPreservesActivity=true;
   }
   if(id==='reflect'&&language==='en'){
     const section=article.locator('#learn-action');await section.getByRole('button',{name:t('Save strategy'),exact:true}).click();
     await waitSaved(s=>s.saved.some(id=>id.startsWith('concept:')));
     await section.getByRole('button',{name:t('Save lesson'),exact:true}).click();
     await waitSaved(s=>s.saved.includes('lesson:reflect'));
     await article.getByRole('button',{name:t('Offer occasional revisits'),exact:true}).click();
     await waitSaved(s=>s.lessons.reflect?.revisitEnabled===true);
   }
   await article.getByRole('button',{name:t('Back to Learn'),exact:true}).click();
   record.lessons.push({id,interactive:true,check:true,completed:true,localized:true});
 }
 await page.getByRole('button',{name:t('Strategies'),exact:true}).click();
 assert.equal(await page.locator('[data-strategy-id]').count(),24);
 const input=page.getByRole('searchbox',{name:t('Search Learn'),exact:true});await input.fill('zzzz-no-fictional-match');await page.getByRole('status').filter({hasText:t('No results. Try a different word or clear the topic filter.')}).waitFor();await input.fill('');
 await page.getByRole('button',{name:t('Explore'),exact:true}).click();
 const first=page.locator('[data-lesson-card="familiarity"]');await first.getByRole('button',{name:t('Revisit'),exact:true}).click();
 await page.getByRole('button',{name:t('Reveal and reflect'),exact:true}).click();await waitSaved(s=>s.lessons.familiarity?.revisitCount>0);record.revisit=true;
 await page.locator('[data-learn-lesson]').getByRole('button',{name:t('Back to Learn'),exact:true}).click();
 await page.getByRole('button',{name:t('Today'),exact:true}).click();
 if(['en','ar','de','zh-Hans'].includes(language)){
   await page.locator('[data-learn-page]').evaluate(el=>{el.scrollTop=0});await page.screenshot({path:path.join(output,language+'-learn-today-light.png')});
   record.lightContrasts=await contrasts();await invoke('appearance:set',{...appearance,mode:'dark'});await page.waitForTimeout(100);await page.screenshot({path:path.join(output,language+'-learn-today-dark.png')});record.darkContrasts=await contrasts();await invoke('appearance:set',appearance);
 }
 if(language==='en'){
   const snapshot=await invoke('learn:get');
   await page.getByRole('button',{name:t('Saved'),exact:true}).click();assert.ok(await page.locator('[data-strategy-id]').count());assert.equal(await page.locator('[data-lesson-card="reflect"]').count(),1);
   await page.reload();await page.getByRole('button',{name:t('Learn'),exact:true}).click();
   assert.deepEqual((await invoke('learn:get')).saved,snapshot.saved);record.reloadPersistence=true;
   await page.getByRole('button',{name:t('Continue a lesson'),exact:true}).click();await page.locator('[data-learn-lesson="familiarity"]').waitFor();
   await page.locator('[data-learn-lesson]').getByRole('button',{name:t('Back to Learn'),exact:true}).click();record.lastLessonResume=true;
   await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);assert.equal(reduced,true);record.reducedMotion=true;
   await page.emulateMedia({forcedColors:'active'});assert.equal(await page.evaluate(()=>matchMedia('(forced-colors: active)').matches),true);await page.screenshot({path:path.join(output,'en-learn-forced-colors.png')});await page.emulateMedia({forcedColors:'none'});record.forcedColorsEmulation=true;
   await page.locator('[data-learn-page]').evaluate(el=>{el.style.zoom='2';el.scrollTop=0});await page.screenshot({path:path.join(output,'en-learn-200-percent.png')});
   const width=await page.evaluate(()=>{const root=document.querySelector('[data-learn-page]');return {w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth,learnWidth:root.clientWidth,learnScroll:root.scrollWidth}});assert.ok(width.s<=width.w+2);assert.ok(width.learnScroll<=width.learnWidth+2,'Learn 200% inner overflow '+JSON.stringify(width));await page.locator('[data-learn-page]').evaluate(el=>{el.style.zoom=''});record.zoom200NoDocumentOverflow=true;
   await page.emulateMedia({reducedMotion:'no-preference'});
 }
 assert.equal(JSON.stringify((await invoke('stats:raw')).blocks),before,'Learn changed study blocks');record.studyBlocksUnchanged=true;
 if(language==='de'){
   const previous=await invoke('learn:get');
   await page.locator('summary').filter({hasText:t('Learn progress and privacy')}).click();
   await page.getByRole('button',{name:t('Reset Learn progress'),exact:true}).click();
   await page.getByRole('button',{name:t('Cancel'),exact:true}).click();assert.deepEqual((await invoke('learn:get')).lessons,previous.lessons);
   await page.getByRole('button',{name:t('Reset Learn progress'),exact:true}).click();
   await page.getByRole('button',{name:t('Confirm Learn reset'),exact:true}).click();
   await waitSaved(s=>Object.keys(s.lessons).length===0&&s.saved.length===0);
   assert.equal(JSON.stringify((await invoke('stats:raw')).blocks),before);record.confirmedScopedReset=true;
 }
 (results.learn??=[]).push(record);fs.writeFileSync(path.join(output,'learn-progress.json'),JSON.stringify(results.learn,null,2)+'\n');
 await page.getByRole('button',{name:t('Stats'),exact:true}).click();
};
