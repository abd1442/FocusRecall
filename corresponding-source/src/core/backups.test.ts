import Database from 'better-sqlite3'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { openDatabase, type Db } from '../main/db/database'
import { automaticSnapshot, backupFolder, installPendingRestore, prepareRestore, snapshot, validateBackup } from '../main/db/backups'
import { migrations } from '../main/db/migrations'
const base=resolve('out/qa-temp');mkdirSync(base,{recursive:true})
let folder:string,file:string,db:Db|null
beforeEach(()=>{folder=mkdtempSync(join(base,'backup-test-'));file=join(folder,'trifocus.db');db=null})
afterEach(()=>{if(db?.open)db.close();if(!resolve(folder).startsWith(base+sep))throw new Error('Unsafe cleanup');rmSync(folder,{recursive:true,force:true})})
function data(connection:Db,text='important'):void {connection.prepare("INSERT INTO settings(key,value) VALUES('qa',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(text))}
const value=(connection:Db):string=>JSON.parse((connection.prepare("SELECT value FROM settings WHERE key='qa'").get() as {value:string}).value)
function studyData(connection:Db):void {
  connection.exec(`INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Saved course','#123456',0,'2026-10-15');
    INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'Saved subject','#123456','pages','2026-10-15');
    INSERT INTO sittings(id,started_at,ended_at) VALUES(100,'2026-10-15T08:00:00Z','2026-10-15T08:10:00Z');
    INSERT INTO sessions(id,sitting_id,started_at,ended_at) VALUES(100,100,'2026-10-15T08:00:00Z','2026-10-15T08:10:00Z');
    INSERT INTO blocks(id,sitting_id,session_id,item_id,timer_mode,target_seconds,focus_started_at,focus_ended_at,focus_seconds,last_heartbeat_at,recall_text) VALUES(100,100,100,100,'flow',600,'2026-10-15T08:00:00Z','2026-10-15T08:10:00Z',600,'2026-10-15T08:10:00Z','Saved recall');
    INSERT INTO study_notes(id,item_id,block_id,title,text,strokes,destination,updated_at) VALUES('saved-note',100,100,'Saved note','Local words','[]','{"kind":"none"}','2026-10-15');`)
}
it('preserves actual study history, recall and local notes through snapshot and restoration',()=>{
  db=openDatabase(file);studyData(db);const backup=join(folder,'history.db');snapshot(db,backup)
  db.prepare("UPDATE study_notes SET text='Newer words'").run();prepareRestore(db,file,backup);db.close();db=installPendingRestore(file,openDatabase)
  expect(db!.prepare('SELECT focus_seconds,recall_text FROM blocks WHERE id=100').get()).toEqual({focus_seconds:600,recall_text:'Saved recall'})
  expect(db!.prepare('SELECT text FROM study_notes WHERE id=?').get('saved-note')).toEqual({text:'Local words'})
  const safety=new Database(join(backupFolder(file,'safety'),readdirSync(backupFolder(file,'safety'))[0]),{readonly:true})
  expect(safety.prepare('SELECT text FROM study_notes').get()).toEqual({text:'Newer words'});safety.close()
})
it('rolls back a failing migration that attempted to change saved local notes and history',()=>{
  db=openDatabase(file);studyData(db);db.close()
  const failing=[...migrations,{version:15,name:'injected failure',up:(connection:Db)=>{connection.exec("UPDATE study_notes SET text='corrupted'; UPDATE blocks SET focus_seconds=0;");throw new Error('injected migration failure')}}]
  expect(()=>openDatabase(file,{migrationList:failing})).toThrow('injected migration failure')
  db=openDatabase(file);expect(db.prepare('SELECT text FROM study_notes').get()).toEqual({text:'Local words'})
  expect(db.prepare('SELECT focus_seconds FROM blocks WHERE id=100').get()).toEqual({focus_seconds:600})
  expect(readdirSync(backupFolder(file,'automatic'))).toHaveLength(1)
})
it('does not back up first initialization or unchanged launches',()=>{
  db=openDatabase(file);data(db);db.close();db=openDatabase(file)
  expect(()=>readdirSync(backupFolder(file,'automatic'))).toThrow()
})
it('includes committed WAL data while live; rejects overwrite and damaged/future files',()=>{
  db=openDatabase(file);db.pragma('wal_autocheckpoint=0');data(db)
  const backup=join(folder,'manual.db');snapshot(db,backup)
  expect(validateBackup(backup).schema).toBe(14)
  const reader=new Database(backup,{readonly:true});expect(value(reader)).toBe('important');reader.close()
  expect(()=>snapshot(db!,backup)).toThrow('already exists')
  writeFileSync(join(folder,'bad.db'),'not sqlite');expect(()=>validateBackup(join(folder,'bad.db'))).toThrow()
  const future=new Database(backup);future.prepare("INSERT INTO schema_migrations(version,name,applied_at) VALUES(15,'future','2026')").run();future.close()
  expect(()=>validateBackup(backup)).toThrow('unsupported')
})
it('backs up an older compatible database before migration and retains its content',()=>{
  db=openDatabase(file,{migrationList:migrations.slice(0,12)});data(db);db.close();db=openDatabase(file)
  expect(value(db)).toBe('important');const files=readdirSync(backupFolder(file,'automatic'));expect(files).toHaveLength(1)
  expect(validateBackup(join(backupFolder(file,'automatic'),files[0])).schema).toBe(12)
})
it('backup failure aborts migration without changing the old schema or data',()=>{
  db=openDatabase(file,{migrationList:migrations.slice(0,12)});data(db);db.close()
  expect(()=>openDatabase(file,{snapshot:()=>{throw new Error('disk full')}})).toThrow('disk full')
  db=new Database(file);expect(value(db)).toBe('important');expect((db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as {v:number}).v).toBe(12)
})
it('failed migration leaves a validated pre-migration backup and rolls back that migration',()=>{
  db=openDatabase(file);data(db);db.close()
  expect(()=>openDatabase(file,{migrationList:[...migrations,{version:15,name:'failure',up:(c)=>{c.prepare("DELETE FROM settings WHERE key='qa'").run();throw new Error('injected')}}]})).toThrow('injected')
  db=new Database(file);expect(value(db)).toBe('important')
  const files=readdirSync(backupFolder(file,'automatic'));expect(files).toHaveLength(1);validateBackup(join(backupFolder(file,'automatic'),files[0]))
})
it('retains three successful automatic snapshots and never deletes manual or failed files',()=>{
  db=openDatabase(file);data(db);const manual=join(folder,'manual.db');snapshot(db,manual)
  for(let i=0;i<5;i++)automaticSnapshot(db,file)
  const auto=backupFolder(file,'automatic');expect(readdirSync(auto)).toHaveLength(3)
  writeFileSync(join(auto,'.interrupted.partial'),'incomplete');data(db,'new');automaticSnapshot(db,file)
  expect(readdirSync(auto).filter((n)=>n.endsWith('.db'))).toHaveLength(3)
  expect(readFileSync(manual).length).toBeGreaterThan(0);expect(readFileSync(join(auto,'.interrupted.partial'),'utf8')).toBe('incomplete')
})
it('restores after controlled closure and keeps a complete safety backup',()=>{
  db=openDatabase(file);data(db,'old');const backup=join(folder,'manual.db');snapshot(db,backup);data(db,'new')
  prepareRestore(db,file,backup);expect(value(db)).toBe('new');db.close();db=installPendingRestore(file,openDatabase)
  expect(value(db!)).toBe('old');expect(installPendingRestore(file,openDatabase)).toBeNull()
  const safety=backupFolder(file,'safety'),reader=new Database(join(safety,readdirSync(safety)[0]),{readonly:true});expect(value(reader)).toBe('new');reader.close()
})
it('rolls back installation when initialization fails and does not retry silently',()=>{
  db=openDatabase(file);data(db,'old');const backup=join(folder,'manual.db');snapshot(db,backup);data(db,'new');prepareRestore(db,file,backup);db.close()
  expect(()=>installPendingRestore(file,()=>{throw new Error('injected initialization failure')})).toThrow('previous database was recovered')
  expect(installPendingRestore(file,openDatabase)).toBeNull();db=openDatabase(file);expect(value(db)).toBe('new')
})
it('invalid backup never changes current data; supports an older restore through migrations',()=>{
  db=openDatabase(file);data(db,'current');const invalid=join(folder,'invalid.db');writeFileSync(invalid,'invalid')
  expect(()=>prepareRestore(db!,file,invalid)).toThrow();expect(value(db)).toBe('current')
  const old=join(folder,'old.db'),older=openDatabase(old,{migrationList:migrations.slice(0,12)});data(older,'legacy');older.close()
  prepareRestore(db,file,old);db.close();db=installPendingRestore(file,openDatabase);expect(value(db!)).toBe('legacy');expect(validateBackup(file).schema).toBe(14)
})
it('interrupted installation resumes from staged file or rolls back from the durable journal',()=>{
  db=openDatabase(file);data(db,'old');const backup=join(folder,'manual.db');snapshot(db,backup);data(db,'new');prepareRestore(db,file,backup);db.close()
  const journal=JSON.parse(readFileSync(`${file}.restore.json`,'utf8'));journal.phase='installing';writeFileSync(`${file}.restore.json`,JSON.stringify(journal))
  db=installPendingRestore(file,openDatabase);expect(value(db!)).toBe('old');db!.close();db=openDatabase(file);data(db,'latest');prepareRestore(db,file,backup);db.close()
  const second=JSON.parse(readFileSync(`${file}.restore.json`,'utf8'));second.phase='rollingBack';writeFileSync(`${file}.restore.json`,JSON.stringify(second))
  expect(()=>installPendingRestore(file,openDatabase)).toThrow('recovered');expect(installPendingRestore(file,openDatabase)).toBeNull();db=openDatabase(file);expect(value(db)).toBe('latest')
})
it('recovers safety data even when an interrupted replacement left a corrupt target',()=>{
  db=openDatabase(file);data(db,'old');const backup=join(folder,'manual.db');snapshot(db,backup);data(db,'new');prepareRestore(db,file,backup);db.close()
  const journal=JSON.parse(readFileSync(`${file}.restore.json`,'utf8'));journal.phase='installed';writeFileSync(`${file}.restore.json`,JSON.stringify(journal));writeFileSync(file,'corrupt replacement')
  expect(()=>installPendingRestore(file,openDatabase)).toThrow('previous database was recovered')
  expect(installPendingRestore(file,openDatabase)).toBeNull();db=openDatabase(file);expect(value(db)).toBe('new')
})
it('rejects a backup with the same columns but removed foreign-key constraints',()=>{
 db=openDatabase(file);studyData(db);db.close();db=null
 const altered=new Database(file)
 const before=altered.prepare("SELECT sql FROM sqlite_master WHERE name='blocks'").get() as {sql:string}
 expect(before.sql).toContain('REFERENCES items(id)')
 altered.unsafeMode(true)
 try {
 altered.pragma('writable_schema = ON')
 altered.prepare("UPDATE sqlite_master SET sql=replace(sql,'REFERENCES items(id)','') WHERE name='blocks'").run()
 altered.pragma('writable_schema = OFF')
 } finally {altered.close()}
 expect(()=>validateBackup(file)).toThrow('schema')
})
