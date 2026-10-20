import { describe, expect, it } from 'vitest'
import { adaptiveTarget, clockDisplay, type AdaptiveSample } from './modes'

const MIN = 60
let day = 1
const s = (minutes: number, rating: number | null, p: Partial<AdaptiveSample> = {}): AdaptiveSample => ({
  itemId: 1,
  focusStartedAt: new Date(Date.UTC(2026, 8, day++)).toISOString(),
  focusSeconds: minutes * MIN,
  focusRating: rating,
  origin: 'normal',
  ...p
})

describe('adaptiveTarget', () => {
  it('falls back to the default with fewer than 5 good blocks', () => {
    const r = adaptiveTarget([s(30, 5), s(30, 4), s(30, 4), s(30, 4), s(30, 2)], 1, 25 * MIN)
    expect(r).toMatchObject({ targetSeconds: 25 * MIN, basedOn: 0 })
    expect(r.reason).toMatch(/4 so far/)
  })
  it('uses the median of good blocks, rounded to 5 minutes', () => {
    const r = adaptiveTarget([s(31, 4), s(33, 5), s(37, 4), s(36, 5), s(34, 4)], 1, 25 * MIN)
    expect(r.targetSeconds).toBe(35 * MIN)
    expect(r.basedOn).toBe(5)
    expect(r.reason).toBe('Suggested 35 min, based on your last 5 good sessions on this subject.')
  })
  it('clamps to 15-50 minutes', () => {
    expect(adaptiveTarget(Array.from({ length: 6 }, () => s(80, 5)), 1, 1500).targetSeconds).toBe(50 * MIN)
    expect(adaptiveTarget(Array.from({ length: 6 }, () => s(11, 5)), 1, 1500).targetSeconds).toBe(15 * MIN)
  })
  it('excludes estimated splits, short blocks, low ratings and other subjects', () => {
    const noise = [s(40, 5, { origin: 'estimated_split' }), s(8, 5), s(40, 3), s(40, 5, { itemId: 2 }), s(40, null)]
    const good = [s(20, 4), s(20, 4), s(20, 4), s(20, 4), s(20, 4)]
    expect(adaptiveTarget([...noise, ...good], 1, 1500).targetSeconds).toBe(20 * MIN)
  })
  it('only looks at the last 10 good blocks', () => {
    const old = Array.from({ length: 10 }, () => s(45, 5))
    const recent = Array.from({ length: 10 }, () => s(25, 5))
    expect(adaptiveTarget([...old, ...recent], 1, 1500)).toMatchObject({ targetSeconds: 25 * MIN, basedOn: 10 })
  })
})

describe('clockDisplay', () => {
  it('flow and adaptive show elapsed over target', () => {
    expect(clockDisplay('flow', 25 * MIN, 12 * MIN + 40)).toEqual({ main: '12:40', aside: '/ 25:00', overtime: false, progress: (12 * MIN + 40) / (25 * MIN) })
    expect(clockDisplay('adaptive', 35 * MIN, 0).aside).toBe('/ 35:00')
  })
  it('fixed counts down', () => {
    expect(clockDisplay('fixed', 20 * MIN, 5 * MIN)).toMatchObject({ main: '15:00', aside: 'left of 20:00', overtime: false })
  })
  it('shows overtime past the target in every mode', () => {
    for (const mode of ['flow', 'fixed', 'adaptive'] as const) {
      expect(clockDisplay(mode, 25 * MIN, 28 * MIN + 10)).toEqual({ main: '+03:10', aside: 'over 25:00', overtime: true, progress: 1 })
    }
  })
})

describe('adaptive target and sessions with several subjects', () => {
  it('leaves mixed sessions out', () => {
    const good: AdaptiveSample[] = Array.from({ length: 5 }, (_, i) => ({
      itemId: 1,
      focusStartedAt: new Date(2026, 9, 1 + i).toISOString(),
      focusSeconds: 40 * 60,
      focusRating: 5,
      origin: 'normal',
      sessionId: 100 + i
    }))
    expect(adaptiveTarget(good, 1, 1500).targetSeconds).toBe(40 * 60)
    // Session 100 also had a part on subject 2: it no longer counts, leaving 4 good sessions.
    const mixed = [...good, { ...good[0], itemId: 2 }]
    expect(adaptiveTarget(mixed, 1, 1500)).toMatchObject({ targetSeconds: 1500, basedOn: 0 })
  })
})
