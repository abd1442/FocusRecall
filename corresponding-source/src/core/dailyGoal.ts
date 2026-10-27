import type { BlockSummary } from './stats'
import type { RunningBlock } from './session'
import { runningFocusSeconds } from './session'
import { parseDayStart, studyDayKey } from './studyDay'

/** Same block-start study-day attribution as History and the activity calendar. */
export function dailyGoalProgress(blocks:Pick<BlockSummary,'id'|'focusStartedAt'|'focusSeconds'>[], running:RunningBlock|null, now:number, dayStart:string, goalMinutes:number, recordedSeconds=0) {
 const boundary=parseDayStart(dayStart),day=studyDayKey(new Date(now),boundary)
 let seconds=Math.max(0,recordedSeconds)
 for(const b of blocks)if(b.id!==running?.id&&studyDayKey(new Date(b.focusStartedAt),boundary)===day)seconds+=Math.max(0,b.focusSeconds)
 if(running&&studyDayKey(new Date(running.focusStartedAt),boundary)===day)seconds+=Math.max(0,runningFocusSeconds(running,now))
 const target=Math.max(0,goalMinutes)*60,ratio=target?Math.min(1,seconds/target):0
 return {day,seconds,target,ratio,stage:ratio>=1?4:ratio>=.75?3:ratio>=.5?2:ratio>=.25?1:0}
}
