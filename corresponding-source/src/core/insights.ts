// Honest comparisons over the per-session records (statsData.ts): sample sizes
// always, nothing shown under 5 sessions a side, and a plain-word strength.
// These are patterns in one person's data, not proof of cause.
import { compareEvidence, discoveryQuestions, screenEvidence, eligibleOutcome, eligibleFactor, type EvidenceResult } from './evidence'
import { outcomeDef, type FactorDef, type OutcomeKey, type StatSession } from './statsData'

/** Smallest group shown in any comparison. */
export const MIN_SESSIONS = 5

export type Strength = 'none' | 'early' | 'likely' | 'consistent'

export const STRENGTH_LABEL: Record<Strength, string> = {
  none: 'Recorded comparison',
  early: 'Exploratory association',
  likely: 'Larger descriptive difference',
  consistent: 'Repeated descriptive difference'
}

export const STRENGTH_RULE =
  'Matched context-day comparisons require repeated condition episodes and calendar blocks on each side. Block length follows condition persistence. Sparse contexts remain descriptive. Intervals use a conservative block sensitivity and a small-sample t reference. Multiple options and automatic searches retain their search correction. This is observational evidence, not proof of learning.'

export interface AnalysisOptions {
  /** Compare each session with the usual for its own subject. */
  withinSubject: boolean
  /** Count sliders left at their default (excluded by default). */
  includeUntouched: boolean
}

export const DEFAULT_ANALYSIS: AnalysisOptions = { withinSubject: false, includeUntouched: false }

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
/** An outcome of a session, or undefined when missing or an excluded untouched default. */
export function outcomeOf(s: StatSession, k: OutcomeKey, o: AnalysisOptions = DEFAULT_ANALYSIS): number | undefined {
  return eligibleOutcome(s,k,o)
}

/** A factor's answers for a session, or undefined when missing or an excluded untouched default. */
export function factorOf(s: StatSession, key: string, o: AnalysisOptions = DEFAULT_ANALYSIS): string[] | undefined {
  return eligibleFactor(s,key,o)
}

/**
 * Outcome values ready for comparison: the raw value, or with "within the same
 * subject" the difference from that subject's own average (so a hard subject
 * studied in one place does not make the place look bad).
 */
export function outcomeValues(sessions: StatSession[], k: OutcomeKey, o: AnalysisOptions): Map<StatSession, number> {
  const out = new Map<StatSession, number>()
  for (const s of sessions) {
    if(s.itemIds?.length!==1)continue
    const v = outcomeOf(s, k, o)
    if (v !== undefined) out.set(s, v)
  }
  if (!o.withinSubject) return out
  const byItem = new Map<number, number[]>()
  for (const [s, v] of out) byItem.set(s.itemId, [...(byItem.get(s.itemId) ?? []), v])
  const avg = new Map([...byItem].map(([id, xs]) => [id, mean(xs)]))
  for (const [s, v] of out) out.set(s, v - avg.get(s.itemId)!)
  return out
}

export interface Comparison {
  evidence?:EvidenceResult
  countUnit?:'sessions'|'study days'
  adjusted?:boolean
  factor: FactorDef
  option: string
  outcome: OutcomeKey
  n: number
  nRest: number
  /** Raw averages (never residuals), for display. */
  mean: number
  meanRest: number
  /** Matched context-day difference. Positive means higher with this option. */
  diff: number
  /** Positive when the option goes with a better outcome. */
  better: number
  stable: boolean
  strength: Strength | null
}

/** One option of one factor against every other answered session, on one outcome. */
export function compare(sessions: StatSession[], factor: FactorDef, option: string, k: OutcomeKey, o: AnalysisOptions = DEFAULT_ANALYSIS): Comparison {
  const evidence=compareEvidence(sessions,factor,option,k,o),[a,b]=evidence.groups
  const diff=evidence.estimate??NaN
  const sign=outcomeDef(k).higherIsBetter===null?0:outcomeDef(k).higherIsBetter?1:-1
  return {evidence,countUnit:'study days',adjusted:true,factor,option,outcome:k,n:a.days,nRest:b.days,mean:a.mean,meanRest:b.mean,diff,better:Number.isFinite(diff)?sign*diff:0,stable:false,strength:evidence.status==='insufficient'?null:evidence.status==='exploratory'?'early':'none'}
}

export function compareFactor(sessions:StatSession[],factor:FactorDef,k:OutcomeKey,o:AnalysisOptions=DEFAULT_ANALYSIS):Comparison[] {
  const seen=new Set(sessions.flatMap(s=>factorOf(s,factor.key,o)??[]))
  const options=[...factor.options.filter(x=>seen.has(x)),...[...seen].filter(x=>!factor.options.includes(x))]
  return options.map(option=>screenComparison(compare(sessions,factor,option,k,o),Math.max(1,options.length),'selected'))
}
/** The estimate is shared; selection scope changes its uncertainty and label. */
export function screenComparison(c:Comparison,questions:number,scope:'selected'|'automatic'='automatic'):Comparison {
  if(!c.evidence)return c
  const evidence=screenEvidence(c.evidence,questions,scope)
  return {...c,evidence,strength:evidence.status==='insufficient'?null:evidence.status==='exploratory'?'early':'none'}
}
/** Stable question order after the entire snapshot search has been corrected. */
export function rankFactors(sessions:StatSession[],factors:FactorDef[],k:OutcomeKey,o:AnalysisOptions=DEFAULT_ANALYSIS,questions=discoveryQuestions(factors,sessions)):{positive:Comparison[];negative:Comparison[]} {
  const all=factors.flatMap(f=>compareFactor(sessions,f,k,o)).map(c=>screenComparison(c,questions)).filter(c=>c.evidence?.status==='exploratory')
  const order=(a:Comparison,b:Comparison):number=>a.factor.key.localeCompare(b.factor.key)||a.option.localeCompare(b.option)
  return {positive:all.filter(c=>c.better>0).sort(order),negative:all.filter(c=>c.better<0).sort(order)}
}
export interface GroupRow { key:string; n:number; mean:number; nOutcome:number }
export function groupBy(sessions:StatSession[],keyOf:(s:StatSession)=>string|null,k:OutcomeKey,o:AnalysisOptions=DEFAULT_ANALYSIS,order?:string[]):GroupRow[] {
  const groups=new Map<string,StatSession[]>()
  for(const s of sessions){const key=keyOf(s);if(key!==null){const a=groups.get(key)??[];a.push(s);groups.set(key,a)}}
  const rows=[...groups].map(([key,ss])=>{const values=ss.map(s=>outcomeOf(s,k,o)).filter((v):v is number=>v!==undefined);return {key,n:ss.length,mean:mean(values),nOutcome:values.length}})
  return rows.sort(order?(a,b)=>order.indexOf(a.key)-order.indexOf(b.key):(a,b)=>b.n-a.n)
}
export function diffText(c:Pick<Comparison,'diff'|'outcome'>):string {
  const def=outcomeDef(c.outcome),d=c.diff,digits=def.unit==='steps'||def.unit==='per hour'?1:0
  return `${d>0?'+':d<0?'−':'±'}${Math.abs(d).toFixed(digits)} ${def.unit==='%'||def.unit==='% of prior pace'?'points':def.unit}`
}
