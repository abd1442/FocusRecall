import { describe, expect, it } from 'vitest'
import { groupByStudyDay, recomputeFocusSeconds, type HistoryBlock, type HistorySitting } from './blocks'

const block = (focusSeconds: number): HistoryBlock =>
  ({ focusSeconds }) as unknown as HistoryBlock

describe('groupByStudyDay', () => {
  const local = (d: number, h: number, m = 0): string => new Date(2026, 9, d, h, m).toISOString()
  const sittings: HistorySitting[] = [
    { id: 1, startedAt: local(11, 9), endedAt: null, blocks: [block(1500), block(600)] },
    { id: 2, startedAt: local(12, 1, 30), endedAt: null, blocks: [block(900)] }, // before 04:00: still the 11th
    { id: 3, startedAt: local(12, 10), endedAt: null, blocks: [block(300)] }
  ]
  it('groups by study day, newest first, and totals focus time', () => {
    const days = groupByStudyDay(sittings, '04:00')
    expect(days.map((d) => d.day)).toEqual(['2026-10-12', '2026-10-11'])
    expect(days[1].sittings.map((s) => s.id)).toEqual([2, 1])
    expect(days[1].focusSeconds).toBe(3000)
    expect(days[0].focusSeconds).toBe(300)
  })
  it('follows the day-start setting', () => {
    expect(groupByStudyDay(sittings, '00:00').map((d) => d.day)).toEqual(['2026-10-12', '2026-10-11'])
    expect(groupByStudyDay(sittings, '00:00')[0].sittings.map((s) => s.id)).toEqual([3, 2])
  })
})

describe('recomputeFocusSeconds', () => {
  it('subtracts pauses inside the edited range only', () => {
    const t = (min: number): string => new Date(Date.UTC(2026, 9, 11, 8, min)).toISOString()
    const pauses = [{ startedAt: t(10), endedAt: t(15) }]
    expect(recomputeFocusSeconds(t(0), t(30), pauses)).toBe(25 * 60)
    expect(recomputeFocusSeconds(t(0), t(12), pauses)).toBe(10 * 60)
  })
})
