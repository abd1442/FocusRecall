import type { StatSession } from './statsData'
import { addDays } from './studyDay'
import { outcomeOf, type AnalysisOptions } from './insights'
import { subjectRevisits } from './statsEvidenceSummary'

/** Descriptive activity only. Call with the same completed, filtered rows as Stats. */
export function recordedActivity(input:StatSession[],today:string,options:AnalysisOptions) {
 const sessions=[...new Map(input.map(s=>[s.id,s])).values()]
 const seconds=(s:StatSession)=>Number.isFinite(s.focusSeconds)?Math.max(0,s.focusSeconds):0
 const byDay=new Map<string,number>(),overByDay=new Map<string,number>()
 // Overtime is focus beyond the session's target, as the timer shows it.
 const over=(s:StatSession)=>s.targetSeconds>0?Math.max(0,seconds(s)-s.targetSeconds):0
 for(const s of sessions){byDay.set(s.day,(byDay.get(s.day)??0)+seconds(s));overByDay.set(s.day,(overByDay.get(s.day)??0)+over(s))}
 const subjects=subjectRevisits(sessions)
 const ratings=(key:'focus'|'recall')=>sessions.reduce((n,s)=>n+(outcomeOf(s,key,options)===undefined?0:1),0)
 const recent=Array.from({length:14},(_,i)=>{const day=addDays(today,i-13);return {day,seconds:byDay.get(day)??0,overtime:overByDay.get(day)??0,recorded:byDay.has(day)}})
 return {sessions:sessions.length,days:byDay.size,seconds:sessions.reduce((n,s)=>n+seconds(s),0),subjects,recent,focus:ratings('focus'),recall:ratings('recall')}
}
