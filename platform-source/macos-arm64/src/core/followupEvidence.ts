import { screenEvidence,compareEvidence, contextOf, EVIDENCE_VERSION, type EvidenceResult } from './evidence'
import type { OutcomeKey, StatSession } from './statsData'

export interface FrozenQuestion {
  algorithmVersion:string; factorKey:string; option:string; outcome:OutcomeKey; alternatives:string[]
  contexts:string[]; from:string; to:string; cutoff:string; direction:number; revision:string
}
export type FollowupState='Later records not checked yet'|'Analysis method changed; save the question again'|'Original records changed; save the question again'|'Not enough later comparison days'|'Later records point the same way'|'Later records point the other way'|'Later records are inconclusive'
export function freezeQuestion(e:EvidenceResult,factorKey:string,option:string,rows:StatSession[],checkedOn:string):FrozenQuestion {
  return {algorithmVersion:e.algorithmVersion,factorKey,option,outcome:e.outcomeId,alternatives:[...new Set(rows.flatMap(s=>s.factors[factorKey]??[]))].sort(),contexts:[...e.scope.contexts],from:e.dateRange.from,to:e.dateRange.to,cutoff:checkedOn>e.discoveryCutoff?checkedOn:e.discoveryCutoff,direction:Math.sign(e.estimate??0),revision:e.dataRevision}
}
/** Rechecks a frozen question only when requested. Disjoint later records are
 * not searched for a new winning option. This remains observational evidence. */
export function checkLaterRecords(q:FrozenQuestion,rows:StatSession[]):{state:FollowupState;evidence:EvidenceResult|null;checkpoint:number} {
  const factor={key:q.factorKey,label:q.factorKey,options:q.alternatives,group:'derived' as const,multi:true},o={includeUntouched:false,withinSubject:true}
  const extra=q.factorKey==='insight-rest'?(s:StatSession)=>s.factors['insight-rest-context']?.[0]??'':undefined
  const original=compareEvidence(rows.filter(s=>s.day>=q.from&&s.day<=q.to),factor,q.option,q.outcome,o,extra)
  if(q.algorithmVersion!==EVIDENCE_VERSION)return {state:'Analysis method changed; save the question again',evidence:null,checkpoint:0}
  if(original.dataRevision!==q.revision)return {state:'Original records changed; save the question again',evidence:null,checkpoint:0}
  const later=rows.filter(s=>s.day>q.cutoff&&s.itemIds.length===1&&q.contexts.includes(contextOf(s,extra?.(s)??(q.outcome==='length'?JSON.stringify([s.timerMode,s.targetSeconds]):'')))&&(s.factors[q.factorKey]??[]).every(a=>q.alternatives.includes(a)))
  // Fixed checkpoints. Do not keep looking at every newly added session.
  const days=[...new Set(later.map(s=>s.day))].sort(),checkpoints=[10,20,40,80,160],checkpoint=checkpoints.filter(n=>days.length>=n).at(-1)??0
  if(!checkpoint)return {state:'Not enough later comparison days',evidence:null,checkpoint:0}
  const end=days[checkpoint-1],rawEvidence=compareEvidence(later.filter(s=>s.day<=end),factor,q.option,q.outcome,o,extra)
  const evidence=screenEvidence(rawEvidence,checkpoints.length,'followup')
  if(evidence.scope.contexts.join('|')!==q.contexts.join('|')||evidence.groups.some(g=>g.days<10))return {state:'Not enough later comparison days',evidence,checkpoint}
  const state:FollowupState=evidence.status!=='exploratory'?'Later records are inconclusive':Math.sign(evidence.estimate!)===q.direction?'Later records point the same way':'Later records point the other way'
  return {state,evidence,checkpoint}
}
