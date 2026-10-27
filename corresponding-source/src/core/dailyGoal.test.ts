import { expect,it } from 'vitest'
import { dailyGoalProgress } from './dailyGoal'
import type { RunningBlock } from './session'
import { validateIpcArgs } from './ipcValidation'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
const now=new Date(2026,9,23,12).getTime(),start=new Date(now-600000).toISOString()
const running={id:2,focusStartedAt:start,pauses:[{startedAt:new Date(now-300000).toISOString(),endedAt:null}]} as RunningBlock
it('counts recorded and live Focus once, excluding paused time',()=>{
 const p=dailyGoalProgress([{id:1,focusStartedAt:start,focusSeconds:600},{id:2,focusStartedAt:start,focusSeconds:999}],running,now,'04:00',180)
 expect(p.seconds).toBe(900);expect(p.target).toBe(10800)
 expect(dailyGoalProgress([],running,now+120000,'04:00',180).seconds).toBe(300)
})
it('uses configured study-day rollover, consistent with History',()=>{
 const at=new Date(2026,9,24,3).getTime(),rows=[{id:1,focusStartedAt:new Date(2026,9,23,15).toISOString(),focusSeconds:3600}]
 expect(dailyGoalProgress(rows,null,at,'04:00',180).seconds).toBe(3600)
 expect(dailyGoalProgress(rows,null,at+3600000,'04:00',180).seconds).toBe(0)
})
it.each([[0,0],[.25,1],[.5,2],[.75,3],[1,4],[2,4]])('has a bounded visual at progress %s',(ratio,stage)=>{
 const p=dailyGoalProgress([{id:1,focusStartedAt:start,focusSeconds:ratio*10800}],null,now,'04:00',180)
 expect(p.stage).toBe(stage);expect(p.ratio).toBe(Math.min(1,ratio));expect(p.seconds).toBe(ratio*10800)
})
it('defaults off and persists an intentional target without writing history',()=>{
 const db=openDatabase(':memory:');try{const repo=new SettingsRepo(db);expect(repo.getAll().dailyStudyGoalMinutes).toBe(0);repo.set('dailyStudyGoalMinutes',180);expect(new SettingsRepo(db).getAll().dailyStudyGoalMinutes).toBe(180);repo.set('dailyStudyGoalMinutes',0);expect(repo.getAll().dailyStudyGoalMinutes).toBe(0)}finally{db.close()}
})
it('bounds goal settings at the IPC boundary',()=>{
 for(const n of [-1,1441,.5,Infinity])expect(()=>validateIpcArgs('settings:set',['dailyStudyGoalMinutes',n])).toThrow()
 for(const n of [0,15,180,1440])expect(()=>validateIpcArgs('settings:set',['dailyStudyGoalMinutes',n])).not.toThrow()
})
