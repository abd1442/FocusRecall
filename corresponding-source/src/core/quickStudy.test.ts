import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase, type Db } from '../main/db/database'
import { SessionEngine } from '../main/session'
import { SessionRepo } from '../main/repos/sessions'
import { SettingsRepo } from '../main/repos/settings'
import { LogRepo } from '../main/repos/logs'
import { CaptureRepo } from '../main/repos/captures'
import { DistractionRepo } from '../main/repos/distractions'
import { roleCanInvoke } from './desktopSecurity'
import { validateIpcArgs } from './ipcValidation'
import { distractionSourceLabel, reasonLabel } from './distractions'
let db:Db,engine:SessionEngine,settings:SettingsRepo,now:number
const make=():SessionEngine=>new SessionEngine(new SessionRepo(db),new LogRepo(db),new DistractionRepo(db),new CaptureRepo(db),settings,()=>[],()=>now,()=>now)
const advance=(ms:number):void=>{for(let left=ms;left>0;){const step=Math.min(left,1000);now+=step;vi.advanceTimersByTime(step);left-=step}}
const start=():void=>{engine.start({itemId:100,timerMode:'fixed',targetSeconds:300})}
const rows=():Record<string,unknown>[]=>db.prepare('SELECT * FROM blocks ORDER BY id').all() as Record<string,unknown>[]
beforeEach(()=>{
 vi.useFakeTimers();now=Date.parse('2026-10-19T10:00:00Z');db=openDatabase(':memory:');settings=new SettingsRepo(db)
 db.exec("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Fictional','#123456',0,'2026-10-19');INSERT INTO items(id,category_id,name,color,created_at) VALUES(100,100,'Biology','#123456','2026-10-19'),(101,100,'History','#123456','2026-10-19')")
 engine=make()
})
afterEach(()=>{vi.restoreAllMocks();engine.dispose();db.close();vi.useRealTimers()})
it('defaults existing and fresh profiles to Full; invalid mode never activates Quick',()=>{
 expect(settings.getAll().studyExperience).toBe('full');settings.writeRaw('studyExperience','unexpected');expect(settings.getAll().studyExperience).toBe('full')
 expect(()=>validateIpcArgs('settings:set',['studyExperience','unexpected'])).toThrow();expect(()=>engine.quickAction('next')).toThrow('not active')
})
it('saves exact active time, excludes pauses and starts Next atomically without invented answers',()=>{
 settings.set('studyExperience','quick');start();advance(20000);engine.distracted();advance(10000)
 const stages:string[]=[];engine.on('changed',s=>stages.push(s.stage))
 engine.back(true);advance(10000);const old=engine.get().running!.id;engine.quickAction('next',old)
 expect(engine.get().running!.id).not.toBe(old);expect(engine.get().running!.targetSeconds).toBe(300);expect(engine.get().step).toBeNull();expect(stages).not.toContain('recall')
 expect(rows()[0]).toMatchObject({focus_seconds:30,log_status:'done',recall_text:null,recall_seconds:null,recall_rating:null,rest_actual_seconds:null})
 expect(db.prepare('SELECT kind FROM distractions').get()).toEqual({kind:'timer-pause'})
 expect(distractionSourceLabel({source:'manual',kind:'timer-pause'})).toBe('Timer pause');expect(reasonLabel('timer-pause')).toBe('Timer pause')
 expect(db.prepare('SELECT * FROM block_log_values').all()).toEqual([]);expect(db.prepare('SELECT * FROM block_group_notes').all()).toEqual([])
 engine.quickAction('next',old);expect(rows()).toHaveLength(2)
 advance(15000);engine.finish();expect(engine.get().stage).toBe('idle');expect(engine.get().sitting).toBeNull();expect(engine.get().unfinished).toEqual([]);expect(rows()[1].focus_seconds).toBe(15)
})
it('optional Break records only actual observed rest and Resume starts study without questions',()=>{
 settings.set('studyExperience','quick');start();advance(60000);engine.quickAction('break');expect(engine.get().rest?.phase).toBe('running');expect(engine.get().step).toBeNull()
 advance(30000);engine.startNextFromRest();expect(engine.get().running).not.toBeNull();expect(rows()[0].rest_actual_seconds).toBe(30);expect(rows()[0].rest_activity).toBeNull()
})
it('target completion never segments study and rest completion never resumes study automatically',()=>{
 settings.set('studyExperience','quick');start();const id=engine.get().running!.id;advance(301000)
 expect(engine.get().running!.id).toBe(id);expect(engine.get().running!.targetAlerted).toBe(true);expect(rows()).toHaveLength(1)
 engine.quickAction('break');const seconds=engine.get().rest!.plannedSeconds;advance((seconds+1)*1000)
 expect(engine.get().rest!.phase).toBe('over');expect(engine.get().running).toBeNull();expect(rows()).toHaveLength(1)
})
it('rolls back both the saved session and Next on database failure',()=>{
 settings.set('studyExperience','quick');start();advance(15000);const id=engine.get().running!.id
 const change=vi.fn();engine.on('changed',change);const fail=vi.spyOn(SessionRepo.prototype,'insertBlock').mockImplementation(()=>{throw Error('write failed')})
 expect(()=>engine.quickAction('next',id)).toThrow('write failed');expect(rows()).toHaveLength(1);expect(rows()[0]).toMatchObject({focus_ended_at:null,log_status:'pending'});expect(engine.get().running!.id).toBe(id);expect(change).not.toHaveBeenCalled();fail.mockRestore();engine.quickAction('next',id);expect(rows()).toHaveLength(2)
})
it.each(['continue','end'] as const)('restart recovery %s excludes closed time and never creates recall completion',choice=>{
 settings.set('studyExperience','quick');start();advance(60000);engine.dispose();now+=8*3600000;engine=make();expect(engine.get().recovery).not.toBeNull();engine.resolveRecovery(choice)
 if(choice==='continue'){advance(10000);engine.finish()}
 expect(rows()[0].focus_seconds).toBe(choice==='continue'?70:60);expect(engine.get().step).toBeNull();expect(engine.get().unfinished).toHaveLength(0);expect(rows()[0].recall_seconds).toBeNull()
})
it('lock interruption and long absence still require a deliberate return; rest recovery excludes downtime',()=>{
 settings.set('studyExperience','quick');start();advance(30000);engine.interruptTiming();expect(engine.get().running).toBeNull();expect(engine.get().recovery).not.toBeNull();now+=3600000;engine.resolveRecovery('continue');engine.distracted();advance(60000);engine.resolveLongAbsence('end');expect(rows()[0].focus_seconds).toBe(30)
 start();advance(10000);engine.quickAction('break');advance(20000);engine.dispose();now+=3600000;engine=make();const saved=engine.get().unfinished.find(w=>w.step==='rest')!;expect(saved.elapsed).toBe(20);engine.resumeWorkflow(saved.sessionId);engine.finishStudying();expect(rows()[1].rest_actual_seconds).toBe(20)
})
it('does not rewrite older records or delete answers when closing only its own workflow',()=>{
 const focus=new LogRepo(db).schema().fields.find(f=>f.key==='focus')!
 start();advance(20000);engine.finish();engine.completeRecall();engine.submitLog(engine.get().finished.map(b=>({blockId:b.id,values:{[focus.id]:4},notes:{}})));engine.skipRest();engine.endSitting();const old=rows()[0],answers=db.prepare('SELECT * FROM block_log_values').all()
 settings.set('studyExperience','quick');start();advance(5000);engine.switchTo(101);advance(5000);engine.finish();expect(rows()[0]).toEqual(old);expect(rows().slice(1).every(r=>r.log_status==='done')).toBe(true);expect(db.prepare('SELECT * FROM block_log_values').all()).toEqual(answers)
})
it('keeps helper IPC narrow and validates Quick actions',()=>{
 expect(roleCanInvoke('panel','session:quickAction',['next',1])).toBe(true);expect(roleCanInvoke('reasons','session:quickAction',['next',1])).toBe(false)
 expect(()=>validateIpcArgs('session:quickAction',['next',1])).not.toThrow();expect(()=>validateIpcArgs('session:quickAction',['anything',1])).toThrow();expect(()=>validateIpcArgs('session:quickAction',['next'])).toThrow()
})
