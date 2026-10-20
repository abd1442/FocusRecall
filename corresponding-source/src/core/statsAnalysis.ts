import { generatePersonalInsights, type PersonalInsightInput } from './personalInsights'
import type { StatSession, FactorDef } from './statsData'
import { rankFactors, type AnalysisOptions } from './insights'
import { discoveryQuestions } from './evidence'
import type { OutcomeKey } from './statsData'

/** Structured-clone transport only: the accepted evidence engine is unchanged. */
export interface PersonalAnalysisJob {
  kind: 'personal'
  sessions: StatSession[]
  factors: FactorDef[]
  options: AnalysisOptions
  input: Omit<PersonalInsightInput, 'activityLabel' | 'reasonLabel'>
  activities: Map<string,string>
  reasons: Map<string,string>
}
export function personalAnalysis(job: PersonalAnalysisJob): ReturnType<typeof generatePersonalInsights> {
  return generatePersonalInsights(job.sessions,job.factors,job.options,{
    ...job.input,
    activityLabel:id=>job.activities.get(id)??id,
    reasonLabel:id=>job.reasons.get(id)??id
  })
}

export interface RankingAnalysisJob {
  kind:'ranking'
  sessions:StatSession[]
  factors:FactorDef[]
  questionFactors:FactorDef[]
  options:AnalysisOptions
  outcome:OutcomeKey
}
export type StatsAnalysisJob=PersonalAnalysisJob|RankingAnalysisJob
export type StatsAnalysisResult<J extends StatsAnalysisJob>=J extends PersonalAnalysisJob?ReturnType<typeof personalAnalysis>:ReturnType<typeof rankFactors>
export function runStatsAnalysis<J extends StatsAnalysisJob>(job:J):StatsAnalysisResult<J> {
  // Family filters must retain the complete automatic search multiplicity.
  return (job.kind==='personal'?personalAnalysis(job):rankFactors(job.sessions,job.factors,job.outcome,job.options,discoveryQuestions(job.questionFactors,job.sessions))) as StatsAnalysisResult<J>
}
