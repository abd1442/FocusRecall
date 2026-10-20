import { describe, expect, it } from 'vitest'
import { DEFAULT_QUALITY, countsAsLost, qualityOf, reasonLabel, sessionStats, type LostSpan } from './distractions'

const MIN = 60_000
const d = (startMin: number, minutes: number, p: Partial<LostSpan> = {}): LostSpan => ({
  startedAt: startMin * MIN,
  durationSeconds: minutes * 60,
  source: 'manual',
  confirmed: false,
  ...p
})

describe('countsAsLost', () => {
  it('counts Distracted presses and detected apps, and idle only once confirmed', () => {
    expect(countsAsLost({ source: 'manual', confirmed: false })).toBe(true)
    expect(countsAsLost({ source: 'pause', confirmed: false })).toBe(true)
    expect(countsAsLost({ source: 'auto', confirmed: false })).toBe(true)
    expect(countsAsLost({ source: 'idle', confirmed: false })).toBe(false)
    expect(countsAsLost({ source: 'idle', confirmed: true })).toBe(true)
  })
})

describe('sessionStats', () => {
  const parts = [
    { start: 0, end: 30 * MIN },
    { start: 30 * MIN, end: 50 * MIN }
  ]

  it('measures the whole session span across parts', () => {
    const s = sessionStats(parts, [d(10, 5)])
    expect(s.distractionCount).toBe(1)
    expect(s.distractedSeconds).toBe(300)
    expect(s.lostShare).toBeCloseTo(5 / 50)
    expect(s.longestStretchSeconds).toBe(35 * 60)
  })

  it('counts overlapping time once but every distraction in the number', () => {
    const s = sessionStats(parts, [d(10, 5), d(12, 5, { source: 'auto' })])
    expect(s.distractionCount).toBe(2)
    expect(s.distractedSeconds).toBe(7 * 60)
  })

  it('leaves out unconfirmed idle and clips to the session', () => {
    const s = sessionStats(parts, [d(20, 10, { source: 'idle' }), d(48, 10)])
    expect(s.distractionCount).toBe(1)
    expect(s.distractedSeconds).toBe(120)
    expect(s.longestStretchSeconds).toBe(48 * 60)
  })

  it('is empty without parts, and a clean session is one long stretch', () => {
    expect(sessionStats([], [d(1, 1)]).distractionCount).toBe(0)
    expect(sessionStats(parts, []).longestStretchSeconds).toBe(50 * 60)
  })
})

describe('qualityOf', () => {
  const stats = (share: number, count: number) => ({ distractionCount: count, distractedSeconds: 0, lostShare: share, longestStretchSeconds: 0 })
  it('applies the default thresholds', () => {
    expect(qualityOf(stats(0, 0), DEFAULT_QUALITY)).toBe('clean')
    expect(qualityOf(stats(0.04, 1), DEFAULT_QUALITY)).toBe('clean')
    expect(qualityOf(stats(0.04, 2), DEFAULT_QUALITY)).toBe('some')
    expect(qualityOf(stats(0.05, 1), DEFAULT_QUALITY)).toBe('some')
    expect(qualityOf(stats(0.149, 6), DEFAULT_QUALITY)).toBe('some')
    expect(qualityOf(stats(0.15, 0), DEFAULT_QUALITY)).toBe('distracted')
  })
  it('follows changed thresholds', () => {
    expect(qualityOf(stats(0.08, 3), { cleanMaxShare: 10, cleanMaxCount: 3, someMaxShare: 20 })).toBe('clean')
  })
})

describe('reasonLabel', () => {
  it('names reasons, other kinds and old reasons', () => {
    expect(reasonLabel('toilet-water')).toBe('Toilet or water')
    expect(reasonLabel('untagged')).toBe('No reason yet')
    expect(reasonLabel('tired-or-hungry')).toBe('Tired or hungry')
    expect(reasonLabel('something-new')).toBe('something new')
  })
})
