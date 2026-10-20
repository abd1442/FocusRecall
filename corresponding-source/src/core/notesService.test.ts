import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { openDatabase, type Db } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
import { NotesService } from '../main/notes'
import { EMPTY_DESTINATION, type NoteInput } from './notes'

vi.mock('electron',()=>({safeStorage:{isEncryptionAvailable:()=>true,encryptString:(s:string)=>Buffer.from('encrypted:'+s),decryptString:(b:Buffer)=>b.toString().slice(10)},clipboard:{write:vi.fn(async()=>{}),writeText:vi.fn(async()=>{})},ClipboardItem:class {constructor(public items:unknown){}}}))
const base=resolve('out/qa-temp');mkdirSync(base,{recursive:true})
let folder:string,db:Db,settings:SettingsRepo
beforeEach(()=>{folder=mkdtempSync(join(base,'notes-test-'));db=openDatabase(':memory:');db.prepare("INSERT INTO categories(name,color,sort_order,created_at) VALUES('QA','#123456',0,'2026-10-13')").run();const category=db.prepare('SELECT id FROM categories WHERE name=?').get('QA') as {id:number};db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,?,'QA subject','#123456','pages','2026-10-13')").run(category.id);settings=new SettingsRepo(db)})
afterEach(()=>{db.close();if(!resolve(folder).startsWith(base+sep))throw new Error('Unsafe test cleanup');rmSync(folder,{recursive:true,force:true})})
const note=(p:Partial<NoteInput>={}):NoteInput=>({id:'qa-note',itemId:100,blockId:null,title:'Math',text:'First notes',strokes:[],image:null,destination:{...EMPTY_DESTINATION},...p})
const page='01234567-89ab-cdef-0123-456789abcdef'

describe('notes backend and migration',()=>{
  it('migrates through version 14 and writes/updates a real Markdown file without losing other content',async()=>{
    expect((db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as {version:number}).version).toBe(14)
    const service=new NotesService(db,settings),path=join(folder,'Math.md');writeFileSync(path,'# Math\n\n## Study\nOther notes stay.\n')
    const input=note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:folder,vaultName:'QA',file:'Math.md',heading:'Study'}})
    expect((await service.save(input,true)).status).toBe('synced')
    expect((await service.save({...input,text:'Revised notes'},true)).status).toBe('synced')
    const text=readFileSync(path,'utf8');expect(text).toContain('Other notes stay.');expect(text).toContain('Revised notes');expect(text).not.toContain('First notes');expect(text.match(/<!-- learnalyt:qa-note -->/g)).toHaveLength(1)
    expect((await service.save({...input,text:'Revised notes'},false)).status).toBe('synced')
  })
  it('keeps a local draft after an external write error and serializes simultaneous saves',async()=>{
    const service=new NotesService(db,settings),bad=note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:folder,file:'../outside.md'}})
    expect((await service.save(bad,true)).status).toBe('failed')
    expect(service.list(100)[0].text).toBe('First notes')
    await Promise.all([service.save(note({text:'A'}),false),service.save(note({text:'B'}),false)])
    expect(service.list(100)[0].text).toBe('B')
  })
  it('preserves legacy local notes without contacting the removed Notion integration',async()=>{
    const request=vi.fn() as unknown as typeof fetch
    const service=new NotesService(db,settings,request)
    expect(service.configured()).toBe(false)
    expect(()=>service.setToken('qa-not-real')).toThrow('removed')
    await expect(service.sections(page)).rejects.toThrow('removed')
    const saved=await service.save(note({destination:{...EMPTY_DESTINATION,kind:'notion',page}}),true)
    expect(saved.status).toBe('failed');expect(saved.text).toBe('First notes');expect(saved.error).toContain('saved locally')
    expect(request).not.toHaveBeenCalled()
    expect((await service.save({...saved,destination:{...saved.destination,kind:'none'}},false)).text).toBe('First notes')
  })
  it('commits local notes immediately while a vault write is blocked',async()=>{
    let release!:(link:string)=>void
    const writer=vi.fn(()=>new Promise<string>(resolve=>{release=resolve}))
    const service=new NotesService(db,settings,undefined,writer)
    const external=service.save(note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:folder,file:'Math.md'}}),true)
    await Promise.resolve();expect(service.isBusy).toBe(true)
    expect(service.list(100)[0].text).toBe('First notes')
    const local=await service.save(note({id:'other-note',text:'Local without waiting'}),false)
    expect(local.text).toBe('Local without waiting');expect(service.list(100)).toHaveLength(2)
    release('obsidian://open');await external;expect(service.isBusy).toBe(false)
  })
  it('serializes equivalent Markdown destinations with an omitted extension',async()=>{
    let release!:(link:string)=>void
    const calls:string[]=[]
    const service=new NotesService(db,settings,undefined,input=>{calls.push(input.id);return calls.length===1?new Promise<string>(yes=>{release=yes}):Promise.resolve('obsidian://second')})
    const destination={...EMPTY_DESTINATION,kind:'obsidian' as const,vaultPath:folder,file:'Shared'}
    const first=service.save(note({id:'extension-first',destination}),true)
    await new Promise(resolve=>setTimeout(resolve,0))
    const second=service.save(note({id:'extension-second',destination:{...destination,file:'Shared.md'}}),true)
    await new Promise(resolve=>setTimeout(resolve,0))
    expect(calls).toEqual(['extension-first'])
    expect(service.list(100).filter(n=>n.id.startsWith('extension-'))).toHaveLength(2)
    release('obsidian://first');await Promise.all([first,second])
    expect(calls).toEqual(['extension-first','extension-second']);expect(service.isBusy).toBe(false)
  })
  it('does not overwrite a newer local revision with stale external success or failure',async()=>{
    for(const fail of [false,true]){
      let release!:(link:string)=>void,reject!:(error:Error)=>void
      const service=new NotesService(db,settings,undefined,()=>new Promise<string>((yes,no)=>{release=yes;reject=no}))
      const external=service.save(note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:folder,file:'Math.md'}}),true)
      await Promise.resolve();await service.save(note({text:'Newer local text'}),false)
      if(fail)reject(new Error('Old vault failure'));else release('obsidian://stale')
      const current=await external;expect(current.text).toBe('Newer local text');expect(current.status).toBe('local');expect(current.error).toBeNull()
    }
  })
  it('serializes external writes to the same file without blocking local persistence',async()=>{
    const service=new NotesService(db,settings),dest={...EMPTY_DESTINATION,kind:'obsidian' as const,vaultPath:folder,file:'Shared.md'}
    await Promise.all([service.save(note({id:'first',destination:dest}),true),service.save(note({id:'second',text:'Second note',destination:dest}),true)])
    const text=readFileSync(join(folder,'Shared.md'),'utf8');expect(text).toContain('learnalyt:first');expect(text).toContain('learnalyt:second')
  })
  it('does not write through a closed database after an external operation completes',async()=>{
    let release!:(link:string)=>void
    const service=new NotesService(db,settings,undefined,()=>new Promise<string>(r=>{release=r}))
    const pending=service.save(note({destination:{...EMPTY_DESTINATION,kind:'obsidian',vaultPath:folder,file:'Math.md'}}),true)
    await Promise.resolve();db.close();release('obsidian://open')
    expect((await pending).status).toBe('local');expect(service.isBusy).toBe(false)
    db=openDatabase(':memory:') // afterEach still closes a live disposable handle.
  })
})

it('searches titles and text across saved notes without sending them externally',async()=>{
 const writer=vi.fn(),service=new NotesService(db,settings,fetch,writer)
 await service.save(note({id:'one',title:'Vectors',text:'Projection and dot product'}),false)
 await service.save(note({id:'two',title:'Other',text:'Before 100% progress'}),false)
 expect(service.search('DOT PRODUCT').map(n=>n.id)).toEqual(['one'])
 expect(service.search('vector').map(n=>n.id)).toEqual(['one'])
 expect(service.search('100%').map(n=>n.id)).toEqual(['two'])
 expect(service.search("' OR 1=1 --")).toEqual([])
 expect(writer).not.toHaveBeenCalled()
})
