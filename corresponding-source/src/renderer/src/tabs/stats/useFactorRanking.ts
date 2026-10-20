import { useMemo } from 'react'
import type { StatSession, FactorDef, OutcomeKey } from '@core/statsData'
import type { AnalysisOptions } from '@core/insights'
import type { RankingAnalysisJob } from '@core/statsAnalysis'
import { useStatsAnalysis } from './useStatsAnalysis'

export function useFactorRanking(sessions:StatSession[],factors:FactorDef[],outcome:OutcomeKey,options:AnalysisOptions,questionFactors=factors) {
  const job=useMemo(():RankingAnalysisJob=>({kind:'ranking',sessions,factors,outcome,options,questionFactors}),[sessions,factors,outcome,options,questionFactors])
  return useStatsAnalysis(job)
}
