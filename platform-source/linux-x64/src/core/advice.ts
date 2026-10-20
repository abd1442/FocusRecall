import { ADVICE_CATALOG, adviceConcept, type AdviceIntent, type AdviceSurface, type AdviceTopic } from './adviceCatalog'
export type { AdviceIntent, AdviceSurface } from './adviceCatalog'
export interface AdviceExposure {id:string;at:number}
export interface AdviceHistory {version:1; exposures:AdviceExposure[]; less:AdviceTopic[]; current:Record<string,AdviceExposure>}
export const MAX_ADVICE_EXPOSURES=200
const DAY=86400000
/** Engineering rotation policy, not a scientifically optimal review schedule. */
export const ADVICE_POLICY={conceptCooldown:7*DAY,topicCooldown:DAY,visibleFor:30*60000,retention:90*DAY} as const
export function normalizeAdviceHistory(raw:unknown,now:number):AdviceHistory {
  const h=raw&&typeof raw==='object'?raw as Partial<AdviceHistory>:{}
  const valid=(x:unknown):x is AdviceExposure=>!!x&&typeof x==='object'&&typeof (x as AdviceExposure).id==='string'&&!!adviceConcept((x as AdviceExposure).id)&&Number.isFinite((x as AdviceExposure).at)&&(x as AdviceExposure).at>=now-ADVICE_POLICY.retention&&(x as AdviceExposure).at<=now
  const exposures=(Array.isArray(h.exposures)?h.exposures:[]).filter(valid).slice(-MAX_ADVICE_EXPOSURES)
  const topics=new Set(ADVICE_CATALOG.map(c=>c.topic))
  const less=[...new Set((Array.isArray(h.less)?h.less:[]).filter(t=>topics.has(t)))].slice(0,topics.size)
  const current:Record<string,AdviceExposure>={}
  if(h.current&&typeof h.current==='object')for(const surface of ['prepare','recall','rest','return','stats'])for(const intent of ['any','understand','practice','remember']){
    const key=`${surface}:${intent}`,entry=h.current[key]
    if(valid(entry)&&now-entry.at<ADVICE_POLICY.visibleFor)current[key]={id:entry.id,at:entry.at}
  }
  return {version:1,exposures:exposures.map(e=>({id:e.id,at:e.at})),less,current}
}
export interface AdviceSelection {id:string|null;history:AdviceHistory}
/** Uses only the explicit purpose and current surface. No notes, health,
 * ratings or correlations are read or inferred. Exhaustion can be silent. */
export function selectAdvice(raw:unknown,surface:AdviceSurface,intent:AdviceIntent,another=false,now=Date.now()):AdviceSelection {
  const history=normalizeAdviceHistory(raw,now),key=`${surface}:${intent}`,cached=history.current[key]
  const eligible=ADVICE_CATALOG.filter(c=>c.surfaces.includes(surface)&&!history.less.includes(c.topic)&&(intent==='any'||c.intent==='any'||c.intent===intent))
  if(!another&&cached&&eligible.some(c=>c.id===cached.id))return {id:cached.id,history}
  const last=(id:string):number=>history.exposures.filter(e=>e.id===id).at(-1)?.at??0
  const topicLast=(topic:AdviceTopic):number=>Math.max(0,...history.exposures.filter(e=>adviceConcept(e.id)?.topic===topic).map(e=>e.at))
  // "Another" explicitly relaxes topic cooldown only. It cannot cycle back
  // to the current/recent concept, or resurrect a topic the user muted.
  const candidates=eligible.filter(c=>c.id!==cached?.id&&(!last(c.id)||now-last(c.id)>=ADVICE_POLICY.conceptCooldown)&&(another||!topicLast(c.topic)||now-topicLast(c.topic)>=ADVICE_POLICY.topicCooldown))
  candidates.sort((a,b)=>(intent!=='any'?Number(b.intent===intent)-Number(a.intent===intent):0)||last(a.id)-last(b.id)||topicLast(a.topic)-topicLast(b.topic)||a.id.localeCompare(b.id))
  const id=candidates[0]?.id??null
  if(id){const entry={id,at:now};history.exposures.push(entry);history.exposures=history.exposures.slice(-MAX_ADVICE_EXPOSURES);history.current[key]=entry}
  else delete history.current[key]
  return {id,history}
}
export function lessAdvice(raw:unknown,id:string,now=Date.now()):AdviceHistory {
  const history=normalizeAdviceHistory(raw,now),topic=adviceConcept(id)?.topic
  if(topic&&!history.less.includes(topic))history.less.push(topic)
  for(const [key,e] of Object.entries(history.current))if(adviceConcept(e.id)?.topic===topic)delete history.current[key]
  return history
}
