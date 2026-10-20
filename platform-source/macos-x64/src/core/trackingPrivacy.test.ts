import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { Tracker } from '../main/tracking'
import type { ForegroundWatcher } from '../main/foreground'
import type { DistractionRepo } from '../main/repos/distractions'
import { IDLE_STATE, type SessionState } from './session'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
import { powerMonitor } from 'electron'
vi.mock('electron', () => ({app:{getAppMetrics:()=>[]},powerMonitor:{getSystemIdleTime:vi.fn(()=>0)}}))
afterEach(() => vi.useRealTimers())
it('does not collect automatic idle gaps when tracking is disabled',()=>{
  vi.useFakeTimers();vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(600)
  const watcher=Object.assign(new EventEmitter(),{start:vi.fn(),stop:vi.fn(),status:()=>({state:'stopped' as const})}),repo={addWindowRun:vi.fn(),deriveAuto:vi.fn(),insertIdle:vi.fn()}
  const tracker=new Tracker(watcher as unknown as ForegroundWatcher,repo as unknown as DistractionRepo,vi.fn())
  tracker.sync({...IDLE_STATE,stage:'focus',running:{id:1,sessionId:1,sittingId:1,itemId:1,itemName:'QA',itemColor:'#fff',timerMode:'flow',targetSeconds:1500,focusStartedAt:new Date().toISOString(),pauses:[],parts:[],targetAlerted:false}})
  vi.advanceTimersByTime(600000);tracker.sync(IDLE_STATE);tracker.dispose()
  expect(repo.insertIdle).not.toHaveBeenCalled();expect(watcher.start).not.toHaveBeenCalled()
  vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0)
})
it('new profiles start tracking off with a guide, and retain explicit choices across reads', () => {
  const db = openDatabase(':memory:'), s = new SettingsRepo(db)
  expect(s.getAll().foregroundTrackingEnabled).toBe(false)
  expect(s.getAll().starterGuideCompleted).toBe(false)
  s.writeRaw('foregroundTrackingEnabled','true'); expect(s.getAll().foregroundTrackingEnabled).toBe(false)
  s.set('foregroundTrackingEnabled',true); expect(new SettingsRepo(db).getAll().foregroundTrackingEnabled).toBe(true)
  s.set('foregroundTrackingEnabled',false); expect(s.getAll().foregroundTrackingEnabled).toBe(false); db.close()
})
it('does not turn tracking on or show first-use setup when upgrading an existing profile',()=>{
  const db=openDatabase(':memory:')
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('nextGoal',JSON.stringify('Existing private study'))
  const s=new SettingsRepo(db)
  expect(s.getAll().foregroundTrackingEnabled).toBe(false)
  expect(s.getAll().starterGuideCompleted).toBe(true)
  s.set('foregroundTrackingEnabled',false);s.set('starterGuideCompleted',true)
  expect(new SettingsRepo(db).getAll().foregroundTrackingEnabled).toBe(false)
  expect(new SettingsRepo(db).getAll().starterGuideCompleted).toBe(true);db.close()
})
it('does not start or persist samples by default; stops immediately and rejects late samples', () => {
  vi.useFakeTimers()
  const watcher = Object.assign(new EventEmitter(),{start:vi.fn(),stop:vi.fn(),status:()=>({state:'stopped' as const})})
  const repo = {addWindowRun:vi.fn(),deriveAuto:vi.fn(),insertIdle:vi.fn()}
  const tracker = new Tracker(watcher as unknown as ForegroundWatcher,repo as unknown as DistractionRepo,vi.fn())
  const state: SessionState = {...IDLE_STATE,stage:'focus',running:{id:1,sessionId:1,sittingId:1,itemId:1,itemName:'QA',itemColor:'#fff',timerMode:'flow',targetSeconds:60,focusStartedAt:new Date().toISOString(),pauses:[],parts:[],targetAlerted:false}}
  const sample = {at:Date.now(),pid:0,process:'browser',title:'private'}
  tracker.sync(state); watcher.emit('sample',sample)
  expect(watcher.start).not.toHaveBeenCalled(); expect(repo.addWindowRun).not.toHaveBeenCalled()
  tracker.setEnabled(true); expect(watcher.start).toHaveBeenCalledOnce()
  watcher.emit('sample',sample); watcher.emit('sample',{...sample,at:sample.at+2000})
  vi.setSystemTime(sample.at+3000); tracker.setEnabled(false)
  const writes=repo.addWindowRun.mock.calls.length
  expect(writes).toBe(1); watcher.emit('sample',{...sample,at:sample.at+4000})
  expect(repo.addWindowRun).toHaveBeenCalledTimes(writes)
  tracker.sync({...IDLE_STATE,stage:'rest',rest:{blockId:1,itemId:1,phase:'running',plannedSeconds:60,long:false,startedAt:new Date().toISOString(),endsAt:new Date(Date.now()+60000).toISOString(),actualSeconds:null}})
  expect(watcher.start).toHaveBeenCalledOnce()
  tracker.dispose(); expect(vi.getTimerCount()).toBe(0)
})
it('checks timing before buffered foreground samples and closes activity at the interruption cutoff', () => {
  vi.useFakeTimers()
  const watcher=Object.assign(new EventEmitter(),{start:vi.fn(),stop:vi.fn(),status:()=>({state:'stopped' as const})})
  const repo={addWindowRun:vi.fn(),deriveAuto:vi.fn(),insertIdle:vi.fn()}
  let interrupted=false
  const tracker=new Tracker(watcher as unknown as ForegroundWatcher,repo as unknown as DistractionRepo,vi.fn(),()=>{
    if(interrupted){tracker.interrupt(base+2000);tracker.sync({...IDLE_STATE,recovery:{blockId:1,itemName:'QA',itemColor:'#fff',focusStartedAt:new Date(base).toISOString(),lastKnownAt:new Date(base+2000).toISOString(),focusSecondsAtLastKnown:2}})}
  })
  const base=Date.now()
  tracker.setEnabled(true)
  tracker.sync({...IDLE_STATE,stage:'focus',running:{id:1,sessionId:1,sittingId:1,itemId:1,itemName:'QA',itemColor:'#fff',timerMode:'flow',targetSeconds:1500,focusStartedAt:new Date(base).toISOString(),pauses:[],parts:[],targetAlerted:false}})
  watcher.emit('sample',{at:base,pid:0,process:'fictional',title:'QA'})
  watcher.emit('sample',{at:base+2000,pid:0,process:'fictional',title:'QA'})
  interrupted=true
  watcher.emit('sample',{at:base+8*3600000,pid:0,process:'fictional',title:'QA'})
  expect(repo.addWindowRun).toHaveBeenCalledTimes(1)
  expect(repo.addWindowRun.mock.calls[0][2]).toMatchObject({startedAt:base,endedAt:base+2000})
  tracker.dispose()
})
