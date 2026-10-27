const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{open}=require('./lib/theme-qa.cjs');
const root='out/qa-temp/redaction-lifecycle-packaged-'+Date.now(),output=process.env.FOCUSRECALL_TITLE_LIFECYCLE_OUTPUT||'docs/verification/audit-blockers-20261018/title-lifecycle';
let q;const results={};
async function snapshot(){return q.main.evaluate('({ds:qaDb.prepare("SELECT * FROM distractions ORDER BY id").all(),sessions:qaDb.prepare("SELECT * FROM sessions ORDER BY id").all(),blocks:qaDb.prepare("SELECT * FROM blocks ORDER BY id").all(),redactions:qaDb.prepare("SELECT * FROM window_title_redactions ORDER BY id").all()})')}
async function write(sql){return q.main.evaluate('(()=>{const db=new(qaRequire("better-sqlite3"))('+JSON.stringify(path.resolve(root,'learnalyt-demo.db'))+');try{db.exec('+JSON.stringify(sql)+');return true}finally{db.close()}})()')}
async function backup(name){const target=path.resolve(root,name+'.db');await q.main.evaluate('qaElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:'+JSON.stringify(target)+'});true');assert.ok(await q.invoke('backup:create'));return target}
async function restore(file){
 await q.main.evaluate('qaDb.close();qaElectron.app.relaunch=()=>{};qaElectron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:['+JSON.stringify(file)+']});true');
 const chosen=await q.invoke('backup:inspectRestore');await q.invoke('backup:restore',chosen.token).catch(()=>{});await q.close();q=await open({root,output,restart:true});
}
(async()=>{q=await open({root,output});try{
 const item=(await q.invoke('library:listPickerItems'))[0];
 await write(`INSERT INTO sittings(id,started_at,ended_at) VALUES(90000,'2026-10-18T08:00:00Z','2026-10-18T09:00:00Z');
 INSERT INTO sessions(id,sitting_id,started_at,ended_at) VALUES(90000,90000,'2026-10-18T08:00:00Z','2026-10-18T09:00:00Z');
 INSERT INTO blocks(id,sitting_id,session_id,item_id,target_seconds,focus_started_at,focus_ended_at,focus_seconds,last_heartbeat_at,log_status) VALUES(90000,90000,90000,${item.id},3600,'2026-10-18T08:00:00Z','2026-10-18T09:00:00Z',3600,'2026-10-18T09:00:00Z','done');
 INSERT INTO window_activity(block_id,stage,started_at,ended_at,process_name,window_title) VALUES
 (90000,'focus','2026-10-18T08:00:00Z','2026-10-18T08:20:00Z','msedge','Fictional notes'),
 (90000,'focus','2026-10-18T08:20:00Z','2026-10-18T08:35:00Z','msedge','FictionalTitleBlockerVideo'),
 (90000,'focus','2026-10-18T08:35:00Z','2026-10-18T09:00:00Z','msedge','Fictional notes');`);
 await q.invoke('rules:save',{matchType:'title',pattern:'FictionalTitleBlockerVideo',classification:'distraction'});
 const original=await snapshot();assert.ok(original.ds.some(d=>d.block_id===90000&&d.source==='auto'&&d.confirmed===0&&d.duration_seconds===900));const beforeBackup=await backup('before-redaction');
 await write("CREATE TRIGGER fail_title_delete BEFORE UPDATE ON distractions BEGIN SELECT RAISE(ABORT,'fictional storage failure'); END;");
 await assert.rejects(()=>q.invoke('tracking:deleteTitles'));assert.deepEqual(await snapshot(),original);results.transactionRollback=true;await write('DROP TRIGGER fail_title_delete;');
 await q.invoke('tracking:deleteTitles');const redacted=await snapshot();assert.deepEqual(redacted.ds,original.ds.map(d=>({...d,window_title:null})));assert.deepEqual(redacted.sessions,original.sessions);assert.deepEqual(redacted.blocks,original.blocks);
 const rule=(await q.invoke('rules:save',{matchType:'process',pattern:'msedge',classification:'study'})).find(r=>r.matchType==='process'&&r.pattern==='msedge');await q.invoke('rules:delete',rule.id);
 assert.deepEqual(await snapshot(),redacted);results.ruleEditsPreserveHistory=true;
 await assert.rejects(()=>q.invoke('distraction:alwaysIgnore',redacted.ds.find(d=>d.block_id===90000).id));assert.deepEqual(await snapshot(),redacted);results.noInventedBrowserRule=true;
 const afterBackup=await backup('after-redaction');await q.close();q=await open({root,output,restart:true});assert.deepEqual(await snapshot(),redacted);results.restartPreserves=true;
 await restore(beforeBackup);assert.deepEqual(await snapshot(),original);results.preDeletionRestoreRetainsOriginalEvidence=true;
 await restore(afterBackup);assert.deepEqual(await snapshot(),redacted);await q.invoke('rules:save',{matchType:'title',pattern:'FictionalTitleBlockerVideo',classification:'ignore'});assert.deepEqual(await snapshot(),redacted);results.redactedRestorePreserves=true;
 await write('UPDATE blocks SET focus_ended_at=NULL WHERE id=90000; UPDATE sessions SET ended_at=NULL WHERE id=90000;');
 await q.close();q=await open({root,output,restart:true});assert.ok((await q.invoke('session:get')).recovery);await q.invoke('session:resolveRecovery','end');
 const recovered=await snapshot();assert.deepEqual(recovered.ds,redacted.ds);assert.equal(recovered.sessions.find(s=>s.id===90000).window_switches,redacted.sessions.find(s=>s.id===90000).window_switches);results.recoveryPreserves=true;
 await q.page.getByRole('button',{name:'History',exact:true}).click();
 const card=q.page.locator('#history-session-90000');await card.getByRole('button',{name:'View session',exact:true}).click();
 const disclosure='Window-title evidence is unavailable or incomplete. Automatic detections and switch counts stay as recorded; later rules do not reclassify this history. You can still edit individual distractions.';
 await card.getByText(disclosure,{exact:true}).waitFor();const appearance=await q.invoke('appearance:get');
 for(const [language,mode] of [['en','light'],['ar','dark']]){
   await q.invoke('settings:set','language',language);await q.invoke('appearance:set',{...appearance,mode});
   await q.page.locator('#history-details-90000').scrollIntoViewIfNeeded();await q.page.screenshot({path:path.join(output,'history-'+language+'-'+mode+'.png')});
 }
 results.visibleHistoryDisclosure=true;
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);results.success=true;console.log('PASS packaged deletion/rules/restart/rollback/backup restoration lifecycle');
 }finally{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));await q?.close()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
