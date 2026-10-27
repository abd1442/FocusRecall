import { describe, expect, it } from 'vitest'
import {
  focusMsAt,
  wallAtFocusOffset,
  formatClock,
  formatDuration,
  isPaused,
  mergeIntervals,
  msUntilTarget,
  timerView
} from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 11, 8, 0, 0)

describe('focusMsAt', () => {
  it('is plain wall time without pauses', () => {
    expect(focusMsAt(T0, T0 + 25 * MIN, [])).toBe(25 * MIN)
  })
  it('is zero before the start', () => {
    expect(focusMsAt(T0, T0 - 5000, [])).toBe(0)
  })
  it('subtracts closed pauses', () => {
    const pauses = [{ start: T0 + 10 * MIN, end: T0 + 13 * MIN }]
    expect(focusMsAt(T0, T0 + 30 * MIN, pauses)).toBe(27 * MIN)
  })
  it('freezes during an open pause', () => {
    const pauses = [{ start: T0 + 10 * MIN, end: null }]
    expect(focusMsAt(T0, T0 + 11 * MIN, pauses)).toBe(10 * MIN)
    expect(focusMsAt(T0, T0 + 50 * MIN, pauses)).toBe(10 * MIN)
  })
  it('only counts the part of a pause inside the window', () => {
    const pauses = [{ start: T0 + 10 * MIN, end: T0 + 20 * MIN }]
    expect(focusMsAt(T0, T0 + 15 * MIN, pauses)).toBe(10 * MIN)
  })
  it('subtracts pauses and confirmed idle together without double counting overlap', () => {
    const pause = { start: T0 + 10 * MIN, end: T0 + 15 * MIN }
    const idle = { start: T0 + 12 * MIN, end: T0 + 20 * MIN } // overlaps the pause by 3 min
    expect(focusMsAt(T0, T0 + 40 * MIN, [pause, idle])).toBe(30 * MIN)
  })
  it('handles several pauses', () => {
    const pauses = [
      { start: T0 + 5 * MIN, end: T0 + 6 * MIN },
      { start: T0 + 20 * MIN, end: T0 + 22 * MIN }
    ]
    expect(focusMsAt(T0, T0 + 30 * MIN, pauses)).toBe(27 * MIN)
  })
})

describe('mergeIntervals', () => {
  it('merges overlaps, closes open ones at now and drops empty ones', () => {
    expect(
      mergeIntervals(
        [
          { start: 5, end: 10 },
          { start: 1, end: 3 },
          { start: 8, end: 12 },
          { start: 20, end: null },
          { start: 30, end: 30 }
        ],
        25
      )
    ).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 12 },
      { start: 20, end: 25 }
    ])
  })
})

describe('timerView', () => {
  it('flow counts up and keeps counting past the target', () => {
    expect(timerView('flow', 1500, 600)).toEqual({ displaySeconds: 600, direction: 'up', reached: false, overtimeSeconds: 0 })
    expect(timerView('flow', 1500, 1500).reached).toBe(true)
    expect(timerView('flow', 1500, 1800)).toEqual({ displaySeconds: 1800, direction: 'up', reached: true, overtimeSeconds: 300 })
  })
  it('adaptive behaves like flow', () => {
    expect(timerView('adaptive', 2100, 2200)).toEqual(timerView('flow', 2100, 2200))
  })
  it('fixed counts down, then overtime counts up from zero', () => {
    expect(timerView('fixed', 1200, 200)).toEqual({ displaySeconds: 1000, direction: 'down', reached: false, overtimeSeconds: 0 })
    expect(timerView('fixed', 1200, 1200)).toEqual({ displaySeconds: 0, direction: 'up', reached: true, overtimeSeconds: 0 })
    expect(timerView('fixed', 1200, 1290)).toEqual({ displaySeconds: 90, direction: 'up', reached: true, overtimeSeconds: 90 })
  })
})

describe('msUntilTarget', () => {
  it('is the remaining focus time when running', () => {
    expect(msUntilTarget(T0, T0 + 10 * MIN, [], 25 * 60)).toBe(15 * MIN)
  })
  it('accounts for past pauses', () => {
    const pauses = [{ start: T0 + 2 * MIN, end: T0 + 7 * MIN }]
    expect(msUntilTarget(T0, T0 + 10 * MIN, pauses, 25 * 60)).toBe(20 * MIN)
  })
  it('is null while paused or after the target', () => {
    expect(msUntilTarget(T0, T0 + 10 * MIN, [{ start: T0 + 9 * MIN, end: null }], 1500)).toBeNull()
    expect(msUntilTarget(T0, T0 + 26 * MIN, [], 1500)).toBeNull()
  })
  it('isPaused sees open pauses only', () => {
    expect(isPaused([{ start: 1, end: 2 }])).toBe(false)
    expect(isPaused([{ start: 1, end: 2 }, { start: 3, end: null }])).toBe(true)
  })
})

describe('formatting', () => {
  it('formats the clock', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65.9)).toBe('01:05')
    expect(formatClock(25 * 60)).toBe('25:00')
    expect(formatClock(3600 + 2 * 60 + 3)).toBe('1:02:03')
  })
  it('formats durations', () => {
    expect(formatDuration(42)).toBe('42 s')
    expect(formatDuration(12 * 60 + 10)).toBe('12 min')
    expect(formatDuration(65 * 60)).toBe('1 h 05 min')
  })
})

describe('wallAtFocusOffset', () => {
  const t0 = 1_000_000
  it('is the plain sum without removed time', () => {
    expect(wallAtFocusOffset(t0, 60_000, [])).toBe(t0 + 60_000)
  })
  it('skips removed time and maps a pause start back to the pause start', () => {
    const removed = [{ start: t0 + 10_000, end: t0 + 40_000 }]
    expect(wallAtFocusOffset(t0, 10_000, removed)).toBe(t0 + 10_000)
    expect(wallAtFocusOffset(t0, 20_000, removed)).toBe(t0 + 50_000)
    expect(focusMsAt(t0, wallAtFocusOffset(t0, 20_000, removed), removed)).toBe(20_000)
  })
})
