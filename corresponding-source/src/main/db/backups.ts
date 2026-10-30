import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { migrations, type Migration } from './migrations'
import type { Db } from './database'
import { schemaTokens } from './schemaTokens'

export interface BackupInfo { name: string; schema: number; bytes: number; demo: boolean }
const maxVersion = Math.max(...migrations.map((m) => m.version))

export function appliedVersions(db: Db): number[] {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()) return []
  return (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {version:number}[]).map((r) => r.version)
}

/** Validate a standalone app database without migrating or modifying it. */
export function validateBackup(file: string): BackupInfo {
  if (!existsSync(file) || !lstatSync(file).isFile() || statSync(file).size < 512) throw new Error('Choose a complete A14 Pomodoro database backup.')
  const db = new Database(file,{readonly:true,fileMustExist:true})
  try {
    if (db.pragma('integrity_check',{simple:true}) !== 'ok') throw new Error('The backup is damaged.')
    if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('The backup contains broken record relationships.')
    const versions=appliedVersions(db)
    if (!versions.length || versions.some((v,i)=>v !== migrations[i]?.version) || versions[versions.length-1]>maxVersion) throw new Error('This backup has an unsupported schema. Use the same or a newer compatible A14 Pomodoro version.')
    const objects=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all() as {type:string;name:string;sql:string}[]
    if(objects.some((o)=>!['table','index','view'].includes(o.type)||/\bVIRTUAL\b/i.test(o.sql??'')))throw new Error('This file is not a supported A14 Pomodoro database.')
    // Compare actual table names/columns to the shipped schema at this version.
    const expected=new Database(':memory:')
    try {
      expected.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)')
      for(const m of migrations.filter((m)=>m.version<=versions[versions.length-1])) { if(m.sql)expected.exec(m.sql);m.up?.(expected) }
      const views=expected.prepare("SELECT name,sql FROM sqlite_master WHERE type='view'").all() as {name:string;sql:string}[]
      const actualViews=objects.filter((o)=>o.type==='view')
      const normalized=schemaTokens
      if(actualViews.length!==views.length || actualViews.some((v)=>!views.some((e)=>e.name===v.name && normalized(e.sql)===normalized(v.sql))))throw new Error('The backup contains unsupported database views.')
      const tables=(expected.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[]).map((r)=>r.name)
      if(objects.filter((o)=>o.type==='table').length!==tables.length)throw new Error('The backup schema is incomplete or incompatible.')
      for(const table of tables){
        const columns=(connection:Db):string=>JSON.stringify((connection.prepare('SELECT name,type,pk FROM pragma_table_info(?) ORDER BY cid').all(table)))
        if(columns(db)!==columns(expected))throw new Error('The backup schema is incomplete or incompatible.')
        // Column shapes alone do not preserve foreign keys, checks or defaults.
        const definition=(connection:Db):string=>(connection.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as {sql:string}).sql
        if(normalized(definition(db))!==normalized(definition(expected)))throw new Error('The backup schema constraints are incomplete or incompatible.')
      }
    } finally { expected.close() }
    for(const r of db.prepare('SELECT value FROM settings').all() as {value:string}[]) { try{JSON.parse(r.value)}catch{throw new Error('The backup contains damaged settings.')} }
    return {name:basename(file),schema:versions[versions.length-1],bytes:statSync(file).size,demo:!!db.prepare("SELECT 1 FROM settings WHERE key='demoVersion'").get()}
  } finally { db.close() }
}

function flush(file: string): void { const fd=openSync(file,'r+');try{fsyncSync(fd)}finally{closeSync(fd)} }
function remove(file: string): void { if(existsSync(file))unlinkSync(file) }

/** SQLite VACUUM INTO reads a consistent live snapshot, including WAL content.
 * Only a validated, flushed temporary file is published; existing backups are never overwritten.
 */
export function snapshot(db: Db, destination: string): BackupInfo {
  const file=resolve(destination)
  if(db.inTransaction)throw new Error('Wait for the current data operation to finish before backing up.')
  if(existsSync(file))throw new Error('A file already exists there. Choose a new backup name.')
  mkdirSync(dirname(file),{recursive:true})
  const temp=join(dirname(file),`.focusrecall-snapshot-${randomUUID()}.partial`)
  try {
    db.prepare('VACUUM main INTO ?').run(temp)
    const info=validateBackup(temp);flush(temp)
    // Reserve the destination exclusively, then atomically replace our empty
    // reservation. Unlike hard links, this works on common external drives too.
    const reservation=openSync(file,'wx');closeSync(reservation)
    try{renameSync(temp,file)}catch(error){if(statSync(file).size===0)remove(file);throw error}
    return {...info,name:basename(file)}
  } finally { remove(temp) }
}

export function backupFolder(file: string, kind: 'automatic'|'manual'|'safety'): string { return join(dirname(file),'backups',basename(file),kind) }
const stamp=():string=>new Date().toISOString().replace(/[:.]/g,'-')

export function automaticSnapshot(db: Db, file: string): string {
  const folder=backupFolder(file,'automatic')
  const output=join(folder,`pre-migration-${stamp()}-${randomUUID()}.db`)
  snapshot(db,output) // Failure aborts migration; retention has not run yet.
  const candidates=readdirSync(folder).filter((name)=>/^pre-migration-[0-9TZ-]+-[a-f0-9-]+\.db$/.test(name)).map((name)=>join(folder,name))
  const successful=[output,...candidates.filter((path)=>path!==output).filter((path)=>{try{validateBackup(path);return true}catch{return false}}).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs || basename(b).localeCompare(basename(a)))]
  for(const older of successful.slice(3)){try{unlinkSync(older)}catch{/* Retention failure cannot invalidate a successful snapshot. */}}
  return output
}

interface RestoreJournal { version: 1; stage: string; safety: string; phase: 'prepared'|'installing'|'installed'|'rollingBack'|'failed'; error?: string }
const journalFile=(file:string):string=>`${file}.restore.json`
function writeJournal(file: string, journal: RestoreJournal):void {
  const temp=`${journalFile(file)}.${randomUUID()}.partial`
  try{writeFileSync(temp,JSON.stringify(journal),'utf8');flush(temp);renameSync(temp,journalFile(file))}finally{remove(temp)}
}
function readJournal(file:string):RestoreJournal|null {
  if(!existsSync(journalFile(file)))return null
  if(statSync(journalFile(file)).size>10000)throw new Error('Restore recovery information is invalid. Your database has not been replaced.')
  const j=JSON.parse(readFileSync(journalFile(file),'utf8')) as RestoreJournal
  if(j.version!==1 || !/^restore-stage-[a-f0-9-]+\.db$/.test(j.stage) || !/^before-restore-[0-9TZ-]+-[a-f0-9-]+\.db$/.test(j.safety) || !['prepared','installing','installed','rollingBack','failed'].includes(j.phase))throw new Error('Restore recovery information is invalid. Keep your data folder and contact support.')
  return j
}

/** Prepare everything while the current connection is alive. Installation happens only after restart. */
export function prepareRestore(db:Db,file:string,backup:string):void {
  if(readJournal(file))throw new Error('A restore is already pending. Restart A14 Pomodoro before trying again.')
  if(resolve(file)===resolve(backup))throw new Error('Choose a saved backup, not the active database.')
  validateBackup(backup)
  const safety=join(backupFolder(file,'safety'),`before-restore-${stamp()}-${randomUUID()}.db`)
  snapshot(db,safety)
  const stage=join(dirname(file),`restore-stage-${randomUUID()}.db`)
  const source=new Database(backup,{readonly:true,fileMustExist:true})
  try { snapshot(source,stage);writeJournal(file,{version:1,stage:basename(stage),safety:basename(safety),phase:'prepared'}) }
  catch(e){remove(stage);throw e}finally{source.close()}
}

function discardSidecars(file:string):void { remove(`${file}-wal`);remove(`${file}-shm`) }
function closeCurrent(file:string):void {
  if(!existsSync(file))return
  const current=new Database(file,{fileMustExist:true})
  try{const result=current.pragma('wal_checkpoint(TRUNCATE)') as {busy:number}[];if(result.some((r)=>r.busy))throw new Error('Another process is using the study database. Close it before restoring.')}
  catch(error){if(!['SQLITE_NOTADB','SQLITE_CORRUPT'].includes((error as {code?:string}).code??''))throw error}
  finally{current.close()}
}

/** Journal + durable safety snapshot makes interrupted replacement recoverable.
 * Called before any repositories/windows/services exist. Never use with an open app connection.
 */
export function installPendingRestore(file:string,open:(file:string)=>Db):Db|null {
  const j=readJournal(file);if(!j)return null
  const stage=join(dirname(file),j.stage),safety=join(backupFolder(file,'safety'),j.safety)
  if(j.phase==='failed'){remove(journalFile(file));return null}
  let restored:Db|null=null
  try {
    validateBackup(safety)
    if(j.phase==='rollingBack')throw new Error(j.error??'An interrupted restore is being rolled back.')
    if(j.phase==='prepared' || j.phase==='installing' && existsSync(stage)) {
      validateBackup(stage);closeCurrent(file)
      writeJournal(file,{...j,phase:'installing'})
      discardSidecars(file);renameSync(stage,file);flush(file)
    }
    writeJournal(file,{...j,phase:'installed'})
    validateBackup(file)
    restored=open(file) // Older compatible backups pass through protected migrations.
    validateBackup(file)
    remove(journalFile(file));return restored
  } catch(error) {
    restored?.close()
    // If installation never started, leave the original database untouched.
    const phase=readJournal(file)?.phase
    if(phase==='prepared'){remove(stage);remove(journalFile(file));throw error}
    writeJournal(file,{...j,phase:'rollingBack',error:String(error)})
    validateBackup(safety);closeCurrent(file)
    const rollback=join(dirname(file),`restore-stage-${randomUUID()}.db`)
    const source=new Database(safety,{readonly:true,fileMustExist:true})
    try{snapshot(source,rollback)}finally{source.close()}
    discardSidecars(file);renameSync(rollback,file);flush(file);validateBackup(file)
    writeJournal(file,{...j,phase:'failed',error:String(error)})
    throw new Error('Restoration failed. Your previous database was recovered from its safety backup. Restart A14 Pomodoro to continue. '+String(error))
  }
}

export function applyMigrations(db:Db, list:Migration[]=migrations):void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)')
  const applied=new Set(appliedVersions(db))
  const record=db.prepare('INSERT INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)')
  for(const m of [...list].sort((a,b)=>a.version-b.version))if(!applied.has(m.version))db.transaction(()=>{if(m.sql)db.exec(m.sql);m.up?.(db);record.run(m.version,m.name,new Date().toISOString())})()
}
