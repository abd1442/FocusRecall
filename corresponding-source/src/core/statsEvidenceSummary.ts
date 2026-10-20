import { addDays } from './studyDay'
import type { StatSession } from './statsData'

/** Keep edited future records in History, outside current analytical evidence. */
export function completedStatsSessions(sessions:StatSession[],today:string,now:number):StatSession[] {
  return sessions.filter(s=>s.day<=today&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>=s.start&&s.end<=now)
}

export interface RevisitSummary { itemId:number; days:number; last:string; medianGap:number|null; minGap:number|null; maxGap:number|null; largestDayShare:number; focusSeconds:number }
/** Activity summaries use subject parts, including minor subjects in mixed sessions. */
export function subjectRevisits(sessions:StatSession[]):RevisitSummary[] {
  const subjects=new Map<number,Map<string,number>>()
  const seen=new Set<number>()
  for(const s of sessions){if(seen.has(s.id))continue;seen.add(s.id)
    const parts=s.subjectParts??(s.itemIds.length===1?[{itemId:s.itemId,focusSeconds:s.focusSeconds}]:[])
    for(const p of parts){if(!Number.isFinite(p.focusSeconds)||p.focusSeconds<=0)continue;const days=subjects.get(p.itemId)??new Map<string,number>();days.set(s.day,(days.get(s.day)??0)+p.focusSeconds);subjects.set(p.itemId,days)}
  }
  return [...subjects].map(([itemId,byDay])=>{const days=[...byDay.keys()].sort(),gaps=days.slice(1).map((day,i)=>Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(days[i]+'T12:00:00Z'))/86400000)).sort((a,b)=>a-b),n=gaps.length,total=[...byDay.values()].reduce((a,b)=>a+b,0);return {itemId,days:days.length,last:days.at(-1)!,medianGap:n?(gaps[Math.floor((n-1)/2)]+gaps[Math.ceil((n-1)/2)])/2:null,minGap:n?gaps[0]:null,maxGap:n?gaps.at(-1)!:null,largestDayShare:Math.max(...byDay.values())/total,focusSeconds:total}}).sort((a,b)=>b.focusSeconds-a.focusSeconds||a.itemId-b.itemId)
}
/** Nonoverlapping windows. Missing calendar days remain unrecorded, not zero learning. */
export function activityBaseline(sessions:StatSession[],today:string) {
  const window=(from:string,to:string,calendarDays:number)=>{const rows=[...new Map(sessions.filter(s=>s.day>=from&&s.day<=to).map(s=>[s.id,s])).values()],days=new Set(rows.map(s=>s.day)).size,seconds=rows.reduce((n,s)=>n+Math.max(0,Number.isFinite(s.focusSeconds)?s.focusSeconds:0),0);return {from,to,calendarDays,sessions:rows.length,recordedDays:days,hoursPerCalendarWeek:seconds/3600/calendarDays*7,minutesPerRecordedDay:days?seconds/60/days:null}}
  return {recent:window(addDays(today,-27),today,28),earlier:window(addDays(today,-83),addDays(today,-28),56)}
}
