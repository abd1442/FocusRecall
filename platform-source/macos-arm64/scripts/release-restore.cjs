// Real controlled-relaunch restore in the diagnostic fictional profile only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const root=path.resolve(process.argv[2]||'out/qa-temp/security-release-20261015'),resultsFile=path.join(root,'runtime-results.json');
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep),'Disposable QA root required');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(port,pick){
 const targets=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)}).then(r=>r.json()),target=targets.find(pick);if(!target)throw Error('Target not ready');
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 const evaluate=async expression=>{const r=await new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 return {evaluate,close:()=>ws.close()};
}
(async()=>{
 const results=JSON.parse(fs.readFileSync(resultsFile,'utf8')),backup=new Database(results.backup,{readonly:true});
 const expectedGoal=JSON.parse(backup.prepare("SELECT value FROM settings WHERE key='nextGoal'").get().value),expectedBlocks=backup.prepare('SELECT COUNT(*) AS n FROM blocks').get().n;backup.close();
 const main=await connect(9341,()=>true);assert.equal(await main.evaluate('process.env.LEARNALYT_DATA_DIR'),root);const oldPid=await main.evaluate('process.pid');main.close();
 const page=await connect(9340,t=>t.url.endsWith('/out/renderer/index.html'));assert.equal(await page.evaluate("window.api.invoke('app:demo')"),true);
 await page.evaluate(`window.api.invoke('backup:restore',${JSON.stringify(results.restoreToken)})`);page.close();
 let restarted=false;
 for(let i=0;i<40;i++){
  await delay(750);let nextMain,nextPage;
  try {
   nextMain=await connect(9341,()=>true);const pid=await nextMain.evaluate('process.pid');if(pid===oldPid)continue;
   assert.equal(await nextMain.evaluate('process.env.LEARNALYT_DATA_DIR'),root);
   nextPage=await connect(9340,t=>t.url.endsWith('/out/renderer/index.html'));
   assert.equal(await nextPage.evaluate("window.api.invoke('settings:getAll').then(s=>s.nextGoal)"),expectedGoal);
   assert.equal(await nextPage.evaluate("window.api.invoke('stats:raw').then(r=>r.blocks.length)"),expectedBlocks);
   const safety=path.join(root,'backups/learnalyt-demo.db/safety');assert.ok(fs.readdirSync(safety).some(f=>f.endsWith('.db')));
   const safetyFile=fs.readdirSync(safety).find(f=>f.endsWith('.db')),saved=new Database(path.join(safety,safetyFile),{readonly:true});assert.equal(JSON.parse(saved.prepare("SELECT value FROM settings WHERE key='nextGoal'").get().value),'Restore must remove this later change');saved.close();
   results.restoreRelaunch='passed';results.safetyBackupPreservedNewerState=true;results.restoredBlocks=expectedBlocks;results.newPid=pid;delete results.restoreToken;fs.writeFileSync(resultsFile,JSON.stringify(results,null,2));fs.writeFileSync(path.join(root,'pid.txt'),String(pid));restarted=true;break;
  }catch(error){if(i===39)throw error}finally{nextPage?.close();nextMain?.close()}
 }
 assert.ok(restarted);console.log('PASS actual controlled restore/relaunch, retained history and newer-state safety snapshot. Native pickers were stubbed; no real profile touched.');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
