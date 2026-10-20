import Database from 'better-sqlite3'
import {it,expect} from 'vitest'
import {mkdtempSync,mkdirSync,rmSync,readFileSync,readdirSync} from 'node:fs'
import {resolve,join,sep} from 'node:path'
import {createHash} from 'node:crypto'
import {migrations} from '../main/db/migrations'
import {applyMigrations,validateBackup,snapshot,prepareRestore,installPendingRestore,backupFolder} from '../main/db/backups'
import {openDatabase} from '../main/db/database'
// Exact migration-ledger DDL shipped from 903f465 onward, before protected backups.
const legacyLedger=`CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    applied_at  TEXT NOT NULL
  )`
const base=resolve('out/qa-temp');mkdirSync(base,{recursive:true})
function fixture(run:(folder:string)=>void):void {const folder=mkdtempSync(join(base,'legacy-compat-'));try{run(folder)}finally{if(!resolve(folder).startsWith(base+sep))throw Error('Unsafe fixture');rmSync(folder,{recursive:true,force:true})}}
function legacy(file:string,version:number):void {const db=new Database(file);try{db.exec(legacyLedger);applyMigrations(db,migrations.filter(m=>m.version<=version));db.prepare("INSERT INTO settings(key,value) VALUES('fictional-sentinel',?)").run(JSON.stringify({notes:'Preserved fictional words',rating:4}));if(version>=13)db.exec(`INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(900,'Fictional','#123456',0,'2026-10-18');INSERT INTO items(id,category_id,name,color,created_at) VALUES(900,900,'Fictional subject','#123456','2026-10-18');INSERT INTO sittings(id,started_at,ended_at) VALUES(900,'2026-10-18T08:00:00Z','2026-10-18T08:10:00Z');INSERT INTO sessions(id,sitting_id,started_at,ended_at) VALUES(900,900,'2026-10-18T08:00:00Z','2026-10-18T08:10:00Z');INSERT INTO blocks(id,sitting_id,session_id,item_id,target_seconds,focus_started_at,focus_ended_at,focus_seconds,recall_text) VALUES(900,900,900,900,600,'2026-10-18T08:00:00Z','2026-10-18T08:10:00Z',600,'Fictional retained recall');INSERT INTO study_notes(id,item_id,block_id,title,text,strokes,destination,updated_at) VALUES('fictional-note',900,900,'Fictional note','Retained words','[]','{"kind":"none"}','2026-10-18')`)}finally{db.close()}}
it.each(migrations.map(m=>m.version))('accepts genuine historical ledger at schema %s read-only, then snapshots and migrates safely',version=>fixture(folder=>{
 const file=join(folder,'legacy.db');legacy(file,version);const original=readFileSync(file),hash=createHash('sha256').update(original).digest('hex')
 expect(validateBackup(file).schema).toBe(version);expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(hash)
 let db=openDatabase(file);expect(JSON.parse((db.prepare("SELECT value FROM settings WHERE key='fictional-sentinel'").get() as {value:string}).value).rating).toBe(4)
 if(version<14){const backups=readdirSync(backupFolder(file,'automatic'));expect(backups).toHaveLength(1);expect(validateBackup(join(backupFolder(file,'automatic'),backups[0])).schema).toBe(version)}
 const copy=join(folder,'manual.db');snapshot(db,copy);db.close();expect(validateBackup(copy).schema).toBe(14)
 db=openDatabase(file);expect((db.prepare('SELECT MAX(version) v FROM schema_migrations').get() as {v:number}).v).toBe(14);db.close()
}))
it('retains legacy study rows and notes through migration, restart, manual backup and staged restore',()=>fixture(folder=>{
 const file=join(folder,'legacy.db');legacy(file,13);let db=openDatabase(file)
 const rows=()=>({blocks:db.prepare('SELECT * FROM blocks').all(),notes:db.prepare('SELECT * FROM study_notes').all(),ledger:db.prepare('SELECT * FROM schema_migrations').all()});const before=rows();const copy=join(folder,'manual.db');snapshot(db,copy);db.exec("UPDATE study_notes SET text='Newer fictional words'");prepareRestore(db,file,copy);db.close();db=installPendingRestore(file,openDatabase)!;expect(rows()).toEqual(before);db.close();db=openDatabase(file);expect(rows()).toEqual(before);db.close()
}))

it.each([
 ['foreign key','REFERENCES items(id)',''],
 ['primary key','version     INTEGER PRIMARY KEY','version     INTEGER'],
 ['check',"CHECK (notes_target_type IN ('none', 'notion', 'obsidian'))",''],
 ['default',"DEFAULT 'pages'","DEFAULT 'two  spaces'"]
])('still rejects altered historical %s constraints without modifying the file',(_name,old,replacement)=>fixture(folder=>{
 const file=join(folder,'bad.db');legacy(file,13);const db=new Database(file);db.unsafeMode(true);db.pragma('writable_schema=ON');
 const target=_name==='primary key'?'schema_migrations':_name==='foreign key'?'blocks':'items'
 const row=db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(target) as {sql:string};expect(row.sql).toContain(old)
 db.prepare('UPDATE sqlite_master SET sql=? WHERE name=?').run(row.sql.replace(old,replacement),target);db.pragma('writable_schema=OFF');db.close()
 const original=readFileSync(file);expect(()=>validateBackup(file)).toThrow();expect(readFileSync(file)).toEqual(original)
}))

it('upgrades genuine first-generation study history through all data conversions and preserves recall/logs',()=>fixture(folder=>{
 const file=join(folder,'trifocus.db');legacy(file,1);let db=new Database(file)
 db.exec(`INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(900,'First fictional course','#123456',0,'2026-10-01');INSERT INTO items(id,category_id,name,color,created_at) VALUES(900,900,'First fictional subject','#123456','2026-10-01');INSERT INTO sittings(id,started_at,ended_at) VALUES(900,'2026-10-01T08:00:00Z','2026-10-01T08:10:00Z');INSERT INTO blocks(id,sitting_id,item_id,target_seconds,focus_started_at,focus_ended_at,focus_seconds,recall_text,recall_rating,log_status) VALUES(900,900,900,600,'2026-10-01T08:00:00Z','2026-10-01T08:10:00Z',600,'First retained recall',4,'done');INSERT INTO block_logs(block_id,activity_type,focus_rating,free_note) VALUES(900,'reading book',4,'First retained log note')`);db.close()
 db=openDatabase(file);expect(db.prepare('SELECT focus_seconds,recall_text,recall_rating FROM blocks WHERE id=900').get()).toEqual({focus_seconds:600,recall_text:'First retained recall',recall_rating:4})
 const answers=db.prepare('SELECT f.key,v.value FROM block_log_values v JOIN log_fields f ON f.id=v.field_id WHERE v.block_id=900').all() as {key:string;value:string}[]
 expect(answers.some(a=>a.key==='note'&&JSON.parse(a.value)==='First retained log note')).toBe(true);expect(answers.some(a=>a.key==='focus'&&JSON.parse(a.value)===4)).toBe(true)
 expect(db.prepare('SELECT COUNT(*) n FROM sessions WHERE id=900').get()).toEqual({n:1});db.close();expect(validateBackup(file).schema).toBe(14)
}))
it('takes the verified historical safety snapshot and rolls back a failing future migration',()=>fixture(folder=>{
 const file=join(folder,'legacy.db');legacy(file,14)
 expect(()=>openDatabase(file,{migrationList:[...migrations,{version:15,name:'fictional rollback',up:db=>{db.exec("DELETE FROM settings WHERE key='fictional-sentinel'");throw Error('fictional migration failure')}}]})).toThrow('fictional migration failure')
 const db=new Database(file,{readonly:true});expect(db.prepare("SELECT value FROM settings WHERE key='fictional-sentinel'").get()).toEqual({value:'{"notes":"Preserved fictional words","rating":4}'});expect(db.prepare('SELECT MAX(version) v FROM schema_migrations').get()).toEqual({v:14});db.close()
 const names=readdirSync(backupFolder(file,'automatic'));expect(names).toHaveLength(1);expect(validateBackup(join(backupFolder(file,'automatic'),names[0])).schema).toBe(14)
}))
