// Timer modes: the adaptive target and what the clock shows.
import { formatClock, timerView, type TimerMode } from './timer'

export interface AdaptiveSample {
  itemId: number
  focusStartedAt: string
  focusSeconds: number
  focusRating: number | null
  origin: 'normal' | 'live_switch' | 'estimated_split'
  /** The session the block is a part of; sessions with more than one subject do not count. */
  sessionId?: number
}

export interface AdaptiveSuggestion {
  targetSeconds: number
  /** Blocks the suggestion is based on (0 when it fell back to the default). */
  basedOn: number
  reason: string
}

const MIN_QUALIFYING = 5
const LOOK_BACK = 10

/**
 * Adaptive target for a subject: the median focus length of its last 10
 * good blocks (focus Focused or Deep), rounded to 5 minutes and kept within
 * 15 to 50 minutes. Blocks split after the fact and blocks under 10 minutes
 * do not count, and neither do sessions with more than one subject. With
 * fewer than 5 good sessions it uses the default target.
 */
export function adaptiveTarget(samples: AdaptiveSample[], itemId: number, defaultSeconds: number): AdaptiveSuggestion {
  const good = goodSamples(samples, itemId)
  if (good.length < MIN_QUALIFYING) {
    return {
      targetSeconds: defaultSeconds,
      basedOn: 0,
      reason: `Your default target, until there are ${MIN_QUALIFYING} good sessions on this subject (${good.length} so far).`
    }
  }
  const lengths = good.map((s) => s.focusSeconds).sort((a, b) => a - b)
  const mid = Math.floor(lengths.length / 2)
  const median = lengths.length % 2 ? lengths[mid] : (lengths[mid - 1] + lengths[mid]) / 2
  const minutes = Math.min(50, Math.max(15, Math.round(median / 300) * 5))
  return {
    targetSeconds: minutes * 60,
    basedOn: good.length,
    reason: `Suggested ${minutes} min, based on your last ${good.length} good sessions on this subject.`
  }
}

/** Sessions whose parts are on more than one subject. */
export function mixedSessions(samples: { sessionId?: number; itemId: number }[]): Set<number> {
  const first = new Map<number, number>()
  const mixed = new Set<number>()
  for (const s of samples) {
    if (s.sessionId === undefined) continue
    const seen = first.get(s.sessionId)
    if (seen === undefined) first.set(s.sessionId, s.itemId)
    else if (seen !== s.itemId) mixed.add(s.sessionId)
  }
  return mixed
}

/** The last 10 good sessions on a subject that the adaptive target is based on, newest first. */
function goodSamples(samples: AdaptiveSample[], itemId: number): AdaptiveSample[] {
  const mixed = mixedSessions(samples)
  return samples
    .filter(
      (s) =>
        s.itemId === itemId &&
        s.origin !== 'estimated_split' &&
        !(s.sessionId !== undefined && mixed.has(s.sessionId)) &&
        s.focusSeconds >= 600 &&
        s.focusRating !== null &&
        s.focusRating >= 4
    )
    .sort((a, b) => Date.parse(b.focusStartedAt) - Date.parse(a.focusStartedAt))
    .slice(0, LOOK_BACK)
}

/** Focus seconds of the good sessions behind the suggestion (for the Adaptive diagram). */
export function goodSessionLengths(samples: AdaptiveSample[], itemId: number): number[] {
  return goodSamples(samples, itemId).map((s) => s.focusSeconds)
}

export interface ClockDisplay {
  /** Big digits. */
  main: string
  /** Beside the digits: "/ 25:00", "left of 20:00", "over 25:00". */
  aside: string
  overtime: boolean
  /** 0 to 1 toward the target (1 once reached). */
  progress: number
}

/**
 * Flow and Adaptive count up and show the target beside the time; Fixed
 * counts down. Past the target both show the overtime: "+03:10 over 25:00".
 */
export function clockDisplay(mode: TimerMode, targetSeconds: number, focusSeconds: number): ClockDisplay {
  const v = timerView(mode, targetSeconds, focusSeconds)
  const target = formatClock(targetSeconds)
  const progress = targetSeconds > 0 ? Math.min(1, focusSeconds / targetSeconds) : 1
  if (v.reached) return { main: `+${formatClock(v.overtimeSeconds)}`, aside: `over ${target}`, overtime: true, progress: 1 }
  if (mode === 'fixed') return { main: formatClock(v.displaySeconds), aside: `left of ${target}`, overtime: false, progress }
  return { main: formatClock(v.displaySeconds), aside: `/ ${target}`, overtime: false, progress }
}
