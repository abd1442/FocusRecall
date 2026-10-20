import { parseDayStart, studyDayKey, studyDayRange } from './studyDay'

/** One bounded timer also detects clock/time-zone changes while the window is idle. */
export class StudyDayClock {
  private timer: ReturnType<typeof setTimeout> | undefined
  constructor(private boundary: () => string, private changed: (day: string) => void, private now: () => Date = () => new Date()) {}
  current(): string { return studyDayKey(this.now(), parseDayStart(this.boundary())) }
  recheck = (): void => {
    clearTimeout(this.timer)
    const now = this.now(), boundary = parseDayStart(this.boundary())
    const day = studyDayKey(now, boundary)
    this.changed(day)
    this.timer = setTimeout(this.recheck, Math.max(1, Math.min(60_000, studyDayRange(day, boundary).end.getTime() - now.getTime() + 1)))
  }
  stop(): void { clearTimeout(this.timer) }
}

/** A choice is valid only for the exact rollover the user saw. */
export function checkinSaveDay(original: string, current: string, choice: { current: string; day: string } | null): string | null {
  if (original === current) return original
  return choice?.current === current && [original, current].includes(choice.day) ? choice.day : null
}
