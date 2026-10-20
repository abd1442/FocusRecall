import { createContext } from 'react'
import type { PersonalInsight } from '@core/personalInsights'
export const InsightContext = createContext<PersonalInsight|null>(null)
