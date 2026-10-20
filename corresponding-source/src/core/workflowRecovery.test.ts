import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase, type Db } from '../main/db/database'
import { SessionRepo } from '../main/repos/sessions'
import { LogRepo } from '../main/repos/logs'
import { SettingsRepo } from '../main/repos/settings'
import { DistractionRepo } from '../main/repos/distractions'
import { CaptureRepo } from '../main/repos/captures'
import { SessionEngine } from '../main/session'
import { PreparationGate } from './preparation'
let db:Db, engine:SessionEngine, now:number
const make=():SessionEngine=>new SessionEngine(new SessionRepo(db),new LogRepo(db),new DistractionRepo(db),new CaptureRepo(db),new SettingsRepo(db),()=>[],()=>now,()=>now)
const advance=(ms:number):void=>{for(let left=ms;left>0;){const step=Math.min(left,1000);now+=step;vi.advanceTimersByTime(step);left-=step}}
const restart=():void=>{engine.dispose();now+=86400000;engine=make()}
const finish=():number=>{engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance(600000);engine.finish();return engine.get().finished[0].sessionId}
beforeEach(()=>{
  vi.useFakeTimers();now=Date.parse('2026-10-14T10:00:00Z');db=openDatabase(':memory:')
  db.prepare("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'QA','#123456',0,'2026-10-14')").run()
  db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'Math','#123456','pages','2026-10-14')").run()
  engine=make()
})
afterEach(()=>{vi.restoreAllMocks();engine.dispose();db.close();vi.useRealTimers()})

it('rolls back Finish including pause/distraction writes and emits nothing before commit',()=>{
 engine.start({itemId:100,timerMode:'flow',targetSeconds:600});advance(120000);engine.distracted();advance(60000)
 const ended=vi.fn();engine.on('partEnded',ended)
 const fail=vi.spyOn(SessionRepo.prototype,'endSession').mockImplementation(()=>{throw Error('finish fault')})
 expect(()=>engine.finish()).toThrow('finish fault');expect(engine.get().running).not.toBeNull();expect(ended).not.toHaveBeenCalled()
 expect(db.prepare('SELECT focus_ended_at FROM blocks').get()).toEqual({focus_ended_at:null});expect(db.prepare('SELECT COUNT(*) AS n FROM distractions').get()).toEqual({n:0})
 fail.mockRestore();engine.finish();expect(ended).toHaveBeenCalledOnce();expect(engine.get().step).toBe('recall')
})
it('keeps running recovery retryable when ending the session fails',()=>{
 engine.start({itemId:100,timerMode:'flow',targetSeconds:600});advance(60000);restart()
 const fail=vi.spyOn(SessionRepo.prototype,'endSession').mockImplementation(()=>{throw Error('recovery fault')})
 expect(()=>engine.resolveRecovery('end')).toThrow('recovery fault');expect(engine.get().recovery).not.toBeNull()
 expect(db.prepare('SELECT focus_ended_at FROM blocks').get()).toEqual({focus_ended_at:null})
 fail.mockRestore();engine.resolveRecovery('end');expect(engine.get().recovery).toBeNull();expect(engine.get().finished[0].focusSeconds).toBe(60)
})
it('isolates throwing observers after commit and still notifies other observers',()=>{
 const warning=vi.spyOn(console,'error').mockImplementation(()=>{})
 engine.start({itemId:100,timerMode:'flow',targetSeconds:600});advance(60000)
 engine.on('partEnded',()=>{expect(db.prepare('SELECT ended_at FROM sessions').get()).not.toEqual({ended_at:null});throw Error('observer fault')})
 const second=vi.fn();engine.on('partEnded',second)
 expect(()=>engine.finish()).not.toThrow();expect(second).toHaveBeenCalledOnce();expect(engine.get().step).toBe('recall');expect(warning).toHaveBeenCalled()
})
it('rolls back a newly started session if saving its settings fails',()=>{
 const original=SettingsRepo.prototype.set
 const fail=vi.spyOn(SettingsRepo.prototype,'set').mockImplementation(function(this:SettingsRepo,key,value){if(key==='lastItemId')throw Error('settings fault');return original.call(this,key,value)})
 expect(()=>engine.start({itemId:100,timerMode:'flow',targetSeconds:600})).toThrow('settings fault');expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({n:0})
 fail.mockRestore();engine.start({itemId:100,timerMode:'flow',targetSeconds:600});expect(engine.get().running).not.toBeNull()
})

it('rolls back the recovery continuation gap and keeps the prompt retryable',()=>{
 engine.start({itemId:100,timerMode:'flow',targetSeconds:600});advance(60000);restart()
 const fail=vi.spyOn(DistractionRepo.prototype,'setKind').mockImplementation(()=>{throw Error('classification fault')})
 expect(()=>engine.resolveRecovery('continue')).toThrow('classification fault');expect(engine.get().recovery).not.toBeNull()
 expect(db.prepare('SELECT COUNT(*) AS n FROM block_pauses').get()).toEqual({n:0});expect(db.prepare('SELECT COUNT(*) AS n FROM distractions').get()).toEqual({n:0})
 fail.mockRestore();engine.resolveRecovery('continue');expect(engine.get().running).not.toBeNull();expect(db.prepare('SELECT COUNT(*) AS n FROM distractions').get()).toEqual({n:1})
})

it('keeps running rest and its database record retryable when workflow persistence fails',()=>{
 finish();engine.completeRecall();engine.submitLog(engine.get().finished.map(b=>({blockId:b.id,values:{},notes:{}})));engine.startRest(300);advance(60000)
 const blockId=engine.get().rest!.blockId,original=SettingsRepo.prototype.writeRaw
 const fail=vi.spyOn(SettingsRepo.prototype,'writeRaw').mockImplementation(function(this:SettingsRepo,key,value){if(key==='unfinishedWorkflows')throw Error('rest persistence fault');return original.call(this,key,value)})
 expect(()=>engine.finishRest(null)).toThrow('rest persistence fault');expect(engine.get().rest?.phase).toBe('running');expect(new SessionRepo(db).restUnrecorded(blockId)).toBe(true)
 fail.mockRestore();engine.finishRest(null);expect(engine.get().rest).toBeNull();expect(new SessionRepo(db).restUnrecorded(blockId)).toBe(false)
})

it('rolls back log records and the log-to-rest transition if workflow metadata fails',()=>{
 finish();engine.completeRecall();const entries=engine.get().finished.map(b=>({blockId:b.id,values:{},notes:{}})),original=SettingsRepo.prototype.writeRaw
 const fail=vi.spyOn(SettingsRepo.prototype,'writeRaw').mockImplementation(function(this:SettingsRepo,key,value){if(key==='unfinishedWorkflows')throw Error('log metadata fault');return original.call(this,key,value)})
 expect(()=>engine.submitLog(entries)).toThrow('log metadata fault');expect(engine.get().step).toBe('log');expect(engine.get().rest).toBeNull()
 expect(db.prepare('SELECT log_status FROM blocks').get()).toEqual({log_status:'pending'})
 fail.mockRestore();engine.submitLog(entries);expect(engine.get().rest?.phase).toBe('plan')
})
it('does not record preparation time or cancelled starts and preserves the confirmed goal',()=>{
  const gate=new PreparationGate(),plan={input:{itemId:100,timerMode:'flow' as const,targetSeconds:1500,goal:'Solve one problem'},subject:'Math',tip:0}
  gate.begin(plan);advance(600000)
  expect(engine.get().running).toBeNull()
  expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n:number}).n).toBe(0)
  gate.cancel();gate.begin(plan);advance(600000)
  gate.commit(input=>engine.start(input));expect(engine.get().running).not.toBeNull()
  advance(60000);engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(60)
  expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n:number}).n).toBe(1)
  expect(()=>gate.commit(input=>engine.start(input))).toThrow('No session')
})
it('offers recall without duplicate sessions and preserves the later decision across restarts',()=>{
  const id=finish();restart();expect(engine.get().stage).toBe('idle');expect(engine.get().unfinished[0].step).toBe('recall')
  engine.leaveWorkflow(id);restart();expect(engine.get().unfinished[0].deferred).toBe(true)
  engine.resumeWorkflow(id);expect(engine.get().step).toBe('recall');expect(engine.get().finished).toHaveLength(1)
  expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n:number}).n).toBe(1)
})
it('restores logging drafts and guards duplicate resume',()=>{
  const id=finish();engine.completeRecall();engine.saveLogDraft(id,{perSubject:{100:{values:{42:'answer'},notes:{},untouched:[7]}},shared:{values:{},notes:{}}})
  restart();expect(engine.get().unfinished[0].step).toBe('log');engine.resumeWorkflow(id)
  expect(engine.get().step).toBe('log');expect(engine.getLogDraft(id)).toMatchObject({perSubject:{100:{values:{42:'answer'},untouched:[7]}}})
  expect(()=>engine.resumeWorkflow(id)).toThrow('Finish')
  engine.submitLog(engine.get().finished.map((b)=>({blockId:b.id,values:{},notes:{}})))
  expect(engine.getLogDraft(id)).toBeNull()
})
it('keeps recall and its draft retryable when its transition transaction fails',()=>{
  const id=finish();engine.saveRecallDraft(id,{added:[],drafts:{100:{recallText:'saved words'}}})
  const original=SettingsRepo.prototype.writeRaw
  const failure=vi.spyOn(SettingsRepo.prototype,'writeRaw').mockImplementation(function(this:SettingsRepo,key,value){
    if(key===`recallDraft:${id}` && value===null)throw new Error('injected write failure')
    return original.call(this,key,value)
  })
  expect(()=>engine.completeRecall()).toThrow('injected write failure');expect(engine.get().step).toBe('recall')
  expect(engine.getRecallDraft(id)).toMatchObject({drafts:{100:{recallText:'saved words'}}})
  failure.mockRestore();engine.completeRecall();restart();engine.resumeWorkflow(id);expect(engine.get().step).toBe('log')
})
it.each(['plan','running','over'] as const)('restores %s rest excluding application downtime',phase=>{
  const id=finish();engine.completeRecall();engine.submitLog(engine.get().finished.map((b)=>({blockId:b.id,values:{},notes:{}})))
  if(phase!=='plan'){engine.startRest(300);advance(60000)}
  if(phase==='over')engine.endRestEarly()
  restart();expect(engine.get().unfinished[0].step).toBe('rest');engine.resumeWorkflow(id)
  const r=engine.get().rest!;expect(r.phase).toBe(phase)
  if(phase==='running'){expect(Date.parse(r.endsAt!)-now).toBe(240000);restart();engine.resumeWorkflow(id);expect(Date.parse(engine.get().rest!.endsAt!)-now).toBe(240000)}
  engine.finishRest(null)
  expect((db.prepare('SELECT rest_actual_seconds AS actual FROM blocks').get() as {actual:number}).actual).toBe(phase==='plan'?0:60)
  restart();expect(engine.get().unfinished).toHaveLength(0)
})
it('reconstructs legacy pending work; rejects History-completed work',()=>{
  const id=finish();engine.dispose();new SettingsRepo(db).writeRaw('unfinishedWorkflows',null);engine=make()
  expect(engine.get().unfinished[0].sessionId).toBe(id)
  db.prepare("UPDATE blocks SET log_status='done'").run();expect(()=>engine.resumeWorkflow(id)).toThrow('already completed')
})
it('running recovery and manual distraction still work with tracking off',()=>{
  new SettingsRepo(db).set('foregroundTrackingEnabled',false)
  engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance(60000);restart()
  expect(engine.get().recovery).not.toBeNull();engine.resolveRecovery('continue')
  engine.distracted();advance(30000);engine.back(true);engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(60)
  expect(new SettingsRepo(db).getAll().foregroundTrackingEnabled).toBe(false)
})
it('rest plan length persists; invalid lengths and incomplete logs do not alter records',()=>{
  const id=finish();engine.completeRecall();expect(()=>engine.submitLog([])).toThrow('every part')
  engine.submitLog(engine.get().finished.map((b)=>({blockId:b.id,values:{},notes:{}})));engine.updateRestPlan(420)
  restart();engine.resumeWorkflow(id);expect(engine.get().rest?.plannedSeconds).toBe(420)
  expect(()=>engine.startRest(NaN)).toThrow('valid');expect(engine.get().rest?.phase).toBe('plan')
})
it('resumes only unfinished parts and preserves a part completed through History',()=>{
  db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(101,100,'History','#123456','pages','2026-10-14')").run()
  engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance(600000);engine.switchTo(101);advance(600000);engine.finish()
  const parts=engine.get().finished,id=parts[0].sessionId
  new LogRepo(db).saveValues(parts[0].id,{},{});db.prepare("UPDATE blocks SET recall_text='already completed',recall_rating=4 WHERE id=?").run(parts[0].id)
  restart();engine.resumeWorkflow(id);expect(engine.get().finished.map(p=>p.id)).toEqual([parts[1].id])
  engine.completeRecall();engine.submitLog([{blockId:parts[1].id,values:{},notes:{}}])
  expect((db.prepare('SELECT recall_text AS t FROM blocks WHERE id=?').get(parts[0].id) as {t:string}).t).toBe('already completed')
})

it('limits the short-session discard command to its own recall stage',()=>{
 engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance(10000);engine.finish()
 const id=engine.get().finished[0].sessionId;engine.completeRecall()
 expect(()=>engine.discardFinished()).toThrow('waiting for recall')
 expect(db.prepare('SELECT id FROM sessions WHERE id=?').get(id)).toEqual({id})
})
it('cannot discard longer study through the short-session command and preserves explicit short discard',()=>{
 finish();const id=engine.get().finished[0].sessionId
 expect(()=>engine.discardFinished()).toThrow('History')
 expect(db.prepare('SELECT id FROM sessions WHERE id=?').get(id)).toEqual({id})
})
it('deletes a short session only through explicit discard and preserves other records',()=>{
 engine.start({itemId:100,timerMode:'flow',targetSeconds:1500});advance(10000);engine.finish()
 const id=engine.get().finished[0].sessionId;engine.discardFinished()
 expect(db.prepare('SELECT id FROM sessions WHERE id=?').get(id)).toBeUndefined()
 expect(db.prepare('SELECT name FROM items WHERE id=100').get()).toEqual({name:'Math'})
})

// Stage 2: one atomic save, with an explicit destination and no invented answers.
it.each(['finish','break','next'] as const)('quick wrap-up safely saves skipped answers and chooses %s', destination=>{
 const id=finish(),parts=engine.get().finished
 engine.finishWrapUp(parts.map(b=>({blockId:b.id,values:{},notes:{}})),destination)
 expect(db.prepare('SELECT log_status,recall_rating FROM blocks').get()).toEqual({log_status:'done',recall_rating:null})
 expect(db.prepare('SELECT COUNT(*) AS n FROM block_log_values').get()).toEqual({n:0})
 expect(engine.get().finished).toHaveLength(0)
 expect(engine.get().sitting===null).toBe(destination==='finish')
 expect(engine.get().rest?.phase??null).toBe(destination==='break'?'running':null)
 expect(()=>engine.finishWrapUp(parts.map(b=>({blockId:b.id,values:{},notes:{}})),destination)).toThrow()
 expect(db.prepare('SELECT id FROM sessions WHERE id=?').get(id)).toEqual({id})
})
it('rolls back the whole quick wrap-up if the destination fails, retaining drafts and the session',()=>{
 const id=finish(),parts=engine.get().finished
 engine.saveLogDraft(id,{perSubject:{100:{values:{},notes:{}}},shared:{values:{},notes:{}}})
 const fail=vi.spyOn(SessionEngine.prototype,'endSitting').mockImplementation(()=>{throw Error('destination fault')})
 expect(()=>engine.finishWrapUp(parts.map(b=>({blockId:b.id,values:{},notes:{}})),'finish')).toThrow('destination fault')
 expect(engine.get().step).toBe('recall');expect(engine.getLogDraft(id)).not.toBeNull()
 expect(db.prepare('SELECT log_status FROM blocks').get()).toEqual({log_status:'pending'})
 fail.mockRestore();engine.finishWrapUp(parts.map(b=>({blockId:b.id,values:{},notes:{}})),'finish')
 expect(engine.getLogDraft(id)).toBeNull()
})
it('protects recall drafts containing additional subjects from the quick shortcut',()=>{
 const id=finish();engine.saveRecallDraft(id,{added:[{id:101}],drafts:{101:{recallText:'Do not lose this'}}})
 expect(()=>engine.finishWrapUp(engine.get().finished.map(b=>({blockId:b.id,values:{},notes:{}})),'finish')).toThrow('saved recall')
 expect(engine.getRecallDraft(id)).toMatchObject({drafts:{101:{recallText:'Do not lose this'}}})
 expect(engine.get().step).toBe('recall')
})
it('finishing during a break records elapsed rest before closing the sitting',()=>{
 finish();engine.finishWrapUp(engine.get().finished.map(b=>({blockId:b.id,values:{},notes:{}})),'break')
 advance(75000);engine.finishStudying()
 expect(engine.get().rest).toBeNull();expect(engine.get().sitting).toBeNull()
 expect(db.prepare('SELECT rest_actual_seconds AS seconds FROM blocks').get()).toEqual({seconds:75})
})

it('remembers a once-confirmed detail across later logs without upgrading an unconfirmed suggestion',()=>{
 const logs=new LogRepo(db),schema=logs.schema(),drink=schema.fields.find(f=>f.key==='drinks')??schema.fields.find(f=>schema.groups.some(g=>g.id===f.groupId&&g.section==='detail')&&f.type==='single')!
 expect(drink).toBeDefined()
 const first=finish(),part1=engine.get().finished[0]
 engine.finishWrapUp([{blockId:part1.id,values:{[drink.id]:drink.options[0].id},notes:{}}],'finish')
 finish();const part2=engine.get().finished[0]
 engine.finishWrapUp([{blockId:part2.id,values:{[drink.id]:drink.options[1].id},notes:{},untouched:[drink.id]}],'finish')
 finish();const part3=engine.get().finished[0]
 expect(logs.previous(100,part3.id)?.[drink.id]).toBe(drink.options[0].id)
 expect(logs.values(part2.id).untouched).toContain(drink.id)
 expect(db.prepare('SELECT id FROM sessions WHERE id=?').get(first)).toBeDefined()
})

it.each(['finished','skipped'] as const)('offers rest setup and directly starts another session in the same sitting after %s rest', outcome=>{
 finish();engine.completeRecall()
 const first=engine.get().finished[0],sittingId=engine.get().sitting!.id
 engine.submitLog([{blockId:first.id,values:{},notes:{}}])
 expect(engine.get().rest?.phase).toBe('plan')
 expect(engine.get().running).toBeNull()
 engine.updateRestPlan(420)
 if(outcome==='finished'){
  engine.startRest(420);advance(60000);engine.endRestEarly();engine.finishRest(null)
 }else engine.skipRest()
 expect(engine.get().sitting!.id).toBe(sittingId)
 expect(engine.get().rest).toBeNull()
 engine.start({itemId:100,timerMode:'fixed',targetSeconds:1200,goal:'Continue the same topic'})
 expect(engine.get().stage).toBe('focus')
 expect(engine.get().sitting!.id).toBe(sittingId)
 expect(engine.get().running).toMatchObject({itemId:100,timerMode:'fixed',targetSeconds:1200})
 expect(db.prepare('SELECT log_status FROM blocks WHERE id=?').get(first.id)).toEqual({log_status:'done'})
 expect(db.prepare('SELECT rest_actual_seconds AS seconds FROM blocks WHERE id=?').get(first.id)).toEqual({seconds:outcome==='finished'?60:0})
})
