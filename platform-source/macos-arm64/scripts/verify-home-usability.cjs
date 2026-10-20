// Real packaged process, exclusively a marked fictional profile (including restart).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {open,pause}=require('./lib/theme-qa.cjs');
const langs=['en','ar','es','fr','zh-Hans','pt-BR','de'],catalogs=Object.fromEntries(langs.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const t=(l,k,v={})=>(catalogs[l][k]||k).replace(/\{(\w+)\}/g,(_,k)=>l==='ar'&&v[k]!=null?'\u2068'+v[k]+'\u2069':v[k]??'');
const root=process.env.FOCUSRECALL_HOME_QA_ROOT||'out/qa-temp/home-usability',output=process.env.FOCUSRECALL_HOME_QA_OUTPUT||'docs/verification/home-usability-20261018/packaged';
async function activate(page,target){await target.focus();await page.keyboard.press('Enter')}
let subjectIdsByName={};
const ids=async page=>(await page.locator('[role=listbox] button[role=option]').evaluateAll(els=>els.map(el=>el.querySelector('[dir=auto]')?.textContent.trim()))).map(name=>subjectIdsByName[name]);
const daySnapshot=q=>q.main.evaluate('Object.fromEntries(["day_checkins","day_log_values","day_group_notes"].map(t=>[t,qaDb.prepare("SELECT * FROM "+t+" ORDER BY rowid").all()]))');
(async()=>{
 let q=await open({root,output});const r={checks:[],languages:[],success:false,packaged:true,physicalClockChanged:false,archiveSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(q.exe),'resources/app.asar'))).digest('hex')};
 const history=await q.snapshot(),days=await daySnapshot(q);
 try{
  let {page,invoke}=q;
  await page.getByRole('combobox',{name:'Sort subjects',exact:true}).waitFor();
  const pref=await invoke('settings:getAll');assert.deepEqual(pref.homeSubjectOrdering,{mode:'recent',ids:[]});assert.equal(pref.showTodayCheck,true);assert.equal(pref.todayCheckSkippedDate,null);
  const picker=await invoke('library:listPickerItems');subjectIdsByName=Object.fromEntries(picker.map(i=>[i.name,i.id]));
  const oracleFile=path.resolve('out/qa-temp/home-order-oracle.cjs');require('esbuild').buildSync({entryPoints:['src/core/homePreferences.ts'],bundle:true,platform:'node',outfile:oracleFile,logLevel:'silent'});const core=require(oracleFile);
  const seconds=new Map();for(const b of await invoke('blocks:summaries'))seconds.set(b.itemId,(seconds.get(b.itemId)||0)+b.focusSeconds);
  assert.deepEqual(await ids(page),core.orderHomeSubjects(picker,pref.homeSubjectOrdering,seconds,'en').map(i=>i.id));r.checks.push('Upgrade retains exact legacy pinned/recent order and defaults; no subject metadata migration');
  for(const l of langs){
   await invoke('settings:set','language',l);await page.waitForFunction(l=>document.documentElement.lang===l,l);
   const sort=page.getByRole('combobox',{name:t(l,'Sort subjects'),exact:true});
   // Native select keyboard: Home selects recent; ArrowDown chooses alphabetic.
   await sort.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.waitForFunction(([label,value])=>[...document.querySelectorAll('select')].find(s=>s.getAttribute('aria-label')===label)?.value===value,[t(l,'Sort subjects'),'alphabetical']);
   await pause(50);assert.deepEqual(await ids(page),core.orderHomeSubjects(picker,{mode:'alphabetical',ids:[]},seconds,l).map(i=>i.id));
   await sort.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(([label,value])=>[...document.querySelectorAll('select')].find(s=>s.getAttribute('aria-label')===label)?.value===value,[t(l,'Sort subjects'),'most']);await pause(50);assert.deepEqual(await ids(page),core.orderHomeSubjects(picker,{mode:'most',ids:[]},seconds,l).map(i=>i.id));
   await sort.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(([label,value])=>[...document.querySelectorAll('select')].find(s=>s.getAttribute('aria-label')===label)?.value===value,[t(l,'Sort subjects'),'manual']);await pause(80);
   const before=await ids(page);await activate(page,page.getByRole('button',{name:t(l,'Arrange subjects'),exact:true}));
   const dialog=page.getByRole('dialog',{name:t(l,'Arrange subjects'),exact:true});await dialog.waitFor();
   const first=picker.find(i=>i.id===before[0]);await activate(page,dialog.getByRole('button',{name:t(l,'Move {name} down',{name:first.name}),exact:true}));
   const after=[before[1],before[0],...before.slice(2)];assert.deepEqual(await dialog.locator('[data-order-id]').evaluateAll(els=>els.map(el=>Number(el.dataset.orderId))),after);
   assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
   await activate(page,dialog.getByRole('button',{name:t(l,'Save order'),exact:true}));await dialog.waitFor({state:'detached'});assert.deepEqual(await ids(page),after);
   await page.reload();await page.getByRole('combobox',{name:t(l,'Sort subjects'),exact:true}).waitFor();assert.deepEqual(await ids(page),after);
   const geometry=await page.evaluate(label=>{const search=document.querySelector('input[aria-label]'),sort=[...document.querySelectorAll('select')].find(el=>el.getAttribute('aria-label')===label);const a=search.getBoundingClientRect(),b=sort.getBoundingClientRect();return {search:{x:a.x,y:a.y,w:a.width,right:a.right},sort:{x:b.x,y:b.y,w:b.width,right:b.right},rtl:document.documentElement.dir==='rtl',width:innerWidth,scroll:document.documentElement.scrollWidth}},t(l,'Sort subjects'));
   assert.ok(Math.abs(geometry.search.y-geometry.sort.y)<2,'Search and sorting share one row');assert.ok(geometry.rtl?geometry.sort.right<=geometry.search.x+1:geometry.sort.x>=geometry.search.right-1,'Sorting at logical end of search');assert.ok(geometry.scroll<=geometry.width+2);
   r.languages.push({language:l,sameSearchRow:true,sortAtLogicalEnd:true,keyboardSorts:true,manualMoveSaveReload:true,rtl:l==='ar',namesPreserved:true});console.log('CHECK '+l);
   if(l==='en'||l==='ar')await page.screenshot({path:path.join(q.output,l+'-home.png')});
  }
  const savedOrder=(await invoke('settings:getAll')).homeSubjectOrdering;
  await invoke('settings:set','language','en');
  // Date-only Chromium override plus explicit resume/focus event, not Windows clock manipulation.
  await page.clock.setFixedTime(new Date(2026,9,18,23,59,59));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  const skip=page.getByRole('button',{name:'Skip for today',exact:true});await activate(page,skip);await page.locator('[data-today-check]').waitFor({state:'detached'});assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
  assert.equal((await invoke('settings:getAll')).todayCheckSkippedDate,'2026-10-18');assert.deepEqual(await daySnapshot(q),days);
  await page.reload();await page.getByRole('combobox',{name:'Sort subjects',exact:true}).waitFor();assert.equal(await page.locator('[data-today-check]').count(),0);
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);await q.close();q=await open({root,output:path.join(output,'restarted'),restart:true});({page,invoke}=q);
  await page.getByRole('combobox',{name:'Sort subjects',exact:true}).waitFor();assert.deepEqual((await invoke('settings:getAll')).homeSubjectOrdering,savedOrder);assert.deepEqual(await ids(page),core.orderHomeSubjects(picker,savedOrder,seconds,'en').map(i=>i.id));
  await page.clock.setFixedTime(new Date(2026,9,18,23,59,59));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.locator('[data-today-check]').count(),0);
  await page.clock.setFixedTime(new Date(2026,9,19,0,0));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Skip for today',exact:true}).waitFor();
  r.checks.push('Custom order and same-day dismissal survive renderer reload AND actual packaged-process restart in the same fictional directory; simulated midnight makes Today Check eligible before the four-AM study boundary');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings pages',exact:true}).getByRole('button',{name:'General',exact:true}).click();
  const toggle=page.getByRole('switch',{name:'Show Today Check',exact:true});await activate(page,toggle);await page.waitForFunction(()=>document.querySelector('[role=switch][aria-label="Show Today Check"]')?.getAttribute('aria-checked')==='false');
  await page.getByRole('button',{name:'Home',exact:true}).click();assert.equal(await page.locator('[data-today-check]').count(),0);
  await page.clock.setFixedTime(new Date(2026,9,20,0,1));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.locator('[data-today-check]').count(),0);
  await invoke('settings:set','showTodayCheck',true);await page.getByRole('button',{name:'Skip for today',exact:true}).waitFor();
  const item=picker[0];await invoke('session:start',{itemId:item.id,timerMode:'flow',targetSeconds:1500});const running=(await invoke('session:get')).running;
  await invoke('settings:set','showTodayCheck',false);await invoke('settings:set','todayCheckSkippedDate','2026-10-20');await invoke('settings:set','homeSubjectOrdering',{mode:'alphabetical',ids:savedOrder.ids});
  const current=(await invoke('session:get')).running;assert.equal(current.id,running.id);assert.equal(current.focusStartedAt,running.focusStartedAt);assert.deepEqual(current.parts,running.parts);
  await invoke('session:finish');await invoke('session:discardFinished');await invoke('session:endSitting');
  r.checks.push('Permanent Settings preference wins across subsequent days; re-enabling allows the card; preference changes preserve the active session and all prior day answers/history');
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);await q.close();q=await open({root,output:path.join(output,'permanent-restarted'),restart:true});({page,invoke}=q);await page.getByRole('combobox',{name:'Sort subjects',exact:true}).waitFor();assert.equal((await invoke('settings:getAll')).showTodayCheck,false);assert.equal(await page.locator('[data-today-check]').count(),0);r.checks.push('Permanent hide also survives actual process restart');
  const now=await q.snapshot();for(const k of ['blocks','activity'])assert.deepEqual(now[k].filter(row=>history[k].some(old=>old.id===row.id)),history[k]);assert.deepEqual(await daySnapshot(q),days);assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);r.historyAndAnswersUnchanged=true;r.success=true;
 }finally{fs.writeFileSync(path.join(path.resolve(output),'runtime.json'),JSON.stringify(r,null,2)+'\n');await q.close()}
 console.log(JSON.stringify(r,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
