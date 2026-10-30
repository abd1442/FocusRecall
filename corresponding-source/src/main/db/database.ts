import Database from 'better-sqlite3'
import { migrations } from './migrations'
import { appliedVersions, applyMigrations, automaticSnapshot } from './backups'

export type Db = Database.Database

export function openDatabase(file: string, options: { snapshot?: (db:Db,file:string)=>void; migrationList?: typeof migrations } = {}): Db {
  const db = new Database(file)
  try {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const versions=appliedVersions(db),list=options.migrationList??migrations
  if(versions.some((v,i)=>v!==list[i]?.version))throw new Error('This study database uses an unsupported schema. Open it with a compatible A14 Pomodoro version.')
  const hasData=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name != 'schema_migrations'").get()
  if(hasData && file!==':memory:' && list.some((m)=>!versions.includes(m.version))) (options.snapshot??automaticSnapshot)(db,file)
  applyMigrations(db,list)
  return db
  } catch(e){db.close();throw e}
}
