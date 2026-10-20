/** Five-second observations tolerate scheduling jitter, but never credit a long blind gap. */
export const MAX_OBSERVATION_GAP_MS = 15_000
export const CLOCK_DISCONTINUITY_MS = 2_000

export interface TimeObservation { at: number; previous: number; interrupted: boolean }

/** Epoch-shaped, monotonic session timeline. A backward clock change never rewrites records. */
export class ObservedClock {
  private wall: number
  private monotonic: number
  at: number

  constructor(private wallNow: () => number = Date.now, private monotonicNow: () => number = () => performance.now(), floor = 0) {
    this.wall = wallNow()
    this.monotonic = monotonicNow()
    this.at = Math.max(this.wall, floor)
  }

  sample(): TimeObservation {
    const wall = this.wallNow(), monotonic = this.monotonicNow()
    const wallDelta = wall - this.wall, delta = monotonic - this.monotonic, previous = this.at
    const interrupted = delta < 0 || delta > MAX_OBSERVATION_GAP_MS || wallDelta > MAX_OBSERVATION_GAP_MS ||
      Math.abs(wallDelta - delta) > CLOCK_DISCONTINUITY_MS
    // Keep forward downtime representable as an excluded interval. On rollback,
    // preserve ordering on a logical timeline until a new engine is started.
    this.at = interrupted ? Math.max(previous, wall) : previous + Math.max(0, delta)
    this.wall = wall
    this.monotonic = monotonic
    return { at: this.at, previous, interrupted }
  }

  get offsetMs(): number { return this.at - this.wall }
}
