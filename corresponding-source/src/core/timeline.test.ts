import { describe, expect, it } from 'vitest'
import { axisTicks, clampSpan, flattenLine, lineTotals, moveSpan, partAt, previewLine, removesTime, timeTicks, type LineDistraction, type LinePart } from './timeline'

const MIN = 60_000
const parts: LinePart[] = [
  { id: 1, itemId: 10, start: 0, end: 20 * MIN },
  { id: 2, itemId: 20, start: 20 * MIN, end: 30 * MIN }
]
const d = (id: number, from: number, to: number, p: Partial<LineDistraction> = {}): LineDistraction => ({
  id,
  start: from * MIN,
  end: to * MIN,
  source: 'manual',
  confirmed: true,
  ...p
})

describe('removesTime', () => {
  it('is true for Distracted spells and confirmed idle only', () => {
    expect(removesTime({ source: 'manual', confirmed: true })).toBe(true)
    expect(removesTime({ source: 'idle', confirmed: false })).toBe(false)
    expect(removesTime({ source: 'idle', confirmed: true })).toBe(true)
    expect(removesTime({ source: 'auto', confirmed: true })).toBe(false)
  })
})

describe('previewLine', () => {
  it('gives focus per part and per subject as drawn, with the session numbers', () => {
    const p = previewLine(parts, [d(1, 5, 8), d(2, 18, 22), d(3, 25, 26, { source: 'auto' })])
    expect(p.parts).toEqual({ 1: 15 * 60, 2: 8 * 60 })
    expect(p.subjects).toEqual({ 10: 15 * 60, 20: 8 * 60 })
    expect(p.totalFocus).toBe(23 * 60)
    expect(p.stats.distractionCount).toBe(3)
    expect(p.stats.distractedSeconds).toBe(8 * 60)
  })
})

describe('dragging spans', () => {
  it('keeps a span inside the session and at least 5 seconds long', () => {
    expect(clampSpan(-MIN, 5 * MIN, 0, 30 * MIN)).toEqual({ start: 0, end: 5 * MIN })
    expect(clampSpan(10 * MIN, 40 * MIN, 0, 30 * MIN)).toEqual({ start: 10 * MIN, end: 30 * MIN })
    expect(clampSpan(10 * MIN, 10 * MIN, 0, 30 * MIN)).toEqual({ start: 10 * MIN, end: 10 * MIN + 5000 })
  })
  it('moves a whole span without changing its length', () => {
    expect(moveSpan(5 * MIN, 8 * MIN, 2 * MIN, 0, 30 * MIN)).toEqual({ start: 7 * MIN, end: 10 * MIN })
    expect(moveSpan(5 * MIN, 8 * MIN, 40 * MIN, 0, 30 * MIN)).toEqual({ start: 27 * MIN, end: 30 * MIN })
    expect(moveSpan(5 * MIN, 8 * MIN, -40 * MIN, 0, 30 * MIN)).toEqual({ start: 0, end: 3 * MIN })
  })
  it('finds the part under a moment', () => {
    expect(partAt(parts, 5 * MIN)?.id).toBe(1)
    expect(partAt(parts, 20 * MIN)?.id).toBe(2)
    expect(partAt(parts, 30 * MIN)?.id).toBe(2)
    expect(partAt(parts, 31 * MIN)).toBeNull()
  })
})

describe('timeTicks', () => {
  it('chooses a step so a line gets a handful of marks on whole minutes', () => {
    const from = new Date(2026, 9, 12, 9, 3, 20).getTime()
    const ticks = timeTicks(from, from + 42 * MIN)
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    expect(ticks.length).toBeLessThanOrEqual(10)
    expect(new Date(ticks[0]).getMinutes() % 5).toBe(0)
    expect(new Date(ticks[0]).getSeconds()).toBe(0)
    expect(new Date(ticks[1]).getTime() - ticks[0]).toBe(5 * MIN)
    expect(timeTicks(from, from + 3 * MIN)).toHaveLength(3)
  })
})

describe('flattenLine', () => {
  it('cuts focus into side-by-side pieces, the pressed one winning over a detection', () => {
    const segs = flattenLine(parts, [d(1, 5, 8), d(2, 6, 12, { source: 'auto', confirmed: false })])
    expect(segs.map((s) => [s.kind, s.start / MIN, s.end / MIN])).toEqual([
      ['focus', 0, 5],
      ['distracted', 5, 8],
      ['detected', 8, 12],
      ['focus', 12, 20],
      ['focus', 20, 30]
    ])
    expect(segs[2].confirmed).toBe(false)
    expect(segs[4].partId).toBe(2)
  })
  it('splits a distraction across a switch and adds up the kinds', () => {
    const segs = flattenLine(parts, [d(1, 18, 22, { source: 'idle', confirmed: true })])
    expect(segs.filter((s) => s.kind === 'idle').map((s) => s.partId)).toEqual([1, 2])
    expect(lineTotals(segs)).toEqual({ focus: 26 * 60, distracted: 0, detected: 0, idle: 4 * 60 })
  })
})

describe('axisTicks', () => {
  const from = new Date(2026, 9, 12, 9, 2, 0).getTime()
  it('uses 1, 5, 10 or 15 minute steps that fit the width, away from the ends', () => {
    const wide = axisTicks(from, from + 40 * MIN, 1600)
    expect(new Date(wide[1]).getTime() - wide[0]).toBe(5 * MIN)
    const narrow = axisTicks(from, from + 40 * MIN, 400)
    expect(new Date(narrow[1]).getTime() - narrow[0]).toBe(10 * MIN)
    for (const t of narrow) expect(t - from).toBeGreaterThan(MIN * 5)
    expect(axisTicks(from, from + 3 * MIN, 1600).length).toBeGreaterThanOrEqual(1)
  })
})
