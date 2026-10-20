// Current-theme captures in a new fictional profile. Never overwrites public screenshots.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {open,pause}=require('./lib/theme-qa.cjs');
const root=process.env.FOCUSRECALL_CAPTURE_QA_ROOT||'out/qa-temp/public-appearance-theme-system',output=process.env.FOCUSRECALL_CAPTURE_OUTPUT||'docs/verification/theme-integration-20261018/public-appearance';
(async()=>{
 const q=await open({root,output});const {page,invoke}=q;let original;
 try{
  assert.equal(await invoke('app:demo'),true);assert.equal((await invoke('settings:getAll')).foregroundTrackingEnabled,false);
  original=await invoke('appearance:get');await page.getByRole('button',{name:'Home',exact:true}).click();
  const shots=[];
  for(const [file,mode,lightTheme,darkTheme,navTone,roundness,label]of [
   ['appearance-ivory-rounded','light','ivory-ink','ink-dim','theme',1,'Ivory & Ink, rounded corners'],
   ['appearance-ivory-straight','light','ivory-ink','ink-dim','theme',0,'Ivory & Ink, straight corners'],
   ['appearance-ink-dim','dark','ivory-ink','ink-dim','theme',1,'Ink Dim, approved default dark'],
   ['appearance-graphite','dark','graphite','graphite-night','theme',1,'Graphite Night'],
   ['appearance-light-sidebar','dark','ivory-ink','ink-dim','inverse',1,'Light sidebar with dark workspace'],
   ['appearance-dark-sidebar','light','ivory-ink','ink-dim','inverse',1,'Dark sidebar with light workspace'],
   ['appearance-library','light','library','espresso','theme',1,'Library'],
   ['appearance-deep-sea','dark','lagoon','deep-sea','theme',1,'Deep Sea']
  ]){
   await invoke('appearance:set',{...original,lightTheme,darkTheme,mode,roundness,navTone,stageOverrides:{light:{},dark:{}},surfaceOverrides:{light:{},dark:{}},focusIsAccent:false,highContrast:false,uiScale:1});
   const expected=mode==='dark'?darkTheme:lightTheme;await page.waitForFunction(id=>document.documentElement.dataset.frTheme===id,expected);await pause(150);
   const bytes=await page.screenshot({path:path.join(q.output,file+'.png')});shots.push({file:file+'.png',description:label+' — actual packaged '+require('../package.json').version+', fictional records',theme:expected,mode,navTone,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);
  fs.writeFileSync(path.join(q.output,'manifest.json'),JSON.stringify({executable:q.exe,archiveSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(q.exe),'resources/app.asar'))).digest('hex'),fictionalProfile:q.root,screenshots:shots},null,2)+'\n');console.log('PASS '+shots.length+' current appearance captures; new fictional profile only.');
 }finally{if(original)await invoke('appearance:set',original).catch(()=>{});await q.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
