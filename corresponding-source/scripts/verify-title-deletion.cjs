const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/theme-qa.cjs');
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const catalogs=Object.fromEntries(languages.slice(1).map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const text=(l,key)=>catalogs[l]?.[key]||key;
const output=process.env.FOCUSRECALL_TITLE_QA_OUTPUT||'docs/verification/release-security-20261018/titles';
(async()=>{const results=[];let englishRoot;for(const language of languages){
 const q=await open({root:'out/qa-temp/security-titles-'+language+'-'+Date.now(),output,seedSettings:{foregroundTrackingTitlesEnabled:true}});
 try{
  if(language==='en')englishRoot=q.root;
  const {invoke,page}=q;await invoke('settings:set','language',language);await page.getByRole('button',{name:text(language,'Settings'),exact:true}).click();
  const before=await q.snapshot();const rows=await q.main.evaluate('({distractions:qaDb.prepare("SELECT * FROM distractions ORDER BY id").all(),rules:qaDb.prepare("SELECT * FROM app_rules ORDER BY id").all()})');
  assert.ok(before.activity.some(r=>r.window_title));
  const button=page.getByRole('button',{name:text(language,'Delete window titles'),exact:true});await button.scrollIntoViewIfNeeded();await button.focus();await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();await page.screenshot({path:path.join(output,language+'-confirmation.png')});
  await page.getByRole('dialog').getByRole('button',{name:text(language,'Cancel'),exact:true}).click();assert.deepEqual(await q.snapshot(),before);
  await button.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').getByRole('button',{name:text(language,'Delete window titles'),exact:true}).click();
  await page.getByText(text(language,'Window titles deleted. Title collection is off.'),{exact:true}).waitFor();
  const after=await q.snapshot();assert.deepEqual(after.blocks,before.blocks);assert.deepEqual(after.activity,before.activity.map(r=>({...r,window_title:null})));
  const extra=await q.main.evaluate('({distractions:qaDb.prepare("SELECT * FROM distractions ORDER BY id").all(),rules:qaDb.prepare("SELECT * FROM app_rules ORDER BY id").all()})');assert.deepEqual(extra.rules,rows.rules);assert.deepEqual(extra.distractions,rows.distractions.map(r=>({...r,window_title:null})));
  assert.equal((await invoke('settings:getAll')).foregroundTrackingTitlesEnabled,false);assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
  await page.screenshot({path:path.join(output,language+'-deleted.png')});
  await invoke('settings:set','language','en');
  const item=(await invoke('library:listPickerItems'))[0];await invoke('session:start',{itemId:item.id,timerMode:'flow',targetSeconds:600});
  await assert.rejects(()=>invoke('tracking:deleteTitles'));
  results.push({language,activityRows:before.activity.length,distractionRows:rows.distractions.length,cancelPreserved:true,historyPreserved:true,titleCollectionOff:true,activeWorkflowRejected:true,rendererErrors:q.errors,network:q.network});assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);
 }finally{await q.close()}
 }const reopened=await open({root:englishRoot,output,restart:true});try{assert.equal((await reopened.invoke('settings:getAll')).foregroundTrackingTitlesEnabled,false);assert.ok((await reopened.snapshot()).activity.every(row=>row.window_title===null));assert.equal(await reopened.main.evaluate('qaDb.prepare("SELECT COUNT(*) n FROM distractions WHERE window_title IS NOT NULL").get().n'),0);results.push({restartTitlesRemainDeleted:true,titleCollectionRemainsOff:true});}finally{await reopened.close()}
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log('PASS seven-language title deletion, cancellation and history preservation');})().catch(e=>{console.error(e.stack);process.exitCode=1});
