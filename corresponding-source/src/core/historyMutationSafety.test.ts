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
import { roleCanInvoke } from './desktopSecurity'

let db:Db,engine:SessionEngine,settings:SettingsRepo,blocks:BlocksRepo,now:number
const make=()=>new SessionEngine(new SessionRepo(db),new LogRepo(db),new DistractionRepo(db),new CaptureRepo(db),settings,()=>[],()=>now,()=>now)
beforeEach(()=>{
 vi.useFakeTimers();now=Date.parse('2026-10-27T10:00:00Z');db=openDatabase(':memory:')
 db.prepare("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Audit','#123456',0,'2026-10-27'),(101,'Child','#123456',1,'2026-10-27')").run()
 db.prepare('UPDATE categories SET parent_id=100 WHERE id=101').run()
 db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,101,'A','#123456','pages','2026-10-27'),(101,101,'B','#123456','pages','2026-10-27')").run()
 settings=new SettingsRepo(db);blocks=new BlocksRepo(db,new LogRepo(db));engine=make()
})
afterEach(()=>{vi.restoreAllMocks();engine.dispose();db.close();vi.useRealTimers()})
const advance=(ms:number)=>{for(let left=ms;left>0;){const step=Math.min(left,1000);now+=step;vi.advanceTimersByTime(step);left-=step}}
const start=()=>engine.start({itemId:100,timerMode:'flow',targetSeconds:1500})
const parts=()=>db.prepare('SELECT * FROM blocks ORDER BY id').all()

it('preserves both parts and working timer when History tries deleting or editing a switched Quick session',()=>{
 settings.set('studyExperience','quick');start();advance(60000);engine.switchTo(101);advance(60000)
 const state=engine.get(),session=state.running!.sessionId,first=state.running!.parts[0].id,before=parts()
 expect(()=>engine.assertHistoryMutationAllowed(session)).toThrow('current study step')
 expect(()=>blocks.deleteSession(session)).toThrow('running session')
 expect(()=>blocks.deleteBlock(first)).toThrow('running session')
 expect(()=>blocks.updateBlock(first,{recallText:'changed'})).toThrow('running session')
 expect(parts()).toEqual(before)
 expect(()=>engine.distracted()).not.toThrow();expect(engine.get().running!.pauses.some(p=>p.endedAt===null)).toBe(true)
})

it('protects recovery, active Recall/Log and Rest while permitting unrelated History',()=>{
 start();advance(60000);const id=engine.get().running!.sessionId
 engine.dispose();engine=make();expect(engine.get().recovery).not.toBeNull()
 expect(()=>engine.assertHistoryMutationAllowed(id)).toThrow()
 expect(()=>engine.assertHistoryMutationAllowed(id+100)).not.toThrow()
 engine.resolveRecovery('end');expect(()=>engine.assertHistoryMutationAllowed(id)).toThrow()
 engine.completeRecall();expect(()=>engine.assertHistoryMutationAllowed(id)).toThrow()
 engine.submitLog(engine.get().finished.map(b=>({blockId:b.id,values:{},notes:{}})))
 expect(engine.get().rest).not.toBeNull();expect(()=>engine.assertHistoryMutationAllowed(id)).toThrow()
 engine.skipRest();expect(()=>engine.assertHistoryMutationAllowed(id)).not.toThrow()
 blocks.deleteSession(id);expect(parts()).toEqual([])
})

it.each(['recall','log'] as const)('save %s for later preserves drafts and allows valid History completion',step=>{
 start();advance(60000);engine.finish();const id=engine.get().finished[0].sessionId,blockId=engine.get().finished[0].id
 engine.saveRecallDraft(id,{drafts:{100:{recallText:'Keep my draft'}}});engine.saveLogDraft(id,{values:{1:3}})
 if(step==='log')engine.completeRecall()
 const draft=engine.getRecallDraft(id),log=engine.getLogDraft(id),before=parts(),sitting=engine.get().sitting!.id
 engine.leaveWorkflow(id)
 expect(engine.get().stage).toBe('idle');expect(engine.get().sitting!.id).toBe(sitting)
 expect(engine.get().unfinished.find(w=>w.sessionId===id)).toMatchObject({step,deferred:true})
 expect(engine.getRecallDraft(id)).toEqual(draft);expect(engine.getLogDraft(id)).toEqual(log);expect(parts()).toEqual(before)
 expect(()=>engine.assertHistoryMutationAllowed(id)).not.toThrow()
 new LogRepo(db).saveValues(blockId,{},{});engine.touch()
 expect(engine.get().unfinished.find(w=>w.sessionId===id)).toBeUndefined()
})

it('rolls back leaving the current workflow if persistence fails',()=>{
 start();advance(60000);engine.finish();const id=engine.get().finished[0].sessionId
 const write=SettingsRepo.prototype.writeRaw
 vi.spyOn(SettingsRepo.prototype,'writeRaw').mockImplementation(function(this:SettingsRepo,key,value){if(key==='unfinishedWorkflows')throw Error('write failed');return write.call(this,key,value)})
 expect(()=>engine.leaveWorkflow(id)).toThrow('write failed')
 expect(engine.get().stage).toBe('recall');expect(engine.get().finished[0].sessionId).toBe(id)
 vi.restoreAllMocks()
})

it('rejects overlap atomically, permits touching boundaries and ordinary historical deletion',()=>{
 start();advance(60000);engine.switchTo(101);advance(60000);engine.finish()
 const p=engine.get().finished,before=parts()
 expect(()=>blocks.updateBlock(p[0].id,{itemId:101,recallText:'must roll back',focusEndedAt:p[1].focusEndedAt})).toThrow('cannot overlap')
 expect(parts()).toEqual(before)
 expect(()=>blocks.updateBlock(p[0].id,{focusEndedAt:p[1].focusStartedAt})).not.toThrow()
 engine.leaveWorkflow(p[0].sessionId);blocks.deleteBlock(p[0].id);expect(parts()).toHaveLength(1)
 blocks.deleteSession(p[0].sessionId);expect(parts()).toEqual([])
})

it('picker and start/startLast/switch share ancestor archive policy and recover on unarchive',()=>{
 const library=new LibraryRepo(db),repo=new SessionRepo(db)
 settings.set('lastItemId',100);library.setCategoryArchived(100,true)
 expect(library.listPickerItems()).toEqual([]);expect(repo.itemIsActive(100)).toBe(false)
 expect(()=>start()).toThrow('active subject');expect(()=>engine.startLast()).toThrow('Pick a subject')
 library.setCategoryArchived(100,false);expect(repo.itemIsActive(100)).toBe(true);start();advance(10000)
 library.setCategoryArchived(100,true);expect(()=>engine.switchTo(101)).toThrow('archived')
 library.setCategoryArchived(100,false);expect(()=>engine.switchTo(101)).not.toThrow()
})

it('notes deletion only accepts note IDs and remains unavailable to auxiliary windows',()=>{
 expect(()=>validateIpcArgs('notes:delete',['standalone-note-1'])).not.toThrow()
 for(const id of ['', '../outside','a'.repeat(81)])expect(()=>validateIpcArgs('notes:delete',[id])).toThrow()
 expect(()=>validateIpcArgs('notes:delete',[123])).toThrow()
 for(const role of ['panel','reasons','capture'] as const)expect(roleCanInvoke(role,'notes:delete',['standalone-note-1'])).toBe(false)
})
