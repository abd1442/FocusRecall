// Actual separately packaged QA app; fresh fictional data only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/timer-qa.cjs');
const stamp=Date.now(),root='out/qa-temp/home-calendar-'+stamp,output=path.resolve('docs/verification/home-calendar-20261021/'+stamp);
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'];
const catalogs=Object.fromEntries(languages.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8'))]));
const t=(l,key)=>catalogs[l][key]||key;
const win="qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/out/renderer/index.html'))";
let q;const checks=[];
async function appearance(patch){await q.invoke('appearance:set',{...await q.invoke('appearance:get'),...patch});await pause(100)}
async function bounds(){return q.page.evaluate(()=>{
 const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
 const scroller=document.querySelector('.home-scroll');
 return {root:box('.home-root'),footer:box('.home-calendar'),map:box('.home-calendar section'),scroll:box('.home-scroll'),overflow:document.documentElement.scrollWidth>innerWidth+1,scrollable:scroller.scrollHeight>scroller.clientHeight,position:scroller.scrollTop};
})}
async function checkLayout(language,width,height,uiScale){
 await q.invoke('settings:set','language',language);await appearance({uiScale});
 await q.main.evaluate(`(()=>{${win}.setContentSize(${width},${height});return true})()`);await pause(100);
 const before=await bounds();assert.ok(!before.overflow,JSON.stringify(before));assert.ok(before.scroll.height>65,'Subject area remains usable');
 assert.ok(Math.abs(before.footer.bottom-before.root.bottom)<2,'Calendar stays at the bottom');
 assert.ok(before.footer.width>before.root.width-2,'Calendar footer spans both columns');
 await q.page.locator('.home-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);await pause(50);
 const after=await bounds();assert.ok(after.position>0,'Fixture really scrolled');assert.ok(Math.abs(before.footer.y-after.footer.y)<1,'Footer does not move while scrolling');
 const grid=q.page.getByRole('grid',{name:t(language,'Study activity calendar'),exact:true});
 assert.equal(await grid.locator('button[tabindex="0"]:not(:disabled)').count(),1,'Calendar has one keyboard entry');
 const day=grid.locator('button[tabindex="0"]');await day.focus();await q.page.keyboard.press(language==='ar'?'ArrowRight':'ArrowLeft');
 assert.equal(await grid.evaluate(e=>e.contains(document.activeElement)),true);
 checks.push({language,width,height,uiScale,bottomFixed:true,fullWidth:true,keyboard:true});
}
(async()=>{try{
 q=await open({root,output});await q.invoke('settings:set','starterGuideCompleted',true);
 const skip=q.page.getByRole('button',{name:'Skip guide',exact:true});if(await skip.count())await skip.click();
 await q.invoke('settings:set','studyExperience','full');await q.invoke('settings:set','showTodayCheck',false);
 const category=await q.invoke('library:createCategory',{name:'Fictional study',color:'#4C989C',icon:null,parentId:null});
 const subjects=[];
 for(let i=0;i<55;i++)subjects.push(await q.invoke('library:createItem',{categoryId:category.id,name:i===0?'Biology':i===1?'التاريخ — مقارنة روايتين من مصادر مختلفة ومراجعة الأدلة':'Reading — chapter '+(i+1),color:'#4C989C',defaultUnit:'pages',totalUnits:null,notesTargetType:'none',notesTarget:null,notesVault:null,priorKnowledge:'some',buildsOn:[],hoursBefore:0,newField:false}));
 await q.main.evaluate(`(()=>{const d=new(qaRequire('better-sqlite3'))(${JSON.stringify(path.resolve(root,'learnalyt.db'))});try{d.prepare('INSERT INTO parked_thoughts(created_at,text,done) VALUES(?,?,?)').run('2026-10-19','Fictional legacy note',1);d.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('hotkeyPark',JSON.stringify('F7'));return true}finally{d.close()}})()`);
 const old=await q.main.evaluate('qaDb.prepare("SELECT * FROM parked_thoughts").all()');
 await q.page.getByRole('button',{name:'Home',exact:true}).click();
 assert.equal(await q.page.getByRole('region',{name:'Parked thoughts',exact:true}).count(),0);
 for(const l of languages)for(const size of [[800,600,1],[1280,800,1],[1920,1080,1],[1000,720,1.5],[1280,800,2]])await checkLayout(l,...size);
 await q.invoke('settings:set','language','en');await appearance({uiScale:1});
 const seeds=[...fs.readFileSync('src/core/themeSeeds.ts','utf8').matchAll(/\{"id":"([^"]+)","name":"[^"]+","mode":"([^"]+)"/g)].map(m=>({id:m[1],mode:m[2]}));assert.equal(seeds.length,26);
 for(const theme of seeds){await appearance({mode:theme.mode,[theme.mode+'Theme']:theme.id});const b=await bounds();assert.ok(Math.abs(b.footer.bottom-b.root.bottom)<2);checks.push({theme:theme.id,bottomFixed:true})}
 for(const [name,mode,width,height,lang]of [['home-light','light',1440,1000,'en'],['home-dark','dark',1440,1000,'en'],['home-compact','light',800,600,'en'],['home-arabic','dark',1280,800,'ar']]){
  await q.invoke('settings:set','language',lang);await appearance({mode,lightTheme:'ivory-ink',darkTheme:'ink-dim',uiScale:1});await q.main.evaluate(`(()=>{${win}.setContentSize(${width},${height});return true})()`);await q.page.locator('.home-scroll').evaluate(e=>e.scrollTop=0);await pause(150);await q.page.screenshot({path:path.join(output,name+'.png')});
 }
 await q.invoke('settings:set','language','en');await appearance({uiScale:1});
 // Real elapsed pauses, in both modes: record time without opening a reason popup.
 for(const mode of ['quick','full']){
  await q.invoke('settings:set','studyExperience',mode);await q.invoke('session:start',{itemId:subjects[0].id,timerMode:'flow',targetSeconds:1500});await pause(1200);
  await q.invoke('session:toggleDistracted');await pause(1600);await q.invoke('session:toggleDistracted');await pause(400);
  const popups=await q.main.evaluate("qaElectron.BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('#reasons')).map(w=>w.isVisible())");assert.ok(popups.every(v=>!v));
  const d=await q.main.evaluate('qaDb.prepare("SELECT duration_seconds FROM distractions ORDER BY id DESC LIMIT 1").get()');assert.ok(d.duration_seconds>=1.5&&d.duration_seconds<4);
  await q.invoke('session:finish');if(mode==='full'){const s=await q.invoke('session:get');assert.equal(s.stage,'recall');await q.invoke('session:leaveWorkflow',s.finished[0].sessionId);await q.invoke('session:endSitting')}
  checks.push({mode,noResumePrompt:true,realPausedSeconds:d.duration_seconds});
 }
 assert.deepEqual(await q.main.evaluate('qaDb.prepare("SELECT * FROM parked_thoughts").all()'),old);
 const backup=path.resolve(root,'fictional-retained-legacy.db');await q.main.evaluate(`qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(backup)}});true`);await q.invoke('backup:create');
 const backed=await q.main.evaluate(`(()=>{const d=new(qaRequire('better-sqlite3'))(${JSON.stringify(backup)},{readonly:true});try{return d.prepare('SELECT * FROM parked_thoughts').all()}finally{d.close()}})()`);assert.deepEqual(backed,old);
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);await q.close();q=await open({root,output:path.join(output,'restart'),restart:true});
 assert.deepEqual(await q.main.evaluate('qaDb.prepare("SELECT * FROM parked_thoughts").all()'),old);assert.ok(!(await q.invoke('settings:getAll')).hotkeyPark);
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({success:true,checks,legacyRecordsPreservedInBackupAndRestart:true,simulatedUiScaling:true,physicalDpiNotTested:true},null,2));console.log('PASS '+checks.length+' packaged cases; '+output);
}catch(e){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.stack,checks},null,2));console.error(e);process.exitCode=1}finally{await q?.close()}})();
