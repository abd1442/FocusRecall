import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { openDatabase,type Db } from '../main/db/database'
import { SessionRepo } from '../main/repos/sessions'
import { LogRepo } from '../main/repos/logs'
import { BlocksRepo } from '../main/repos/blocks'
import { LibraryRepo } from '../main/repos/library'
import { SettingsRepo } from '../main/repos/settings'
import { DistractionRepo } from '../main/repos/distractions'
import { CaptureRepo } from '../main/repos/captures'
import { SessionEngine } from '../main/session'
import { validateIpcArgs } from './ipcValidation'

const native=vi.hoisted(()=>({handlers:new Map<string,(event:unknown,...args:unknown[])=>Promise<unknown>>() }))
vi.mock('electron',()=>({app:{},BrowserWindow:{getAllWindows:()=>[]},dialog:{},shell:{},ipcMain:{handle:(name:string,fn:(event:unknown,...args:unknown[])=>Promise<unknown>)=>native.handlers.set(name,fn)}}))
vi.mock('../main/security',()=>({assertCaller:(_event:unknown,name:string,args:unknown[])=>validateIpcArgs(name,args)}))
import { registerIpc } from '../main/ipc'
let db:Db,engine:SessionEngine,now:number
const call=(name:string,...args:unknown[])=>native.handlers.get(name)!({},...args)
const rows=()=>db.prepare('SELECT * FROM blocks ORDER BY id').all()
beforeEach(()=>{
 vi.useFakeTimers();now=Date.parse('2026-10-27T10:00:00Z');db=openDatabase(':memory:')
 db.prepare("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'QA','#123456',0,'2026-10-27')").run()
 db.prepare("INSERT INTO items(id,category_id,name,color,created_at) VALUES(100,100,'A','#123456','2026-10-27'),(101,100,'B','#123456','2026-10-27')").run()
 const settings=new SettingsRepo(db),logs=new LogRepo(db),sessions=new SessionRepo(db),distractions=new DistractionRepo(db),captures=new CaptureRepo(db)
 engine=new SessionEngine(sessions,logs,distractions,captures,settings,()=>[],()=>now,()=>now)
 registerIpc({db,session:engine,settings,logs,sessions,distractions,captures,library:new LibraryRepo(db),blocks:new BlocksRepo(db,logs),databaseFile:'out/qa-temp/audit-ipc-unused.db',setSetting:(key,value)=>{settings.set(key,value);return settings.getAll()}} as Parameters<typeof registerIpc>[0])
})
afterEach(()=>{engine.dispose();db.close();vi.useRealTimers();native.handlers.clear()})
const advance=()=>{for(let i=0;i<60;i++){now+=1000;vi.advanceTimersByTime(1000)}}
it('main IPC rejects deleting/editing/logging an active recalled session and accepts its deferred completion',async()=>{
 engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance();engine.finish()
 const b=engine.get().finished[0],before=rows()
 for(const [name,args] of [
  ['history:deleteSession',[b.sessionId]],['history:deleteBlock',[b.id]],
  ['history:updateBlock',[b.id,{recallText:'overwrite'}]],['history:saveLog',[b.id,{},{}]]
 ] as [string,unknown[]][])await expect(call(name,...args)).rejects.toThrow('current study step')
 expect(rows()).toEqual(before);expect(engine.get().stage).toBe('recall')
 engine.leaveWorkflow(b.sessionId)
 await expect(call('history:saveLog',b.id,{},{})).resolves.toBeUndefined()
 expect(engine.get().unfinished).toEqual([])
 await expect(call('history:deleteSession',b.sessionId)).resolves.toBeUndefined();expect(rows()).toEqual([])
})
it('main IPC rejects the active switched Quick session before repository mutation',async()=>{
 await call('settings:set','studyExperience','quick')
 engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance();engine.switchTo(101)
 const b=engine.get().running!,before=rows()
 await expect(call('history:deleteSession',b.sessionId)).rejects.toThrow('current study step')
 expect(rows()).toEqual(before);await expect(call('session:distracted')).resolves.toBeDefined()
})
