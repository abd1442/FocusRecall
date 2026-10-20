import {beforeEach,afterEach,it,expect} from 'vitest'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs'
import {resolve,join,sep} from 'node:path'
import {packagedDataDirectory,QA_MARKER} from '../main/identity'
const base=resolve('out/qa-temp');let root:string,appData:string,qa:string
beforeEach(()=>{root=mkdtempSync(join(base,'qa-isolation-unit-'));appData=join(root,'appData');qa=join(root,'fictional');mkdirSync(appData);mkdirSync(qa)})
afterEach(()=>{if(!resolve(root).startsWith(base+sep))throw Error('Unsafe cleanup');rmSync(root,{recursive:true,force:true})})
const mark=(folder:string)=>writeFileSync(join(folder,QA_MARKER),'FocusRecall fictional profile only')
it.each([undefined,'','relative','out/qa-temp/missing-profile'])('refuses a missing or non-absolute QA override %s',value=>{
 expect(()=>packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:value})).toThrow()
})
it('requires the explicit current override and exact marker, without legacy fallback',()=>{
 mark(qa);expect(()=>packagedDataDirectory(true,appData,{LEARNALYT_DATA_DIR:qa})).toThrow()
 expect(packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:qa})).toBe(qa)
 writeFileSync(join(qa,QA_MARKER),'wrong');expect(()=>packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:qa})).toThrow()
})
it('rejects normal profile trees and their ancestors, even with a marker',()=>{
 const normal=join(appData,'Learnalyt');mkdirSync(normal);mark(normal);mark(root)
 for(const path of [normal,root])expect(()=>packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:path})).toThrow()
})
it('rejects disagreeing overrides and keeps production out of QA roots and descendants',()=>{
 mark(qa);expect(()=>packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:qa,TRIFOCUS_DATA_DIR:appData})).toThrow()
 expect(()=>packagedDataDirectory(false,appData,{FOCUSRECALL_DATA_DIR:qa})).toThrow()
 expect(()=>packagedDataDirectory(false,appData,{FOCUSRECALL_DATA_DIR:join(qa,'nested')})).toThrow()
 expect(packagedDataDirectory(false,appData,{})).toBeUndefined()
 expect(packagedDataDirectory(false,appData,{FOCUSRECALL_DATA_DIR:join(root,'production')})).toBe(join(root,'production'))
})
it('resolves junction aliases when checking production overlap',()=>{
 mark(qa);const alias=join(root,'alias');symlinkSync(qa,alias,process.platform==='win32'?'junction':'dir')
 expect(()=>packagedDataDirectory(false,appData,{FOCUSRECALL_DATA_DIR:alias})).toThrow()
 const normal=join(appData,'Learnalyt');mkdirSync(normal);mark(normal);const other=join(root,'normal-alias');symlinkSync(normal,other,process.platform==='win32'?'junction':'dir')
 expect(()=>packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:other})).toThrow()
})

it('rejects a Chromium profile junction escaping the marked fixture',()=>{
 mark(qa);const target=join(appData,'fictional-cache');mkdirSync(target);symlinkSync(target,join(qa,'profile'),process.platform==='win32'?'junction':'dir')
 expect(()=>packagedDataDirectory(true,appData,{FOCUSRECALL_DATA_DIR:qa})).toThrow('normal application profiles')
})
