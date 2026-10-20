/** Evidence for the leading *recorded* interruption, not accuracy of unrecorded time. */
export interface DistractionDay { day:string; reasons:{label:string;events:number;seconds:number}[] }
export interface DistractionPeriodEvidence { events:number;days:number;leader:string|null;leaderEvents:number;leaderDays:number }
export interface DistractionEvidence {
  metric:'events'|'minutes';leader:string|null;uniqueLeader:boolean;reasonCount:number
  events:number;days:number;leaderEvents:number;leaderDays:number
  earlier:DistractionPeriodEvidence;later:DistractionPeriodEvidence
  repeated:boolean;robustToDayRemoval:boolean
}
export const DISTRACTION_SUPPORT_RULES={earlyEvents:5,earlyDays:3,repeatedHalfEvents:5,repeatedHalfDays:3,repeatedLeaderHalfEvents:3,repeatedLeaderHalfDays:2,strongEvents:40,strongDays:8,strongLeaderEvents:20,strongLeaderDays:8,strongHalfEvents:10,strongHalfDays:4,strongLeaderHalfEvents:5,strongLeaderHalfDays:3} as const
type Totals=Map<string,{events:number;value:number;days:number}>
function total(days:DistractionDay[],metric:'events'|'minutes'):Totals {
  const result:Totals=new Map()
  for(const day of days)for(const r of day.reasons){const value=metric==='events'?r.events:r.seconds;if(value<=0)continue;const t=result.get(r.label)??{events:0,value:0,days:0};t.events+=r.events;t.value+=value;t.days++;result.set(r.label,t)}
  return result
}
function leader(totals:Totals):string|null {
  const sorted=[...totals].sort((a,b)=>b[1].value-a[1].value||a[0].localeCompare(b[0]));if(!sorted.length)return null
  if(sorted[1]&&Math.abs(sorted[0][1].value-sorted[1][1].value)<=1e-9*Math.max(1,sorted[0][1].value))return null
  return sorted[0][0]
}
export function buildDistractionEvidence(input:DistractionDay[],metric:'events'|'minutes'):DistractionEvidence {
  // Merge sessions on the same day before splitting; a single-day burst cannot
  // masquerade as evidence from multiple days or appear in both time halves.
  const grouped=new Map<string,Map<string,{label:string;events:number;seconds:number}>>()
  for(const day of input)for(const r of day.reasons){if(!Number.isFinite(r.events)||!Number.isFinite(r.seconds)||r.events<=0||(metric==='minutes'&&r.seconds<=0))continue;const group=grouped.get(day.day)??new Map(),old=group.get(r.label)??{label:r.label,events:0,seconds:0};old.events+=r.events;old.seconds+=Math.max(0,r.seconds);group.set(r.label,old);grouped.set(day.day,group)}
  const days=[...grouped].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,reasons])=>({day,reasons:[...reasons.values()]})),all=total(days,metric),top=leader(all),topTotal=top?all.get(top):undefined
  const period=(slice:DistractionDay[]):DistractionPeriodEvidence=>{const totals=total(slice,metric),t=top?totals.get(top):undefined;return {events:[...totals.values()].reduce((n,v)=>n+v.events,0),days:slice.length,leader:leader(totals),leaderEvents:t?.events??0,leaderDays:t?.days??0}}
  const cut=Math.floor(days.length/2),earlier=period(days.slice(0,cut)),later=period(days.slice(cut)),r=DISTRACTION_SUPPORT_RULES
  const eligible=(p:DistractionPeriodEvidence):boolean=>p.events>=r.repeatedHalfEvents&&p.days>=r.repeatedHalfDays&&p.leaderEvents>=r.repeatedLeaderHalfEvents&&p.leaderDays>=r.repeatedLeaderHalfDays
  const repeated=!!top&&all.size>=2&&earlier.leader===top&&later.leader===top&&eligible(earlier)&&eligible(later)
  // Test every omitted day, rather than only removing one conspicuous event.
  const robustToDayRemoval=!!top&&days.length>1&&days.every(day=>{
    const reduced:Totals=new Map([...all].map(([key,t])=>[key,{...t}]))
    for(const row of day.reasons){const t=reduced.get(row.label)!;t.value-=metric==='events'?row.events:row.seconds;if(t.value<=1e-9)reduced.delete(row.label)}
    return leader(reduced)===top
  })
  return {metric,leader:top,uniqueLeader:!!top,reasonCount:all.size,events:[...all.values()].reduce((n,v)=>n+v.events,0),days:days.length,leaderEvents:topTotal?.events??0,leaderDays:topTotal?.days??0,earlier,later,repeated,robustToDayRemoval}
}
export function distractionSupportLevel(e:DistractionEvidence):0|1|2|3 {
  const r=DISTRACTION_SUPPORT_RULES
  if(!e.uniqueLeader||e.reasonCount<2||e.events<r.earlyEvents||e.days<r.earlyDays)return 0
  if(!e.repeated)return 1
  const strongHalf=(p:DistractionPeriodEvidence):boolean=>p.events>=r.strongHalfEvents&&p.days>=r.strongHalfDays&&p.leaderEvents>=r.strongLeaderHalfEvents&&p.leaderDays>=r.strongLeaderHalfDays
  return e.events>=r.strongEvents&&e.days>=r.strongDays&&e.leaderEvents>=r.strongLeaderEvents&&e.leaderDays>=r.strongLeaderDays&&strongHalf(e.earlier)&&strongHalf(e.later)&&e.robustToDayRemoval?3:2
}
