import { describe, expect, it } from 'vitest'
import { consistency, habitChange, minuteContinuity, progressSpeeds, recallNext, weekWindows } from './studyPatterns'
import type { RawBlock, StatDistraction, StatSession, StatsRaw } from './statsData'

const session = (p: Partial<StatSession> = {}): StatSession => ({ id: 1, itemId: 1,itemIds:[1], start: 0, end: 120000, day: '2026-10-13', hour: 10, weekday: 2, distractions: [], outcomes: { focus: 3 }, untouchedOutcomes: [], factors: { place: ['Home'] }, untouchedFactors: [], ...p } as StatSession)
const distraction = (start: number, duration: number, source: StatDistraction['source'] = 'manual', confirmed = true): StatDistraction => ({ startedAt: start, durationSeconds: duration, source, confirmed } as StatDistraction)

describe('study patterns', () => {
  it('deduplicates study days and keeps yesterday’s streak alive until today is studied', () => {
    const rows = ['2026-10-10', '2026-10-11', '2026-10-11', '2026-10-12', '2026-10-15'].map((day) => session({ day }))
    expect(consistency(rows, '2026-10-13')).toEqual({ current: 3, longest: 3, days: 3, last28: 3 })
    expect(consistency(rows, '2026-10-14').current).toBe(0)
    expect(consistency([], '2026-10-13').longest).toBe(0)
  })
  it('merges overlapping lost spans, clips them at minute edges and ignores unconfirmed idle', () => {
    const rows = minuteContinuity([session({ distractions: [distraction(10000, 30), distraction(20000, 30), distraction(60000, 60, 'idle', false)] })])
    expect(rows[0].share).toBeCloseTo(1 / 3)
    expect(rows[1].share).toBe(1)
    expect(minuteContinuity([session({ end: 30000, distractions: [distraction(-20000, 30)] })])[0].share).toBeCloseTo(2 / 3)
  })
  it('does not infer ratings from a sparse hour and respects untouched answers', () => {
    const rows = Array.from({ length: 5 }, (_, i) => session({ id: i, outcomes: { focus: 4 } }))
    expect(weekWindows(rows).find((r) => r.weekday === 2 && r.hour === 10)).toMatchObject({ n: 5, mean: 4 })
    rows[0].untouchedOutcomes = ['focus']
    expect(weekWindows(rows).find((r) => r.weekday === 2 && r.hour === 10)?.mean).toBeNull()
    expect(weekWindows(rows, { includeUntouched: true, withinSubject: false }).find((r) => r.weekday === 2 && r.hour === 10)?.mean).toBe(4)
  })
  it('uses all same-subject parts for speed and never combines unlike units', () => {
    const block = (id: number, unit?: string, amount = 10): RawBlock => ({ id, sessionId: 1, itemId: 2, focusSeconds: 900, values: unit ? [{ fieldId: 3, value: { unit, amount }, touched: true }] : [] } as RawBlock)
    const raw = { schema: { fields: [{ id: 3, key: 'progress' }] }, blocks: [block(1), block(2, 'pages'), { ...block(3, 'video minutes', 20), sessionId: 2 }, { ...block(4, 'pages', 1000), sessionId: 3 }] } as StatsRaw
    const speeds = progressSpeeds(raw, new Set([1, 2]))
    expect(speeds.find((s) => s.unit === 'pages')).toMatchObject({ amount: 10, hours: 0.5, rate: 20, n: 1 })
    expect(speeds.find((s) => s.unit === 'video minutes')).toMatchObject({ rate: 80 })
    expect(speeds).toHaveLength(2)
  })
  it('pairs the next session on the same subject, without skipping an unanswered intervening session', () => {
    const rows = [session({ id: 1, start: 1, outcomes: { recall: 4 } }), session({ id: 2, start: 2, itemId: 2, outcomes: { understanding: 1 } }), session({ id: 3, start: 3, outcomes: {} }), session({ id: 4, start: 4, outcomes: { understanding: 3 } })]
    expect(recallNext(rows)).toEqual([])
    rows[2].outcomes.understanding = 2
    expect(recallNext(rows)).toEqual([{ recall: 4, understanding: 2, n: 1 }])
  })
  it('bounds habit windows, reports adoption, and requires five ratings each side', () => {
    const before = Array.from({ length: 5 }, (_, i) => session({ id: i, start:Date.UTC(2026,8,25+i),end:Date.UTC(2026,8,25+i)+120000,day:'2026-09-'+String(25+i),activity:'reading',outcomes:{focus:2} }))
    const after = Array.from({ length: 5 }, (_, i) => session({id:i+5,start:Date.UTC(2026,9,1+i),end:Date.UTC(2026,9,1+i)+120000,day:'2026-10-0'+(1+i),activity:'reading',outcomes:{focus:4},factors:{place:['Library']}}))
    const r = habitChange([...before, ...after, session({ day: '2026-11-01', outcomes: { focus: 100 } })], 'place', 'Library', '2026-10-01', 'focus')
    expect(r.before.share).toBe(0); expect(r.after.share).toBe(1); expect(r.difference).toBe(2)
    after[0].untouchedOutcomes = ['focus']
    expect(habitChange([...before, ...after], 'place', 'Library', '2026-10-01', 'focus').difference).toBeNull()
  })
})

it('does not let mixed-session ratings satisfy a habit comparison threshold',()=>{
 const rows=[session({day:'2026-10-01'}),session({day:'2026-10-08'}),...Array.from({length:10},(_,i)=>session({day:i%2?'2026-10-01':'2026-10-08',itemIds:[1,2]}))]
 expect(habitChange(rows,'place','Home','2026-10-08','focus')).toMatchObject({before:{n:1},after:{n:1},difference:null})
})
