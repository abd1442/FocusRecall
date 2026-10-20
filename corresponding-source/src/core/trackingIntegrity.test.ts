import { afterEach,describe,expect,it,vi } from 'vitest'
import { powerMonitor } from 'electron'
import { EventEmitter } from 'node:events'
import { NativeForegroundWatcher, type ForegroundWatcher } from '../main/foreground'
import { Tracker } from '../main/tracking'
import { LANGUAGES,translate } from './localization'
import { TRACKING_DISCLOSURE,TITLE_DISCLOSURE,TRACKING_RECONFIRM,TRACKING_COVERAGE_NOTE,TRACKING_SAVE_FAILURE,persistTrackingPreference } from './trackingConsent'
import { trackingConsented } from './trackingConsent'
import { SettingsRepo } from '../main/repos/settings'
import { openDatabase } from '../main/db/database'
import { IDLE_STATE,type SessionState } from './session'
import { NO_TITLE,classify } from './tracking'
import type { DistractionRepo } from '../main/repos/distractions'
vi.mock('electron',()=>({app:{isPackaged:false,getAppMetrics:()=>[]},powerMonitor:{getSystemIdleTime:vi.fn(()=>0)}}))
afterEach(()=>vi.useRealTimers())
const focus=():SessionState=>({...IDLE_STATE,stage:'focus',running:{id:1,sessionId:1,sittingId:1,itemId:1,itemName:'QA',itemColor:'#fff',timerMode:'flow',targetSeconds:60,focusStartedAt:new Date(Date.now()-600000).toISOString(),pauses:[],parts:[],targetAlerted:false}})
const sample=()=>({at:Date.now(),pid:999,process:'QA-browser',title:'Fictional private document'})
function tracker(){
 const watcher=Object.assign(new EventEmitter(),{start:vi.fn(),stop:vi.fn(),fail:vi.fn(),setTitlesEnabled:vi.fn(),status:()=>({state:'running' as const})})
 const repo={addWindowRun:vi.fn(),deriveAuto:vi.fn(),insertIdle:vi.fn(),rules:()=>[],flagRestScreen:vi.fn()}
 return {watcher,repo,tracker:new Tracker(watcher as unknown as ForegroundWatcher,repo as unknown as DistractionRepo,vi.fn())}
}
describe('tracking consent and upgrade',()=>{
 it('has authored privacy controls, qualifications and badges in all seven languages',()=>{
  for(const {id} of LANGUAGES)for(const key of [TRACKING_DISCLOSURE,TITLE_DISCLOSURE,TRACKING_RECONFIRM,TRACKING_COVERAGE_NOTE,TRACKING_SAVE_FAILURE,'Record window titles','App time','Window activity','Detected distractions']){const text=translate(id,key);expect(text).toBeTruthy();if(id!=='en')expect(text).not.toBe(key)}
 })
 it('stops before persisting privacy changes and stays stopped if storage fails',()=>{
  const db=openDatabase(':memory:'),s=new SettingsRepo(db),events:string[]=[]
  expect(()=>persistTrackingPreference('foregroundTrackingEnabled',()=>{events.push('write');throw Error('disk full')},()=>s.getAll(),enabled=>events.push(enabled?'on':'off'))).toThrow(TRACKING_SAVE_FAILURE)
  expect(events).toEqual(['off','write','off']);expect(trackingConsented(s.getAll())).toBe(false)
  events.length=0;persistTrackingPreference('foregroundTrackingEnabled',()=>{events.push('write');s.set('foregroundTrackingEnabled',true)},()=>s.getAll(),enabled=>events.push(enabled?'on':'off'));expect(events).toEqual(['off','write','on'])
  expect(()=>persistTrackingPreference('nextGoal',()=>{throw Error('other write failed')},()=>s.getAll(),()=>{throw Error('unrelated collection change')})).toThrow('other write failed');db.close()
 })
 it.each([undefined,true,false,'true',1,null])('never infers informed consent from legacy %s',value=>{
  const db=openDatabase(':memory:');if(value!==undefined)db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('foregroundTrackingEnabled',JSON.stringify(value))
  const repo=new SettingsRepo(db),before=repo.readRaw('foregroundTrackingEnabled')
  expect(trackingConsented(repo.getAll())).toBe(false);expect(repo.getAll().foregroundTrackingTitlesEnabled).toBe(false)
  expect(repo.readRaw('foregroundTrackingEnabled')).toEqual(before)
  repo.set('foregroundTrackingEnabled',true);expect(trackingConsented(new SettingsRepo(db).getAll())).toBe(true)
  repo.set('foregroundTrackingEnabled',false);expect(trackingConsented(repo.getAll())).toBe(false);db.close()
 })
 it.each([true,'1',2,null])('does not treat malformed or unsupported consent %s as permission',marker=>{
  const db=openDatabase(':memory:'),s=new SettingsRepo(db);s.writeRaw('foregroundTrackingEnabled',true);s.writeRaw('foregroundTrackingConsentVersion',marker);s.writeRaw('foregroundTrackingTitlesEnabled','true')
  expect(trackingConsented(s.getAll())).toBe(false);expect(s.getAll().foregroundTrackingTitlesEnabled).toBe(false);expect(s.readRaw('foregroundTrackingConsentVersion')).toEqual(marker);db.close()
 })
 it('preserves an intentional current opt-in and separate title choice on restart',()=>{
  const db=openDatabase(':memory:'),s=new SettingsRepo(db);s.set('foregroundTrackingEnabled',true);s.set('foregroundTrackingTitlesEnabled',true)
  const r=new SettingsRepo(db);expect(trackingConsented(r.getAll())).toBe(true);expect(r.getAll().foregroundTrackingTitlesEnabled).toBe(true);db.close()
 })
})
describe('native watcher without helper processes',()=>{
 it('loads lazily, passes a false title flag, stops polling and retries only after stop',()=>{
  vi.useFakeTimers();const read=vi.fn(()=>sample()),load=vi.fn(()=>({read})),w=new NativeForegroundWatcher(load),samples=vi.fn();w.on('sample',samples)
  expect(load).not.toHaveBeenCalled();w.start();w.start();vi.advanceTimersByTime(4000)
  expect(load).toHaveBeenCalledOnce();expect(read).toHaveBeenCalledTimes(3);expect(read).toHaveBeenLastCalledWith(false);expect(samples.mock.calls[0][0].title).toBe('')
  w.stop();vi.advanceTimersByTime(60000);expect(read).toHaveBeenCalledTimes(3);expect(vi.getTimerCount()).toBe(0)
  w.setTitlesEnabled(true);w.start();expect(read).toHaveBeenLastCalledWith(true);w.stop()
 })
 it('checks timing/recovery before reading Windows and honors a stop during that check',()=>{
  vi.useFakeTimers();const read=vi.fn(()=>sample());let w:NativeForegroundWatcher
  w=new NativeForegroundWatcher(()=>({read}),Date.now,()=>w.stop());w.start();expect(read).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
 })
 it('contains blocked load and runtime failures without exposing paths or titles or retry storms',()=>{
  vi.useFakeTimers();const load=vi.fn(()=>{throw Error('C:/private/title')});const w=new NativeForegroundWatcher(load);w.start();w.start();vi.advanceTimersByTime(60000)
  expect(load).toHaveBeenCalledOnce();expect(w.status()).toMatchObject({state:'failed'});expect(JSON.stringify(w.status())).not.toContain('private');expect(vi.getTimerCount()).toBe(0);w.stop();expect(w.status().state).toBe('failed')
  const read=vi.fn(()=>{throw Error('secret')});const x=new NativeForegroundWatcher(()=>({read}));x.start();expect(vi.getTimerCount()).toBe(0);x.stop()
 })
 it('reports restricted windows as unavailable and resumes without inventing samples',()=>{
  vi.useFakeTimers();const read=vi.fn().mockReturnValueOnce(null).mockReturnValue(sample()),w=new NativeForegroundWatcher(()=>({read})),seen=vi.fn();w.on('sample',seen);w.start();expect(seen).not.toHaveBeenCalled();expect(w.status().state).toBe('failed');vi.advanceTimersByTime(2000);expect(seen).toHaveBeenCalledOnce();expect(w.status().state).toBe('running');w.stop()
 })
 it.each([{pid:0,process:'QA',title:''},{pid:1,process:'',title:''},{pid:1,process:'QA',title:'x'.repeat(1024)}])('rejects malformed native data',s=>{
  const w=new NativeForegroundWatcher(()=>({read:()=>s})),seen=vi.fn();w.on('sample',seen);w.start();expect(seen).not.toHaveBeenCalled();expect(w.status().state).toBe('failed');w.stop()
 })
})
describe('tracking lifecycle and data minimization',()=>{
 it('strips titles independently at persistence and ignores app-owned or disabled samples',()=>{
  vi.useFakeTimers();const h=tracker();h.tracker.sync(focus());h.tracker.setEnabled(true);h.watcher.emit('sample',sample());vi.advanceTimersByTime(2000);h.watcher.emit('sample',sample());h.tracker.setEnabled(false)
  expect(h.repo.addWindowRun.mock.calls[0][2].title).toBe(NO_TITLE)
  const count=h.repo.addWindowRun.mock.calls.length;h.watcher.emit('sample',sample());expect(h.repo.addWindowRun).toHaveBeenCalledTimes(count)
  h.tracker.setEnabled(true,true);h.watcher.emit('sample',{...sample(),pid:process.pid});vi.advanceTimersByTime(2000);h.tracker.dispose();expect(h.repo.addWindowRun).toHaveBeenCalledTimes(count)
  expect(classify('QA',NO_TITLE,[{id:1,matchType:'title',pattern:'unknown',classification:'distraction'}])).toBe('unknown')
 })
 it('revokes tracking even when flushing optional activity fails',()=>{
  vi.useFakeTimers();const h=tracker();h.tracker.setEnabled(true,true);h.tracker.sync(focus());h.watcher.emit('sample',sample());vi.advanceTimersByTime(2000);h.watcher.emit('sample',sample());h.repo.addWindowRun.mockImplementation(()=>{throw Error('storage blocked')})
  expect(()=>h.tracker.setEnabled(false)).not.toThrow();const count=h.repo.addWindowRun.mock.calls.length;h.watcher.emit('sample',sample());expect(h.repo.addWindowRun).toHaveBeenCalledTimes(count);h.tracker.dispose();expect(vi.getTimerCount()).toBe(0)
 })
 it.each(['interrupt','dispose'] as const)('stops collection before a failed activity flush on %s',action=>{
  vi.useFakeTimers();const h=tracker();h.tracker.setEnabled(true,true);h.tracker.sync(focus());h.watcher.emit('sample',sample());vi.advanceTimersByTime(2000);h.watcher.emit('sample',sample());h.repo.addWindowRun.mockImplementation(()=>{throw Error('storage blocked')})
  expect(()=>action==='dispose'?h.tracker.dispose():h.tracker.interrupt(Date.now())).not.toThrow();expect(h.watcher.stop).toHaveBeenCalled();h.tracker.dispose();expect(vi.getTimerCount()).toBe(0)
 })
 it('never carries an idle interval across opt-out after optional writes fail',()=>{
  vi.useFakeTimers();vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(1200);const h=tracker();h.tracker.setEnabled(true);h.tracker.sync(focus());h.watcher.emit('sample',sample());vi.advanceTimersByTime(300000)
  h.repo.addWindowRun.mockImplementation(()=>{throw Error('full')});h.repo.insertIdle.mockImplementation(()=>{throw Error('full')});expect(()=>h.tracker.setEnabled(false)).not.toThrow();expect(h.repo.insertIdle).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(600000);h.tracker.setEnabled(true);h.tracker.dispose();expect(h.repo.insertIdle).toHaveBeenCalledOnce();vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0)
 })
 it('keeps session completion usable when optional derivation fails',()=>{
  vi.useFakeTimers();const h=tracker();h.tracker.setEnabled(true);h.tracker.sync(focus());h.repo.deriveAuto.mockImplementation(()=>{throw Error('optional write failed')});expect(()=>h.tracker.partEnded(1,Date.now())).not.toThrow();expect(h.watcher.fail).toHaveBeenCalledOnce();h.tracker.dispose();expect(vi.getTimerCount()).toBe(0)
 })
 it('does not sample Recall, logging, paused Focus, planned/over Rest or recovery',()=>{
  vi.useFakeTimers();const h=tracker();h.tracker.setEnabled(true,true)
  const f=focus(),r={blockId:1,itemId:1,phase:'plan' as const,plannedSeconds:60,long:false,startedAt:null,endsAt:null,actualSeconds:null}
  for(const state of [IDLE_STATE,{...IDLE_STATE,stage:'recall' as const,step:'recall' as const},{...IDLE_STATE,stage:'recall' as const,step:'log' as const},{...f,running:{...f.running!,pauses:[{startedAt:new Date().toISOString(),endedAt:null}]}},{...IDLE_STATE,stage:'rest' as const,rest:r},{...IDLE_STATE,stage:'rest' as const,rest:{...r,phase:'over' as const}},{...f,recovery:{blockId:1,itemName:'QA',itemColor:'#fff',focusStartedAt:new Date().toISOString(),lastKnownAt:new Date().toISOString(),focusSecondsAtLastKnown:0}}]){
   h.tracker.sync(state);h.watcher.emit('sample',sample())
  }
  expect(h.watcher.start).not.toHaveBeenCalled();expect(h.repo.addWindowRun).not.toHaveBeenCalled();h.tracker.dispose();expect(vi.getTimerCount()).toBe(0)
 })
 it('does not bridge an observation outage or accept backwards/invalid samples',()=>{
  vi.useFakeTimers();const h=tracker();h.tracker.setEnabled(true,true);h.tracker.sync(focus());const base=Date.now();h.watcher.emit('sample',sample());vi.advanceTimersByTime(2000);h.watcher.emit('sample',sample());h.watcher.emit('sample',{...sample(),at:base-100});h.watcher.emit('sample',{...sample(),at:NaN});vi.advanceTimersByTime(60000);h.watcher.emit('sample',sample());h.tracker.dispose()
  expect(h.repo.addWindowRun.mock.calls[0][2]).toMatchObject({startedAt:base,endedAt:base+2000});expect(h.repo.addWindowRun.mock.calls.every(c=>c[2].endedAt-c[2].startedAt<=4000)).toBe(true)
 })
 it('never backdates idle collection before opt-in or the first observed sample',()=>{
  vi.useFakeTimers();vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(1200)
  const h=tracker(),base=Date.now();h.tracker.sync(focus());h.tracker.setEnabled(true);h.watcher.emit('sample',sample());vi.advanceTimersByTime(300000);h.tracker.setEnabled(false)
  expect(h.repo.insertIdle).toHaveBeenCalledOnce();expect(h.repo.insertIdle.mock.calls[0][1]).toBe(base)
  h.tracker.dispose();vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0)
 })
 it('keeps logical timestamps on a clock adjustment and stops after disposal',()=>{
  vi.useFakeTimers();const h=tracker();h.tracker.setEnabled(true,true);h.tracker.sync({...focus(),clockOffsetMs:3600000});const base=Date.now()+3600000;h.watcher.emit('sample',sample());vi.advanceTimersByTime(2000);h.watcher.emit('sample',sample());h.tracker.dispose();h.watcher.emit('sample',sample());expect(h.repo.addWindowRun.mock.calls[0][2]).toMatchObject({startedAt:base,endedAt:base+2000});expect(vi.getTimerCount()).toBe(0)
 })
})
