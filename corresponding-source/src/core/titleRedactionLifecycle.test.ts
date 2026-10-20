import {it,expect,vi} from 'vitest'
import {mkdtempSync,rmSync} from 'node:fs'
import {resolve,join,sep} from 'node:path'
import {openDatabase,type Db} from '../main/db/database'
import {migrations} from '../main/db/migrations'
import {snapshot,prepareRestore,installPendingRestore} from '../main/db/backups'
import {DistractionRepo} from '../main/repos/distractions'
import {SessionRepo} from '../main/repos/sessions'
import {SessionEngine} from '../main/session'
import {LogRepo} from '../main/repos/logs'
import {CaptureRepo} from '../main/repos/captures'
import {SettingsRepo} from '../main/repos/settings'
const t=(minute:number)=>new Date(Date.UTC(2026,9,18,8,minute)).toISOString()
function seed(db:Db,session:number|null=100,derive=true):DistractionRepo{
 db.exec(`INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Fictional','#123456',0,'2026-10-18');
 INSERT INTO items(id,category_id,name,color,created_at) VALUES(100,100,'Fictional','#123456','2026-10-18'),(101,100,'Second fictional subject','#123456','2026-10-18');
 INSERT INTO sittings(id,started_at) VALUES(100,'${t(0)}');`)
 if(session!==null)db.prepare('INSERT INTO sessions(id,sitting_id,started_at,ended_at) VALUES(100,100,?,?)').run(t(0),t(60))
 db.prepare('INSERT INTO blocks(id,sitting_id,session_id,item_id,target_seconds,focus_started_at,focus_ended_at,focus_seconds,last_heartbeat_at) VALUES(100,100,?,100,3600,?,?,3600,?)').run(session,t(0),t(60),t(60))
 const insert=db.prepare("INSERT INTO window_activity(block_id,stage,started_at,ended_at,process_name,window_title) VALUES(100,'focus',?,?,?,?)")
 insert.run(t(0),t(20),'msedge','Fictional course notes');insert.run(t(20),t(35),'msedge','Fictional video - YouTube - Microsoft Edge');insert.run(t(35),t(60),'msedge','Fictional course notes')
 const repo=new DistractionRepo(db)
 if(derive){repo.deriveAuto([100]);if(session!==null)repo.refreshSessionStats(session)}
 else db.prepare("INSERT INTO distractions(block_id,started_at,at_offset_seconds,duration_seconds,source,kind,app_name,window_title,confirmed) VALUES(100,?,1200,900,'auto','website','msedge','Fictional video - YouTube',0)").run(t(20))
 return repo
}
const rows=(db:Db)=>db.prepare('SELECT * FROM distractions ORDER BY id').all() as Record<string,unknown>[]
it.each([false,true])('retains title-derived detections and all stored totals after rule edits, direct derivation and refresh (confirmed=%s)',confirmed=>{
 const db=openDatabase(':memory:'),repo=seed(db);if(confirmed)db.exec('UPDATE distractions SET confirmed=1')
 const before=rows(db),stats=db.prepare('SELECT * FROM sessions').all();expect(before).toHaveLength(1)
 repo.deleteWindowTitles();repo.saveRule({matchType:'process',pattern:'msedge',classification:'study'});repo.rederiveAll();repo.deriveAuto([100]);repo.refreshSessionStats(100)
 expect(rows(db)).toEqual(before.map(r=>({...r,window_title:null})));expect(db.prepare('SELECT * FROM sessions').all()).toEqual(stats)
 expect(repo.windowHistoryFrozen([100])).toBe(true)
 expect(()=>repo.alwaysIgnore(Number(before[0].id))).toThrow('original website title')
 repo.confirm(Number(before[0].id));expect(rows(db)[0].confirmed).toBe(1);db.close()
})
it('keeps protection across estimated subject splits, including legacy session-less parts',()=>{
 for(const legacy of [false,true]){
  const db=openDatabase(':memory:'),repo=seed(db,legacy?null:100);repo.deleteWindowTitles()
  const parts=new SessionRepo(db).splitPart(100,[101]);repo.deriveAuto(parts);repo.rederiveAll()
  expect(parts.every(part=>repo.windowHistoryFrozen([part]))).toBe(true);expect(rows(db)).toHaveLength(1);expect(rows(db)[0].duration_seconds).toBe(900)
  if(!legacy){repo.refreshSessionStats(100);expect((db.prepare('SELECT window_switches n FROM sessions').get() as {n:number}).n).toBe(2)}db.close()
 }
})
it('rolls provenance back with both title tables when an update fails',()=>{
 const db=openDatabase(':memory:'),repo=seed(db),before=rows(db)
 db.exec("CREATE TRIGGER abort_redaction BEFORE UPDATE ON distractions BEGIN SELECT RAISE(ABORT,'fictional disk failure'); END")
 expect(()=>repo.deleteWindowTitles()).toThrow();expect(rows(db)).toEqual(before)
 expect(db.prepare('SELECT COUNT(*) n FROM window_title_redactions').get()).toEqual({n:0});expect(repo.windowHistoryFrozen([100])).toBe(false);db.close()
})
it('restores provenance with backups, preserves it after restart, and leaves pre-deletion backups independent',()=>{
 const base=resolve('out/qa-temp'),folder=mkdtempSync(join(base,'redaction-backup-')),file=join(folder,'study.db');let db=openDatabase(file)
 try{
  let repo=seed(db);snapshot(db,join(folder,'before.db'));repo.deleteWindowTitles();const kept=rows(db);snapshot(db,join(folder,'after.db'));db.close()
  db=openDatabase(file);repo=new DistractionRepo(db);repo.rederiveAll();expect(rows(db)).toEqual(kept)
  prepareRestore(db,file,join(folder,'before.db'));db.close();db=installPendingRestore(file,openDatabase)!;repo=new DistractionRepo(db);expect(repo.windowHistoryFrozen([100])).toBe(false);expect(rows(db)[0].window_title).toContain('YouTube')
  prepareRestore(db,file,join(folder,'after.db'));db.close();db=installPendingRestore(file,openDatabase)!;repo=new DistractionRepo(db);repo.saveRule({matchType:'process',pattern:'msedge',classification:'ignore'});repo.rederiveAll();expect(rows(db)).toEqual(kept);expect(repo.windowHistoryFrozen([100])).toBe(true)
 }finally{if(db.open)db.close();if(!resolve(folder).startsWith(base+sep))throw Error('Unsafe cleanup');rmSync(folder,{recursive:true,force:true})}
})
it('migrates prior NULL-title deletion without guessing original titles, but keeps app-only empty-title histories reclassifiable',()=>{
 const base=resolve('out/qa-temp'),folder=mkdtempSync(join(base,'redaction-legacy-'))
 try{for(const missing of [null,'']){
  const file=join(folder,missing===null?'redacted.db':'app-only.db');let db=openDatabase(file,{migrationList:migrations.filter(m=>m.version<=13)})
  seed(db,100,false);db.prepare('UPDATE window_activity SET window_title=?').run(missing);db.prepare('UPDATE distractions SET window_title=?').run(missing);const before=rows(db);db.close()
  db=openDatabase(file);const repo=new DistractionRepo(db);expect(repo.windowHistoryFrozen([100])).toBe(missing===null)
  if(missing===null){repo.rederiveAll();expect(rows(db)).toEqual(before)}db.close()
 }}finally{if(!resolve(folder).startsWith(base+sep))throw Error('Unsafe cleanup');rmSync(folder,{recursive:true,force:true})}
})
it('recovery and part completion never regenerate automatic evidence from redacted titles',()=>{
 vi.useFakeTimers();const db=openDatabase(':memory:'),repo=seed(db);repo.deleteWindowTitles();const before=rows(db)
 db.exec('UPDATE blocks SET focus_ended_at=NULL; UPDATE sessions SET ended_at=NULL')
 const engine=new SessionEngine(new SessionRepo(db),new LogRepo(db),repo,new CaptureRepo(db),new SettingsRepo(db),()=>[],()=>Date.parse(t(70)),()=>0)
 try{
  engine.on('partEnded',({blockId})=>repo.deriveAuto([blockId]));expect(engine.get().recovery).toBeTruthy();engine.resolveRecovery('end')
  expect(rows(db)).toEqual(before);expect((db.prepare('SELECT window_switches n FROM sessions').get() as {n:number}).n).toBe(2)
 }finally{engine.dispose();db.close();vi.useRealTimers()}
})

it('resumed redacted sessions disclose incomplete automatic evidence and keep manual logging available',()=>{
 const db=openDatabase(':memory:'),repo=seed(db);repo.deleteWindowTitles();const before=rows(db)
 db.prepare('UPDATE blocks SET focus_ended_at=? WHERE id=100').run(t(90))
 repo.addWindowRun(100,'focus',{startedAt:Date.parse(t(60)),endedAt:Date.parse(t(80)),process:'fictional-game',title:''})
 repo.saveRule({matchType:'process',pattern:'fictional-game',classification:'distraction'});repo.deriveAuto([100])
 expect(rows(db)).toEqual(before);expect(repo.windowHistoryFrozen([100])).toBe(true)
 repo.insertManual(100,Date.parse(t(65)),60);expect(rows(db)).toHaveLength(before.length+1);expect(rows(db).at(-1)?.source).toBe('manual');db.close()
})
