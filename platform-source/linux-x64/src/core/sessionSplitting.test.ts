import { afterEach,beforeEach,expect,it } from 'vitest'
import { openDatabase,type Db } from '../main/db/database'
import { SessionRepo } from '../main/repos/sessions'
import { DistractionRepo } from '../main/repos/distractions'
import { BlocksRepo } from '../main/repos/blocks'
import { LogRepo } from '../main/repos/logs'
import { StatsRepo } from '../main/repos/stats'
let db:Db,repo:SessionRepo,distractions:DistractionRepo,block:number,session:number
const t=(minute:number):string=>new Date(Date.UTC(2026,9,15,8)+minute*60000).toISOString()
const at=(minute:number):number=>Date.parse(t(minute))
const focus=():number[]=>(db.prepare('SELECT focus_seconds AS seconds FROM blocks ORDER BY focus_started_at,id').all() as {seconds:number}[]).map(p=>p.seconds)
beforeEach(()=>{
  db=openDatabase(':memory:');repo=new SessionRepo(db);distractions=new DistractionRepo(db)
  db.prepare("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'QA','#123456',0,?)").run(t(0))
  for(const id of [100,101,102])db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(?,100,?,'#123456','pages',?)").run(id,`Subject ${id}`,t(0))
  const sitting=repo.createSitting(t(0));session=repo.createSession(sitting,t(0));block=repo.insertBlock({sittingId:sitting,sessionId:session,itemId:100,timerMode:'flow',targetSeconds:600,startedAt:t(0)})
  db.prepare("UPDATE blocks SET focus_ended_at=?,focus_seconds=600,last_heartbeat_at=? WHERE id=?").run(t(10),t(10),block);repo.endSession(session,t(10))
})
afterEach(()=>db.close())
it('conserves six focus minutes across the reproduced crossing pause, with one distraction event',()=>{
  const id=distractions.addManual([block],at(4),at(8),'phone')
  const parts=repo.transaction(()=>repo.splitPart(block,[101]));distractions.refreshSessionStats(session)
  expect(focus()).toEqual([240,120]);expect(focus().reduce((a,b)=>a+b)).toBe(360)
  expect(distractions.forBlocks(parts).map(d=>d.id)).toEqual([id])
  const history=new BlocksRepo(db,new LogRepo(db)).history()[0].blocks
  expect(history.map(b=>b.pauses)).toEqual([[{startedAt:t(4),endedAt:t(5)}],[{startedAt:t(5),endedAt:t(8)}]])
  const stats=db.prepare('SELECT distraction_count AS n,distracted_seconds AS seconds FROM sessions WHERE id=?').get(session)
  expect(stats).toEqual({n:1,seconds:240})
})
it('conserves overlapping/multiple pauses through repeated divider corrections without fragmenting rows',()=>{
  for(const [s,e] of [[1,2],[4,8],[7,9]])distractions.addManual([block],at(s),at(e),'phone')
  const parts=repo.transaction(()=>repo.splitPart(block,[101,102]))
  for(const boundaries of [[3,6],[2,7],[4,8],[3,6]]){
    repo.retime(parts,at(0),at(10),boundaries.map(at))
    expect(focus().reduce((a,b)=>a+b)).toBe(240)
    expect((db.prepare('SELECT COUNT(*) AS n FROM block_pauses').get() as {n:number}).n).toBe(3)
    expect((db.prepare('SELECT COUNT(*) AS n FROM distractions').get() as {n:number}).n).toBe(3)
  }
  expect(focus()).toEqual([120,60,60])
})
it('attributes crossing activity spans to both subjects and keeps rest activity on its original block',()=>{
  distractions.addWindowRun(block,'focus',{startedAt:at(3),endedAt:at(8),process:'chrome',title:'Coursera'})
  distractions.addWindowRun(block,'rest',{startedAt:at(10),endedAt:at(12),process:'music',title:'Rest'})
  const parts=repo.transaction(()=>repo.splitPart(block,[101]));
  expect(distractions.runs([parts[0]]).map(r=>(r.endedAt-r.startedAt)/1000)).toEqual([120])
  expect(distractions.runs([parts[1]]).map(r=>(r.endedAt-r.startedAt)/1000)).toEqual([180])
  expect(distractions.programs(parts).reduce((n,p)=>n+p.seconds,0)).toBe(300)
  const raw=new StatsRepo(db,new LogRepo(db)).raw();expect(raw.blocks.map(b=>Object.values(b.appSeconds).reduce((a,b)=>a+b,0))).toEqual([120,180])
  expect((db.prepare("SELECT block_id FROM window_activity WHERE stage='rest'").get() as {block_id:number}).block_id).toBe(block)
  repo.retime(parts,at(0),at(10),[at(7)]);expect(distractions.runs([parts[1]])[0].startedAt).toBe(at(7))
  expect((db.prepare('SELECT COUNT(*) AS n FROM window_activity').get() as {n:number}).n).toBe(2)
})
it('updates all affected focus totals when a crossing distraction is moved, removed or confirmed',()=>{
  const id=distractions.addManual([block],at(4),at(8),'phone'),parts=repo.transaction(()=>repo.splitPart(block,[101]))
  distractions.retime(id,at(2),at(6));expect(focus()).toEqual([120,240])
  distractions.delete(id);expect(focus()).toEqual([300,300])
  const idle=distractions.insertIdle(parts[0],at(4),240);distractions.confirm(idle);expect(focus()).toEqual([240,120])
  distractions.retime(idle,at(6),at(9));expect(focus()).toEqual([300,120])
  distractions.delete(idle);expect(focus()).toEqual([300,300])
})
it('assigns exact-boundary events to the next part and rejects invalid corrections atomically',()=>{
  const id=distractions.addManual([block],at(5),at(8),'phone'),parts=repo.transaction(()=>repo.splitPart(block,[101]))
  expect(distractions.blockOf(id)).toBe(parts[1]);expect(focus()).toEqual([300,120])
  expect(()=>repo.retime(parts,at(0),at(10),[NaN])).toThrow('Invalid');expect(focus()).toEqual([300,120])
})
it('keeps crossing event portions when deleting their original anchor part',()=>{
  const event=distractions.addManual([block],at(4),at(8),'phone'),parts=repo.splitPart(block,[101])
  distractions.addWindowRun(parts[0],'focus',{startedAt:at(4),endedAt:at(8),process:'chrome',title:'Study'})
  new BlocksRepo(db,new LogRepo(db)).deleteBlock(parts[0]);expect(focus()).toEqual([120])
  expect(distractions.blockOf(event)).toBe(parts[1]);expect(distractions.forBlocks([parts[1]])[0].durationSeconds).toBe(180)
  expect(distractions.forBlocks([parts[1]])[0].atOffsetSeconds).toBe(0)
  repo.retime([parts[1]],at(5),at(10),[]);expect(focus()).toEqual([120])
  expect(distractions.runs([parts[1]])[0].startedAt).toBe(at(5))
})
it('rederives scoped app detections and resizes confirmed spans after divider corrections',()=>{
  distractions.saveRule({matchType:'process',pattern:'browser',classification:'distraction',itemId:100})
  distractions.saveRule({matchType:'process',pattern:'browser',classification:'study',itemId:101})
  distractions.addWindowRun(block,'focus',{startedAt:at(3),endedAt:at(8),process:'browser',title:'Article'})
  distractions.deriveAuto([block]);const original=distractions.forBlocks([block])[0];distractions.confirm(original.id)
  const parts=repo.splitPart(block,[101]);distractions.deriveAuto(parts)
  expect(distractions.forBlocks(parts)).toHaveLength(1);expect(distractions.forBlocks(parts)[0]).toMatchObject({id:original.id,confirmed:true,durationSeconds:120})
  repo.retime(parts,at(0),at(10),[at(7)]);distractions.deriveAuto(parts)
  expect(distractions.forBlocks(parts)[0].durationSeconds).toBe(240)
})
it('conserves focus and program duration across one hundred deterministic corrections',()=>{
  distractions.addManual([block],at(1),at(2),'phone');distractions.addManual([block],at(4),at(8),'phone')
  distractions.addWindowRun(block,'focus',{startedAt:at(0),endedAt:at(10),process:'browser',title:'Study'})
  const parts=repo.splitPart(block,[101,102])
  for(let i=0;i<100;i++){
    const left=1+(i*17%250)/100,right=6+(i*29%250)/100
    repo.retime(parts,at(0),at(10),[at(left),at(right)])
    expect(focus().reduce((a,b)=>a+b)).toBeCloseTo(300,8)
    const raw=new StatsRepo(db,new LogRepo(db)).raw()
    expect(raw.blocks.flatMap(b=>Object.values(b.appSeconds)).reduce((a,b)=>a+b)).toBeCloseTo(600,8)
  }
  expect((db.prepare('SELECT COUNT(*) AS n FROM block_pauses').get() as {n:number}).n).toBe(2)
})
it('rolls back a failed split and all intermediate ownership changes',()=>{
  distractions.addManual([block],at(4),at(8),'phone')
  expect(()=>repo.splitPart(block,[101,999999])).toThrow()
  expect(focus()).toEqual([360])
  expect((db.prepare('SELECT origin FROM blocks WHERE id=?').get(block) as {origin:string}).origin).toBe('normal')
  expect(distractions.forBlocks([block])).toHaveLength(1)
})
