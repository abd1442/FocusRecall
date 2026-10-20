import type { PersonalInsight } from './personalInsights'
import { distractionSupportLevel } from './distractionEvidence'
import { translate, type AppLanguage } from './localization'
import { localizedCount, localizedEvidenceCount } from './localizedCount'
import { METHOD_OBSERVATION_NOTE } from './recommendations'

/** Display helpers never change the analytical result or convert ordinal
 * ratings into percentages of learning. */
export function insightDifference(c:PersonalInsight):{value:string;direction:string;unit:string}|null {
  if(!c.outcome || c.rows.length<2)return null
  const diff=c.rows[0].value-c.rows[1].value
  return {value:`${diff>0?'+':''}${diff.toFixed(1)}`,direction:diff>0?'higher':diff<0?'lower':'similar',unit:c.outcome==='length'?'focused min':'rating points'}
}
export function orderedInsightProfile(c:PersonalInsight):NonNullable<PersonalInsight['profile']> {
  const order=(label:string):number=>{
    if(/under|before|أقل من|moins de|menos de|unter|少于/.test(label))return -1
    const n=Number(label.match(/\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(n)?n:Infinity
  }
  return [...(c.profile??[])].sort((a,b)=>order(a.label)-order(b.label)||a.label.localeCompare(b.label))
}

/** Describe the measured outcome, never an effect on learning or a causal claim. */
export function insightTakeaway(c:PersonalInsight, language:AppLanguage = 'en'):{text:string;comparison:string;tone:'positive'|'caution'|'neutral'} {
  const text = (key:string, values?:Record<string,string|number>):string => translate(language,key,values)
  const [first,other]=c.rows
  if(!first)return {text:text('Not enough comparable records'),comparison:'',tone:'neutral'}
  if(c.family==='distractions'){
    const key=c.unit==='minutes'?(other?.value===first.value?'{reason}: joint most recorded distraction time':'{reason}: most recorded distraction time'):(other?.value===first.value?'{reason}: joint most recorded interruptions':'{reason}: most recorded interruptions')
    return {text:text(key,{reason:first.label}),comparison:text('Recorded events, not inferred intent'),tone:'neutral'}
  }
  if(!other||!c.outcome||!Number.isFinite(first.value-other.value))return {text:c.title,comparison:'',tone:'neutral'}
  const diff=first.value-other.value,direction=diff>0?'higher':diff<0?'lower':'similar'
  const subject=c.family==='time'?text('{condition} starts',{condition:first.label}):c.family==='sleep'?text('{condition} sleep',{condition:first.label}):c.family==='rest'?text('After {condition} breaks',{condition:first.label}):c.family==='length'?text('{condition} sessions',{condition:first.label}):first.label
  const lengthDirection=diff>0?'longer':diff<0?'shorter':'similar'
  const summary=c.family==='trend'?text('{outcome}: {direction} in the latest four weeks',{outcome:text(c.outcome==='length'?'Focused sessions':c.outcome==='focus'?'Focus ratings':'Recall ratings'),direction:text(c.outcome==='length'?lengthDirection:direction)}):
    c.outcome==='length'?text('{subject}: {direction} focused sessions',{subject,direction:text(lengthDirection)}):text('{subject}: {direction} {outcome} ratings',{subject,direction:text(direction),outcome:text(c.outcome)})
  return {text:summary,comparison:text('Compared with {condition}',{condition:other.label}),tone:c.presentation?.methodComparison||c.outcome==='length'||diff===0?'neutral':diff>0?'positive':'caution'}
}

/** Day-level comparisons must not be relabeled or added into unique session totals. */
export function insightRecordBasis(c:PersonalInsight, language:AppLanguage = 'en'):{count:number;unit:string;comparison:string;status:string} {
  const count=c.outcome?c.sessions:c.n
  return {count,unit:translate(language,c.outcome?(count===1?'session':'sessions'):(count===1?'event':'events')),comparison:c.outcome?localizedEvidenceCount(c.n,c.unit,language)+' '+translate(language,'vs')+' '+localizedEvidenceCount(c.nOther,c.unit,language):localizedCount(c.days,'studyDay',language),status:translate(language,insightReliability(c).label)}
}

export type InsightReliability={level:0|1|2|3|null;label:string;description:string}
/** Presentation of the existing evidence gates. Counts alone never imply replication. */
export function insightReliability(c:PersonalInsight):InsightReliability {
  if(c.presentation?.methodComparison)return {level:null,label:'Recorded comparison',description:METHOD_OBSERVATION_NOTE}
  if(c.family==='distractions'){
    const e=c.recordSupport,level=e?distractionSupportLevel(e):0
    if(level===0)return {level,label:'Not enough evidence',description:e&&!e.uniqueLeader?'The totals are tied; there is no single leading recorded reason.':e&&e.reasonCount<2?'Only one eligible reason is recorded; there is no ranking comparison yet.':'Too few eligible events or recorded days to support a leading reason.'}
    if(level===1)return {level,label:'Early pattern',description:'The leading recorded reason is not yet repeated across both earlier and later days.'}
    if(level===2)return {level,label:'Repeated pattern',description:'The same recorded reason leads in both time periods; coverage or single-day robustness is still limited.'}
    return {level,label:'Well-supported pattern',description:'The same reason leads across enough events and days, repeats over time, and remains first when any one day is left out.'}
  }
  if(c.sharedEvidence)return c.sharedEvidence.status==='exploratory'?{level:1,label:'Exploratory association',description:'Matching does not remove unrecorded confounding. A screened association is not an established conclusion or proof of benefit.'}:{level:0,label:'Recorded comparison',description:'Counts alone do not determine evidence. Check the uncertainty interval, time coverage and search scope.'}
  if(!c.outcome)return {level:0,label:'Not enough evidence',description:'No eligible comparison is available.'}
  if(c.rows.length<2||!c.rows.every(r=>Number.isFinite(r.value))||Math.min(c.n,c.nOther)<5||Math.min(c.days,c.daysOther)<3)return {level:0,label:'Not enough evidence',description:'Too few comparable observations or study days for a pattern.'}
  if(!c.replicated)return {level:1,label:'Early pattern',description:'A usable comparison, not yet repeated in both earlier and later records.'}
  if(c.evidence==='Stronger evidence'&&Math.min(c.n,c.nOther)>=20&&Math.min(c.days,c.daysOther)>=8)return {level:3,label:'Well-supported pattern',description:'Enough comparable records and study days, with the direction repeated over time.'}
  return {level:2,label:'Repeated pattern',description:'The direction repeats over time, but sample or day coverage is still limited.'}
}
