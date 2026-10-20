const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {open}=require('./lib/theme-qa.cjs');
(async()=>{
 const suffix=process.env.FINAL_STATS_NATIVE_SUFFIX??'02';assert.match(suffix,/^[0-9]+$/);
 const seed='out/qa-temp/final-stats-method-seed-'+suffix,output='docs/verification/statistical-reliability-20261018/methods-'+suffix;assert.ok(!fs.existsSync(seed));fs.mkdirSync(seed,{recursive:true});
 fs.writeFileSync(path.join(seed,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');fs.copyFileSync('out/qa-temp/brand-upgrade-beta24/learnalyt-demo.db',path.join(seed,'learnalyt-demo.db'));
 cp.execFileSync('python',['-c',`import sqlite3,json,sys\nd=sqlite3.connect(sys.argv[1]); fields=dict(d.execute('SELECT key,id FROM log_fields'));rows=d.execute('SELECT id FROM blocks ORDER BY id').fetchall()\nfor i,(bid,) in enumerate(rows):\n method='re-reading' if i%2==0 else 'self-testing'; rating=5 if i%2==0 else 3\n d.execute('INSERT OR REPLACE INTO block_log_values(block_id,field_id,value,touched) VALUES(?,?,?,1)',(bid,fields['methods'],json.dumps([method])))\n d.execute('INSERT OR REPLACE INTO block_log_values(block_id,field_id,value,touched) VALUES(?,?,?,1)',(bid,fields['focus'],json.dumps(rating)))\n d.execute('UPDATE blocks SET recall_rating=?,recall_rating_touched=1 WHERE id=?',(rating,bid))\nd.commit();d.close()`,path.resolve(seed,'learnalyt-demo.db')],{windowsHide:true});
 const q=await open({root:'out/qa-temp/final-stats-methods-native-'+suffix,output,seedDirectory:seed}),{page,invoke}=q,before=await q.snapshot(),results={languages:[],checks:[]};
 try{
  const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];const catalogs=Object.fromEntries(languages.filter(l=>l!=='en').map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
  const appearance=await invoke('appearance:get');
  for(const [index,language]of languages.entries()){
   const t=key=>catalogs[language]?.[key]??key;
   await invoke('settings:set','language',language);
   const dark=index%2===1;await invoke('appearance:set',{...appearance,mode:dark?'dark':'light',lightTheme:'ivory-ink',darkTheme:language==='ar'?'darkroom':'deep-sea'});
   await page.getByRole('button',{name:t('Stats'),exact:true}).click();await require('./qa-stats-navigation.cjs')(page,t,'methods');
   // All dates, through visible filters, never inject renderer analysis results.
   const filters=page.getByRole('button',{name:t('Adjust filters'),exact:true});await filters.click();await page.getByLabel(t('Dates'),{exact:true}).selectOption('all');
   if(language==='en'){
    const prior=await invoke('tools:get');
    await require('./qa-stats-navigation.cjs')(page,t,'insights');
    await page.waitForFunction(()=>document.querySelector('[data-stats-analysis]')?.getAttribute('aria-busy')==='false');
    const cards=page.locator('#stats-insights [data-shared-evidence="true"]').filter({has:page.getByRole('button',{name:'Save finding',exact:true})});
    const ids=await cards.evaluateAll(es=>es.map(e=>e.getAttribute('data-insight-id')));
    const index=ids.findIndex(id=>!id.startsWith('insight-period'));assert.ok(index>=0,'Planted fictional ratings must provide a supported question to save');
    await cards.nth(index).getByRole('button',{name:'Save finding',exact:true}).click();
    const saved=await invoke('tools:get'),record=saved.discoveries.find(d=>d.snapshot.id===ids[index]);assert.equal(record?.snapshot.question?.algorithmVersion,'matched-context-episodes-v3');
    for(const old of prior.discoveries)if(old.snapshot.id!==ids[index])assert.deepEqual(saved.discoveries.find(d=>d.key===old.key),old);
    results.newFrozenQuestionSaved=true;results.oldSavedQuestionsPreserved=true;
   }
   await require('./qa-stats-navigation.cjs')(page,t,'methods');
   const section=page.locator('#stats-methods'),picker=section.getByRole('combobox');
   if(language==='en'){
    await page.getByRole('button',{name:'Saved views',exact:true}).click();
    await page.getByLabel('Comparison view name',{exact:true}).fill('Fictional recorded duration');
    await page.getByLabel('Saved view outcome',{exact:true}).selectOption('length');
    await page.getByRole('button',{name:'Save current view',exact:true}).click();
    const row=page.locator('#stats-tools div.rounded-xl').filter({has:page.getByText('Fictional recorded duration',{exact:true})}).filter({has:page.getByRole('button',{name:'Open view',exact:true})});
    await row.getByRole('button',{name:'Open view',exact:true}).click();await page.getByLabel('Close Stats companion',{exact:true}).click();
    await require('./qa-stats-navigation.cjs')(page,t,'methods');assert.equal(await picker.inputValue(),'length');
    assert.ok(await section.getByText('Session length',{exact:true}).count());assert.equal(await section.locator('[data-method-observation]').getByText('Self-rated focus',{exact:true}).count(),0);
    results.restoredRecordedDurationLabelCorrect=true;
   }
   await picker.selectOption('recall');await section.locator('[data-method-observation]').first().waitFor();
   assert.ok(await section.getByText(t('Immediate self-rated recall'),{exact:true}).count());
   const rows=section.locator('[data-method-observation]');assert.ok(await rows.count()>=2);
   assert.equal(await rows.locator('.bg-rest,[class*="tf-line-detected"]').count(),0);
   assert.equal(await rows.getByText(t('Exploratory association'),{exact:true}).count(),0);
   assert.ok((await section.innerText()).includes(t('Re-reading')));
   await section.getByRole('heading',{name:t('Methods'),exact:true,level:2}).scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(output,language+'-methods-overview.png')});
   await rows.last().locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await rows.last().locator('details').getAttribute('open'),'');
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dir:document.documentElement.dir}));assert.ok(layout.scroll<=layout.width+2);assert.equal(layout.dir,language==='ar'?'rtl':'ltr');
   await page.screenshot({path:path.join(output,language+'-methods-recall.png')});
   for(const value of ['understanding','focus'])await picker.selectOption(value);
   results.languages.push({language,rows:await rows.count(),layout,keyboardDetails:true,noSuperiorityColorsOrBadges:true});
   await page.getByRole('button',{name:t('Home'),exact:true}).click();
  }
  assert.deepEqual(await q.snapshot(),before);assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);results.historyUnchanged=true;results.rendererErrors=[];results.network=[];results.success=true;
 }catch(e){results.failure=e.message;results.body=(await page.locator('body').innerText()).slice(0,14000);await page.screenshot({path:path.join(output,'failure.png')});throw e}finally{fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(results,null,2)+'\n');await q.close()}
 console.log(JSON.stringify(results));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
