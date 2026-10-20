import { afterEach,expect,it } from 'vitest'
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs'
import { join,resolve,sep } from 'node:path'
import { profileDirectory } from '../main/identity'
import { databaseFile } from '../main/demo'
import { LEGACY_IDENTITY,isOwnAppProcess } from './identity'
import { QA_APP_ID,runtimeAppId } from './identity'
import { createRequire } from 'node:module'
const root=resolve('out/qa-temp');mkdirSync(root,{recursive:true});let disposable:string|undefined
it('keeps the production shell identity stable and separates QA at runtime and packaging',()=>{
 const qaPackage=createRequire(import.meta.url)('../../electron-builder.qa.cjs') as {appId:string}
 expect(runtimeAppId(false)).toBe('app.trifocus.desktop')
 expect(runtimeAppId(true)).toBe(QA_APP_ID)
 expect(runtimeAppId(true)).not.toBe(runtimeAppId(false))
 expect(qaPackage.appId).toBe(runtimeAppId(true))
})
afterEach(()=>{if(disposable){if(!resolve(disposable).startsWith(root+sep))throw Error('Unsafe cleanup');rmSync(disposable,{recursive:true,force:true});disposable=undefined}})
it('keeps an existing legacy profile without renaming/copying data and uses current names for a new install',()=>{
 const data='C:/fictional-appdata'
 expect(profileDirectory(data,undefined,()=>false)).toBe(join(data,'Learnalyt'))
 expect(profileDirectory(data,undefined,file=>file===join(data,LEGACY_IDENTITY.profile,LEGACY_IDENTITY.database))).toBe(join(data,LEGACY_IDENTITY.profile))
 expect(profileDirectory(data,'C:/isolated',()=>true)).toBe(join('C:/isolated','profile'))
})
it('selects existing database filenames without touching bytes; new profiles use current names',()=>{
 disposable=mkdtempSync(join(root,'identity-'))
 expect(databaseFile(disposable,false)).toBe(join(disposable,'learnalyt.db'))
 const legacy=join(disposable,LEGACY_IDENTITY.database);writeFileSync(legacy,'sentinel')
 expect(databaseFile(disposable,false)).toBe(legacy)
 expect(databaseFile(disposable,true)).toBe(join(disposable,'learnalyt-demo.db'))
})
it('excludes current and historic own-app processes from analytics',()=>{
 for(const name of ['FocusRecall','FocusRecall.exe','Learnalyt','Learnalyt.exe',LEGACY_IDENTITY.profile])expect(isOwnAppProcess(name)).toBe(true)
 expect(isOwnAppProcess('study-reader')).toBe(false)
})
it('reuses an existing Learnalyt profile, including when both historical profile names exist',()=>{
 const data='C:/fictional-appdata'
 expect(profileDirectory(data,undefined,file=>file===join(data,'Learnalyt','learnalyt.db')||file===join(data,LEGACY_IDENTITY.profile,LEGACY_IDENTITY.database))).toBe(join(data,'Learnalyt'))
})
