import { ObservedClock } from './timingIntegrity'

/** Review time is measured only while the learner explicitly runs its timer. */
export interface ReviewClock { seconds:number; startedAt:number|null }
export function reviewElapsed(clock:ReviewClock,now:number):number {
  return Math.max(0,clock.seconds)+(clock.startedAt===null?0:Math.max(0,(now-clock.startedAt)/1000))
}
export function pauseReview(clock:ReviewClock,now:number):ReviewClock { return {seconds:reviewElapsed(clock,now),startedAt:null} }
/** Carry the larger persisted duration once, never count app downtime as review. */
export function resumedReviewSeconds(saved:number|null|undefined,draft:number|undefined):number {
  return Math.max(0,saved??0,draft??0)
}

/** Observed review time: an uncertain gap pauses until the learner explicitly resumes. */
export class ReviewTimer {
  private clock: ObservedClock
  private total = 0
  private active = false
  constructor(wallNow: () => number = Date.now, monotonicNow: () => number = () => performance.now()) {
    this.clock = new ObservedClock(wallNow, monotonicNow)
  }
  sample(): { seconds: number; running: boolean } {
    const sample = this.clock.sample()
    if (this.active && !sample.interrupted) this.total += (sample.at - sample.previous) / 1000
    if (sample.interrupted) this.active = false
    return { seconds: this.total, running: this.active }
  }
  start(): void { this.sample(); this.active = true }
  pause(): void { this.sample(); this.active = false }
  interrupt(): void { this.active = false }
}
