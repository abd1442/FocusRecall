import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGES, hoursBeforeMoment, hoursLabel, normalizeStages, stageCrossings, stageFor, stageLine, suggestNewField } from './learning'

describe('learning stage', () => {
  it('starts in the first 20 hours', () => {
    const s = stageFor(7 + 40 / 60)
    expect(s.name).toBe('First 20 hours')
    expect(s.first).toBe(true)
    expect(s.progress).toBeCloseTo(7.667 / 20, 2)
    expect(stageLine(7 + 40 / 60, s)).toBe('7 h 40 of your first 20 hours')
  })
  it('moves on at each threshold, the last stage has no end', () => {
    expect(stageFor(20).name).toBe('20 to 50 hours')
    expect(stageFor(49.9).name).toBe('20 to 50 hours')
    expect(stageFor(100).name).toBe('100 hours and more')
    expect(stageFor(250).progress).toBe(1)
    expect(stageFor(30).fromHours).toBe(20)
  })
  it('keeps edited thresholds in order and always ends open', () => {
    const s = normalizeStages([
      { untilHours: 50, name: 'B' },
      { untilHours: 10, name: 'A' },
      { untilHours: 50, name: 'dup' }
    ])
    expect(s.map((x) => x.untilHours)).toEqual([10, 50, null])
    expect(s[2].name).toBe('50 hours and more')
  })
  it('formats hours', () => {
    expect(hoursLabel(0.5)).toBe('30 min')
    expect(hoursLabel(3)).toBe('3 h')
    expect(hoursLabel(12.25)).toBe('12 h 15')
  })
})

describe('stage crossings', () => {
  const H = 3_600_000
  it('places a crossing inside the session that passes the threshold', () => {
    const parts = [
      { itemId: 1, start: 0, end: 18 * H, focusSeconds: 18 * 3600 },
      { itemId: 1, start: 20 * H, end: 24 * H, focusSeconds: 4 * 3600 }
    ]
    const c = stageCrossings(parts, new Map(), DEFAULT_STAGES)
    expect(c).toHaveLength(1)
    expect(c[0].stage).toBe('20 to 50 hours')
    expect(c[0].at).toBe(22 * H)
  })
  it('counts hours before A14 Pomodoro, so nothing is crossed twice', () => {
    const parts = [{ itemId: 1, start: 0, end: 2 * H, focusSeconds: 2 * 3600 }]
    expect(stageCrossings(parts, new Map([[1, 19]]))).toHaveLength(1)
    expect(stageCrossings(parts, new Map([[1, 25]]))).toHaveLength(0)
  })
  it('gives a session the hours its subject had before it', () => {
    const parts = [
      { itemId: 1, start: 0, focusSeconds: 3600 },
      { itemId: 2, start: 10, focusSeconds: 3600 },
      { itemId: 1, start: 20, focusSeconds: 3600 }
    ]
    expect(hoursBeforeMoment(parts, 1, 20, 5)).toBe(6)
  })
  it('suggests "new field" when the category has no study yet', () => {
    expect(suggestNewField(0)).toBe(true)
    expect(suggestNewField(600)).toBe(false)
  })
})
