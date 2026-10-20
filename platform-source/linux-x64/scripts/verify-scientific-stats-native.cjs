// Extension of the existing guarded packaged-app harness; never opens a real profile.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,invoke,language,text,output,results})=>{
  const t=key=>text(language,key),record={language};
  await page.getByRole('heading',{name:t('Your study patterns'),exact:true}).waitFor();
  await page.getByRole('button',{name:t('Adjust filters'),exact:true}).click();
  await page.getByLabel(t('Dates'),{exact:true}).selectOption('all');
  await page.getByRole('button',{name:t('Close filters'),exact:true}).click();
  await require('./qa-stats-navigation.cjs')(page,t,'setup');
  const setup=page.locator('#stats-setup');
  await setup.getByRole('heading',{name:t('Recorded setup comparisons'),exact:true}).waitFor();
  assert.ok(!(await setup.innerText()).includes('My best sessions had in common'));
  assert.equal(await setup.locator('select').count(),2);
  const evidence=setup.locator('details').filter({has:page.locator('summary').filter({hasText:t('Evidence ·')})}).first();
  assert.ok(await evidence.count(),'Expected a matched setup comparison in the all-date fictional fixture: '+language);
  await evidence.locator('summary').click();
  assert.ok((await evidence.innerText()).includes(t('Sessions are averaged within each subject, activity and study day. Shared contexts are weighted by their smaller number of days.')));
  record.matchedEvidenceOpened=true;
  await require('./qa-stats-navigation.cjs')(page,t,'rhythm');
  const rhythm=page.locator('#stats-rhythm');
  await rhythm.getByRole('heading',{name:t('Returning to subjects'),exact:true}).scrollIntoViewIfNeeded();
  for(const key of ['Recent recorded activity','Returning to subjects','Subject visits do not prove spaced retrieval of the same material.'])assert.ok((await rhythm.innerText()).includes(t(key)),language+' missing '+key);
  await rhythm.getByRole('heading',{name:t('Recent recorded activity'),exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,language+'-scientific-rhythm.png')});
  await rhythm.getByRole('heading',{name:t('Returning to subjects'),exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,language+'-scientific-revisits.png')});
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dir:document.documentElement.dir}));
  assert.ok(layout.scroll<=layout.width+2);assert.equal(layout.dir,language==='ar'?'rtl':'ltr');record.layout=layout;
  await require('./qa-stats-navigation.cjs')(page,t,'insights');
  const shared=page.locator('#stats-insights [data-shared-evidence="true"]').first();
  assert.ok(await shared.count(),'Expected shared evidence in the all-date fictional fixture');
  await shared.getByRole('button',{name:t('How was this determined?'),exact:true}).click();
  const method=page.getByRole('dialog').locator('[data-shared-evidence-details]');await method.waitFor();
  assert.ok((await method.innerText()).includes(t('Sessions are averaged within each subject, activity and study day. Shared contexts are weighted by their smaller number of days.')));
  assert.ok(!(await method.innerText()).includes('three study days per side'));
  await method.locator('summary').click();
  assert.ok((await method.innerText()).includes(t('Matching does not remove unrecorded confounding. A screened association is not an established conclusion or proof of benefit.')));
  assert.ok((await method.innerText()).includes(t('Block length follows condition persistence, with day and week checks and two calendar origins. Long dependence and nonlinear time trends may remain; intervals are approximate.')));
  await page.screenshot({path:path.join(output,language+'-shared-evidence-help.png')});await page.getByRole('dialog').getByRole('button',{name:t('Done'),exact:true}).click();record.cardMethodUsesSharedContract=true;
  if(language==='en'){
    await require('./qa-stats-navigation.cjs')(page,t,'insights');
    const cards=page.locator('#stats-insights [data-insight-id]');
    const ids=await cards.evaluateAll(elements=>elements.map(e=>e.getAttribute('data-insight-id')));
    const id=ids.find(id=>!id.startsWith('distraction-')&&!id.startsWith('insight-period'));
    if(id){
      const chosen=page.locator('#stats-insights [data-insight-id]').filter({has:page.locator('[data-insight-card-bottom]')});
      // Choose by the observed ID, avoiding selectors composed from private labels.
      const index=ids.indexOf(id);await chosen.nth(index).getByRole('button',{name:t('Save finding'),exact:true}).click();
      const data=await invoke('tools:get'),saved=data.discoveries.find(d=>d.snapshot.id===id);
      assert.ok(saved?.snapshot.question,'Frozen question missing after IPC persistence');
      // New saved questions identify the current engine; historical questions
      // retain their original version and are tested separately in core tests.
      const expectedVersion=require('node:fs').readFileSync('src/core/evidence.ts','utf8').match(/EVIDENCE_VERSION = '([^']+)'/)[1];
      assert.equal(saved.snapshot.question.algorithmVersion,expectedVersion);
      await page.getByRole('button').filter({hasText:t('Saved findings (')}).click();
      const dialog=page.getByRole('dialog');
      assert.ok((await dialog.innerText()).includes(t('Not enough later comparison days')),'Saved original records were incorrectly treated as fresh evidence');
      await dialog.getByRole('button',{name:'Close '+t('Saved findings'),exact:true}).click();
      record.frozenQuestionSavedAndRead=true;
    }else record.frozenQuestionSavedAndRead=false;
  }
  (results.scientificStats??=[]).push(record);
};
