import { describe, expect, it } from 'vitest'
import { dayActivity, levelScale, streaks, yearGrid, yearTotals, yearsWithData } from './heatmap'

const at = (day: string, h: number): string => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).toISOString()

describe('dayActivity', () => {
  it('sums focus, counts sessions and subjects per study day (04:00 boundary)', () => {
    const m = dayActivity(
      [
        { focusStartedAt: at('2026-10-12', 9), focusSeconds: 600, sessionId: 1, itemId: 1 },
        { focusStartedAt: at('2026-10-12', 9), focusSeconds: 300, sessionId: 1, itemId: 2 },
        { focusStartedAt: at('2026-10-13', 2), focusSeconds: 900, sessionId: 2, itemId: 1 }
      ],
      '04:00'
    )
    expect(m.get('2026-10-12')).toEqual({ focusSeconds: 1800, sessions: 2, subjects: 2 })
    expect(m.has('2026-10-13')).toBe(false)
  })
})

describe('yearGrid', () => {
  it('has week columns starting on the chosen weekday, only days of the year, and month starts', () => {
    const g = yearGrid(2026, 6)
    expect(g.weeks[0][0]).toBeNull()
    expect(g.weeks[0].includes('2026-01-01')).toBe(true)
    expect(g.weeks.flat().filter(Boolean)).toHaveLength(365)
    expect(g.weeks.every((w) => w.length === 7)).toBe(true)
    expect(g.months).toHaveLength(12)
    expect(g.months[0]).toEqual({ month: 0, column: 0 })
    // Every column starts on Saturday.
    expect(new Date(`${g.weeks[1][0]}T12:00:00`).getDay()).toBe(6)
  })
})

describe('levelScale', () => {
  it('gives 0 for none and 1 to 4 by quarters of studied days', () => {
    const level = levelScale([0, 10, 20, 30, 40, 50, 60, 70, 80])
    expect(level(0)).toBe(0)
    expect(level(10)).toBe(1)
    expect(level(30)).toBe(2)
    expect(level(50)).toBe(3)
    expect(level(80)).toBe(4)
    expect(levelScale([0, 0])(5)).toBe(0)
  })
})

describe('streaks', () => {
  it('counts the current streak (today not yet studied is fine) and the longest', () => {
    const days = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11'])
    expect(streaks(days, '2026-10-12')).toEqual({ current: 2, longest: 4 })
    expect(streaks(days, '2026-10-11')).toEqual({ current: 2, longest: 4 })
    expect(streaks(days, '2026-10-14')).toEqual({ current: 0, longest: 4 })
  })
})

describe('year totals', () => {
  it('adds up one year and lists years with data', () => {
    const m = new Map([
      ['2026-10-12', { focusSeconds: 600, sessions: 2, subjects: 1 }],
      ['2025-12-31', { focusSeconds: 300, sessions: 1, subjects: 1 }]
    ])
    expect(yearTotals(m, 2026)).toEqual({ focusSeconds: 600, sessions: 2, activeDays: 1 })
    expect(yearsWithData(m, '2026-10-12')).toEqual([2026, 2025])
  })
})
