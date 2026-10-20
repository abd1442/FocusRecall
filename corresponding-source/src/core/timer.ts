// Interval arithmetic on the session timeline. The main-process observation
// guard excludes suspend, missing observations and clock discontinuities.

export type TimerMode = 'flow' | 'fixed' | 'adaptive'

export interface Interval {
  start: number
  /** null = still open (e.g. a pause in progress). */
  end: number | null
}

/** Total length of the part of each interval that falls inside [from, to]. */
export function overlapMs(intervals: Interval[], from: number, to: number): number {
  let total = 0
  for (const iv of intervals) {
    const s = Math.max(iv.start, from)
    const e = Math.min(iv.end ?? to, to)
    if (e > s) total += e - s
  }
  return total
}

/**
 * Focus time in ms between `start` and `at`: wall time minus paused time
 * minus removed (confirmed idle) time. Intervals may overlap each other;
 * overlapping parts are only removed once.
 */
export function focusMsAt(start: number, at: number, removed: Interval[]): number {
  if (at <= start) return 0
  return Math.max(0, at - start - overlapMs(mergeIntervals(removed, at), start, at))
}

/** Merge overlapping intervals; open intervals are closed at `now`. */
export function mergeIntervals(intervals: Interval[], now: number): { start: number; end: number }[] {
  const sorted = intervals
    .map((iv) => ({ start: iv.start, end: iv.end ?? now }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start)
  const out: { start: number; end: number }[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end)
    else out.push({ ...iv })
  }
  return out
}

/**
 * The wall-clock moment at which focus time reaches `offsetMs` after `start`,
 * skipping removed intervals. The inverse of focusMsAt: it returns the
 * earliest such moment, so an offset taken at the start of a pause maps back
 * to the start of that pause.
 */
export function wallAtFocusOffset(start: number, offsetMs: number, removed: Interval[]): number {
  let t = start
  let remaining = Math.max(0, offsetMs)
  for (const iv of mergeIntervals(removed, Number.MAX_SAFE_INTEGER)) {
    if (iv.end <= t) continue
    if (iv.start > t) {
      const gap = iv.start - t
      if (remaining <= gap) return t + remaining
      remaining -= gap
    }
    t = Math.max(t, iv.end)
  }
  return t + remaining
}

export function isPaused(pauses: Interval[]): boolean {
  return pauses.some((p) => p.end === null)
}

export interface TimerView {
  /** Seconds to show on the clock (always >= 0). */
  displaySeconds: number
  /** 'down' while a fixed timer counts toward zero, otherwise 'up'. */
  direction: 'up' | 'down'
  reached: boolean
  /** Seconds past the target (0 before it). */
  overtimeSeconds: number
}

/**
 * What the clock shows. Flow and adaptive count up toward the target and keep
 * counting. Fixed counts down to zero, then counts the overtime up.
 */
export function timerView(mode: TimerMode, targetSeconds: number, focusSeconds: number): TimerView {
  const reached = focusSeconds >= targetSeconds
  const overtimeSeconds = reached ? focusSeconds - targetSeconds : 0
  if (mode === 'fixed') {
    return reached
      ? { displaySeconds: overtimeSeconds, direction: 'up', reached, overtimeSeconds }
      : { displaySeconds: targetSeconds - focusSeconds, direction: 'down', reached, overtimeSeconds }
  }
  return { displaySeconds: focusSeconds, direction: 'up', reached, overtimeSeconds }
}

/**
 * Milliseconds of wall time until the focus clock reaches the target, or
 * null when it will not get there without user action (paused) or already has.
 */
export function msUntilTarget(
  start: number,
  now: number,
  removed: Interval[],
  targetSeconds: number
): number | null {
  if (isPaused(removed)) return null
  const remaining = targetSeconds * 1000 - focusMsAt(start, now, removed)
  return remaining > 0 ? remaining : null
}

/** "mm:ss", or "h:mm:ss" from one hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Short human duration: "45 s", "12 min", "1 h 05 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
