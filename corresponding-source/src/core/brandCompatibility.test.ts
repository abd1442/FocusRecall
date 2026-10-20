import { afterEach, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { DATA_IDENTITY, LEGACY_IDENTITY, PRODUCT_NAME } from './identity'
import { profileDirectory } from '../main/identity'
import { databaseFile } from '../main/demo'
import { openDatabase } from '../main/db/database'
import { migrations } from '../main/db/migrations'
import { backupFolder, installPendingRestore, prepareRestore, snapshot, validateBackup } from '../main/db/backups'
import { NotesService } from '../main/notes'
import { SettingsRepo } from '../main/repos/settings'
import { EMPTY_DESTINATION } from './notes'
vi.mock('electron',()=>({clipboard:{},ClipboardItem:class {}}))
const root=resolve('out/qa-temp');mkdirSync(root,{recursive:true});let folder:string|undefined
const create=()=>folder=mkdtempSync(join(root,'brand-compatibility-'))
afterEach(()=>{if(folder){if(!resolve(folder).startsWith(root+sep))throw Error('Unsafe test cleanup');rmSync(folder,{recursive:true,force:true});folder=undefined}})
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex')
it.each([9,12])('preserves a schema %s legacy database and original backup through the existing migrations',version=>{
 const dir=create(),file=join(dir,'trifocus.db'),old=openDatabase(file,{migrationList:migrations.filter(m=>m.version<=version)})
 new SettingsRepo(old).writeRaw('qaLegacy',{goal:'Original fictional study goal',confirmed:false})
 const backup=join(dir,'Learnalyt-old-schema.db');snapshot(old,backup);old.close();const original=sha(backup)
 expect(validateBackup(backup).schema).toBe(version)
 const current=openDatabase(file)
 try{
  expect(JSON.parse((current.prepare("SELECT value FROM settings WHERE key='qaLegacy'").get() as {value:string}).value)).toEqual({goal:'Original fictional study goal',confirmed:false})
  expect(current.pragma('integrity_check',{simple:true})).toBe('ok')
  expect(readdirSync(backupFolder(file,'automatic')).length).toBeGreaterThan(0)
  expect(sha(backup)).toBe(original)
 }finally{current.close()}
})
it('keeps the established storage namespace even after a fresh install or reinstall',()=>{
 const appData=create(),chosen=profileDirectory(appData,undefined)
 expect(chosen).toBe(join(appData,DATA_IDENTITY.profile));mkdirSync(chosen)
 const file=databaseFile(chosen,false),db=openDatabase(file);new SettingsRepo(db).writeRaw('qaBrandSentinel','unchanged');db.close();const before=sha(file)
 expect(profileDirectory(appData,undefined)).toBe(chosen);expect(sha(file)).toBe(before)
 expect(readdirSync(appData)).toEqual(['Learnalyt']);expect(PRODUCT_NAME).toBe('FocusRecall')
})
it.each([false,true])('finds retained Trifocus data without moving or duplicating it (demo=%s)',demo=>{
 const appData=create(),old=join(appData,LEGACY_IDENTITY.profile);mkdirSync(old)
 const file=join(old,demo?LEGACY_IDENTITY.demoDatabase:LEGACY_IDENTITY.database);writeFileSync(file,'untouched fixture')
 expect(profileDirectory(appData,undefined)).toBe(old);expect(databaseFile(old,demo)).toBe(file);expect(readFileSync(file,'utf8')).toBe('untouched fixture');expect(readdirSync(appData)).toEqual(['trifocus'])
})
it('restores an older-named backup and its pending journal without a format migration',()=>{
 const dir=create(),file=join(dir,DATA_IDENTITY.database);let db=openDatabase(file);const settings=new SettingsRepo(db)
 settings.writeRaw('qaBrandSentinel',{text:'Learnalyt saved value',vault:'fictional/vault',confirmed:false})
 const backup=join(dir,'Learnalyt-old-backup.db');snapshot(db,backup);const backupHash=sha(backup);expect(validateBackup(backup).schema).toBe(14)
 settings.writeRaw('qaBrandSentinel',{text:'newer value'});prepareRestore(db,file,backup);db.close()
 db=installPendingRestore(file,openDatabase)!;expect(JSON.parse((db.prepare('SELECT value FROM settings WHERE key=?').get('qaBrandSentinel') as {value:string}).value)).toEqual({text:'Learnalyt saved value',vault:'fictional/vault',confirmed:false});expect(sha(backup)).toBe(backupHash);expect(readdirSync(backupFolder(file,'safety')).length).toBeGreaterThan(0);db.close()
})
it.each(['Learnalyt','Trifocus','FocusRecall'])('reuses %s drawing attachments and existing Obsidian note markers',async prefix=>{
 const dir=create(),db=openDatabase(':memory:');try{
 db.exec("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'QA','#123456',0,'2026-10-16'); INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'Fictional study','#123456','pages','2026-10-16')")
 const imageName=`${prefix}-brand-note.png`,file=join(dir,'Study.md');writeFileSync(join(dir,imageName),'old image');writeFileSync(file,`Other notes stay.\n<!-- learnalyt:brand-note -->\nOld words\n![](${imageName})\n<!-- /learnalyt:brand-note -->\n`)
 const service=new NotesService(db,new SettingsRepo(db)),note={id:'brand-note',itemId:100,blockId:null,title:'Recall',text:'Updated words',strokes:[],image:'data:image/png;base64,iVBORw0KGgo=',destination:{...EMPTY_DESTINATION,kind:'obsidian' as const,vaultPath:dir,vaultName:'Fictional',file:'Study.md'}}
 expect((await service.save(note,true)).status).toBe('synced');expect((await service.save({...note,text:'Final words'},true)).status).toBe('synced')
 const text=readFileSync(file,'utf8');expect(text).toContain('Other notes stay.');expect(text).toContain('Final words');expect(text.match(/<!-- learnalyt:brand-note -->/g)).toHaveLength(1);expect(text).toContain(`](${imageName})`);expect(readdirSync(dir).filter(n=>n.endsWith('.png'))).toEqual([imageName])
 }finally{db.close()}
})
it('keeps installation identity and persisted formats while removing stale installer branding',()=>{
 const config=readFileSync('electron-builder.yml','utf8'),installer=readFileSync('build/installer.nsh','utf8'),entry=readFileSync('src/main/index.ts','utf8')
 expect(config).toContain(`appId: ${LEGACY_IDENTITY.appId}`);expect(config).toContain('deleteAppDataOnUninstall: false');expect(config).toContain('allowToChangeInstallationDirectory: true');expect(entry.indexOf("app.setPath('userData'")).toBeLessThan(entry.indexOf('app.requestSingleInstanceLock'))
 expect(DATA_IDENTITY.appearanceFormat).toBe('learnalyt-appearance');expect(DATA_IDENTITY.obsidianMarker).toBe('learnalyt')
 expect(installer).toContain('MUI_LICENSEPAGE_BUTTON "$(^NextBtn)"');expect(installer).not.toContain('I accept the Learnalyt');expect(installer).toContain('FocusRecallInstFilesPre');expect(installer).toContain('Call instFilesPre');expect(installer).toContain('customCheckAppRunning');expect(installer).not.toContain('KILL_PROCESS');expect(installer).not.toContain('RMDir')
 const translations=readFileSync('build/installer-locales.nsh','utf8')
 expect(translations).toContain('LangString FocusRecallLicenseTop 1033 "License"')
 for(const language of [1033,1025,3082,1036,2052,1046,1031])expect(translations).toContain(`LangString FocusRecallLicenseTop ${language} `)
})

it('ships GPLv3 without proprietary restrictions or a mandatory installer contract',()=>{const license=readFileSync('LICENSE','utf8'),notice=readFileSync('resources/legal/EULA.txt','utf8');expect(license).toContain('Version 3, 29 June 2007');expect(notice.replace(/\r\n/g,'\n')).toContain(license.replace(/\r\n/g,'\n'));expect(notice).toContain('OFF by default');expect(JSON.parse(readFileSync('package.json','utf8')).license).toBe('GPL-3.0-only');expect(readFileSync('build/installer.nsh','utf8')).not.toContain('!define MUI_LICENSEPAGE_CHECKBOX\n')})
