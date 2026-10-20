import { createContext } from 'react'
import type { OutcomeKey } from '@core/statsData'

/** Includes sections not yet visited; repeated restores override local choices. */
export const RestoredOutcomeContext = createContext<{ outcome: OutcomeKey; revision: number } | null>(null)
