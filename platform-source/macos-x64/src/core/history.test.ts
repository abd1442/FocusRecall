import { describe, expect, it } from 'vitest'
import type { HistoryBlock } from './blocks'
import {
  calendarWeeks,
  compareRanges,
  dayTimeline,
  filterBlocks,
  groupBlocks,
  groupSessionsBy,
  heatLevel,
  rangeFor,
  summarize,
  type DayBlock,
  type HistoryFilter
} from './history'
import type { LogSchema } from './logfields'

const schema: LogSchema = {
  groups: [{ id: 1, key: 'did', name: 'What you did', section: 'quick', sortOrder: 0, archived: false }],
  fields: [
    { id: 10, key: 'activity', groupId: 1, label: 'Activity', type: 'activity', options: [], scale: null, sortOrder: 0, archived: false },
    { id: 11, key: 'note', groupId: 1, label: 'Free note', type: 'text', options: [], scale: null, sortOrder: 1, archived: false }
  ]
}

let id = 1
function blk(day: string, itemId: number, p: Partial<DayBlock> = {}): DayBlock {
  const start = new Date(`${day}T10:00:00`)
  const own = id++
  return {
    id: own,
    sittingId: 1,
    sessionId: own,
    sessionStats: { distractionCount: 0, distractedSeconds: 0, lostShare: 0, longestStretchSeconds: 1500 },
    itemId,
    itemName: `Item ${itemId}`,
    itemColor: '#888888',
    itemUnit: 'pages',
    origin: 'normal',
    endedBy: 'finish',
    logStatus: 'done',
    timerMode: 'flow',
    targetSeconds: 1500,
    focusStartedAt: start.toISOString(),
    focusEndedAt: new Date(start.getTime() + 1500_000).toISOString(),
    focusSeconds: 1500,
    recallText: null,
    recallSeconds: null,
    recallRating: null,
    toReviewText: null,
    reviewMarked: false,
    toReviewDone: false,
    notesLink: null,
    restPlannedSeconds: null,
    restActualSeconds: null,
    restActivity: null,
    restSkipped: false,
    values: {},
    groupNotes: {},
    pauses: [],
    distractions: [],
    day,
    ...p
  } as DayBlock
}

describe('rangeFor', () => {
  // 2026-10-14 is a Wednesday; weeks start Saturday.
  it('gives week and month ranges', () => {
    expect(rangeFor('this-week', '2026-10-14', 6)).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(rangeFor('last-week', '2026-10-14', 6)).toEqual({ from: '2026-10-03', to: '2026-10-09' })
    expect(rangeFor('this-month', '2026-10-14', 6)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(rangeFor('last-month', '2026-10-14', 6)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(rangeFor('last-month', '2026-03-05', 6)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(rangeFor('last-30', '2026-10-14', 6)).toEqual({ from: '2026-09-15', to: '2026-10-14' })
    expect(rangeFor('all', '2026-10-14', 6)).toEqual({ from: null, to: null })
  })
})

describe('filterBlocks', () => {
  const blocks = [
    blk('2026-10-01', 1, { recallText: 'Eigenvalues' }),
    blk('2026-10-05', 2, { values: { 10: 'reading-book', 11: 'Felt sleepy' } }),
    blk('2026-10-09', 3, { groupNotes: { 1: 'Library was loud' } }),
    blk('2026-10-12', 1, { toReviewText: 'Redo eigen proof' })
  ]
  const cat = (itemId: number): number => (itemId === 3 ? 20 : 10)
  const base: HistoryFilter = { range: { from: null, to: null }, itemIds: null, categoryIds: null, activityId: null, query: '' }
  const ids = (f: Partial<HistoryFilter>): number[] => filterBlocks(blocks, { ...base, ...f }, schema, cat).map((b) => b.id)

  it('filters by range, subject, category and activity', () => {
    expect(ids({ range: { from: '2026-10-05', to: '2026-10-09' } })).toEqual([blocks[1].id, blocks[2].id])
    expect(ids({ itemIds: [1] })).toEqual([blocks[0].id, blocks[3].id])
    expect(ids({ categoryIds: [20] })).toEqual([blocks[2].id])
    expect(ids({ activityId: 'reading-book' })).toEqual([blocks[1].id])
  })
  it('searches recall, review notes, group notes and free notes', () => {
    expect(ids({ query: 'eigen' })).toEqual([blocks[0].id, blocks[3].id])
    expect(ids({ query: 'LOUD' })).toEqual([blocks[2].id])
    expect(ids({ query: 'sleepy' })).toEqual([blocks[1].id])
  })
})

describe('summaries and comparisons', () => {
  it('summarises a range', () => {
    expect(summarize([blk('2026-10-01', 1), blk('2026-10-01', 2, { focusSeconds: 900 })])).toEqual({
      focusSeconds: 2400,
      sessions: 2,
      averageSessionSeconds: 1200,
      subjects: 2
    })
  })
  it('compares this week with last week and this month with last month', () => {
    const blocks = [blk('2026-10-12', 1), blk('2026-10-13', 1), blk('2026-10-05', 1), blk('2026-09-20', 1)]
    const [week, month] = compareRanges(blocks, '2026-10-14', 6)
    expect(week.current.sessions).toBe(2)
    expect(week.previous.sessions).toBe(1)
    expect(month.current.sessions).toBe(3)
    expect(month.previous.sessions).toBe(0)
  })
  it('counts a session with two subjects once', () => {
    const a = blk('2026-10-01', 1)
    const b = blk('2026-10-01', 2, { sessionId: a.sessionId, focusSeconds: 600 })
    expect(summarize([a, b])).toMatchObject({ sessions: 1, subjects: 2, averageSessionSeconds: 2100 })
  })
})

describe('groupSessionsBy', () => {
  const a = blk('2026-10-02', 1)
  const b = blk('2026-10-02', 2, { sessionId: a.sessionId, focusSeconds: 600, focusStartedAt: new Date('2026-10-02T10:25:00').toISOString() })
  const c = blk('2026-10-01', 1)
  const cat = (itemId: number): number => (itemId === 1 ? 100 : 200)
  it('puts each session once on its day, with its parts', () => {
    const g = groupSessionsBy([a, b, c], 'day', cat)
    expect(g.map((x) => x.key)).toEqual(['2026-10-02', '2026-10-01'])
    expect(g[0].sessions).toHaveLength(1)
    expect(g[0].sessions[0].parts.map((p) => p.itemId)).toEqual([1, 2])
    expect(g[0].sessions[0].mixed).toBe(true)
    expect(g[0].focusSeconds).toBe(2100)
  })
  it('shows a mixed session under each subject, counting only its own parts', () => {
    const g = groupSessionsBy([a, b, c], 'subject', cat)
    expect(g.find((x) => x.key === '1')).toMatchObject({ focusSeconds: 3000 })
    expect(g.find((x) => x.key === '2')).toMatchObject({ focusSeconds: 600 })
    expect(g.find((x) => x.key === '2')!.sessions[0].parts).toHaveLength(2)
  })
})

describe('calendar', () => {
  it('lists whole weeks ending with the current one', () => {
    const weeks = calendarWeeks('2026-10-14', 6, 3)
    expect(weeks).toHaveLength(3)
    expect(weeks[2][0]).toBe('2026-10-10')
    expect(weeks[0][0]).toBe('2026-09-26')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })
  it('grades days into four heat levels', () => {
    expect(heatLevel(0, 7200)).toBe(0)
    expect(heatLevel(60, 7200)).toBe(1)
    expect(heatLevel(3600, 7200)).toBe(2)
    expect(heatLevel(7200, 7200)).toBe(4)
  })
})

describe('groupBlocks', () => {
  const blocks = [blk('2026-10-01', 1), blk('2026-10-02', 2, { focusSeconds: 4000 }), blk('2026-10-02', 1)]
  it('groups by day, newest day first', () => {
    expect(groupBlocks(blocks, 'day', () => 1).map((g) => g.key)).toEqual(['2026-10-02', '2026-10-01'])
  })
  it('groups by subject or category, most time first', () => {
    expect(groupBlocks(blocks, 'subject', () => 1).map((g) => [g.key, g.focusSeconds])).toEqual([
      ['2', 4000],
      ['1', 3000]
    ])
    expect(groupBlocks(blocks, 'category', (i) => (i === 1 ? 7 : 8)).map((g) => g.key)).toEqual(['8', '7'])
  })
})

describe('dayTimeline', () => {
  it('places focus, pauses and rest as fractions of the study day', () => {
    const start = new Date('2026-10-01T10:00:00')
    const b = blk('2026-10-01', 1, {
      focusStartedAt: start.toISOString(),
      focusEndedAt: new Date(start.getTime() + 3600_000).toISOString(),
      pauses: [{ startedAt: new Date(start.getTime() + 600_000).toISOString(), endedAt: new Date(start.getTime() + 1200_000).toISOString() }],
      restActualSeconds: 600
    } as Partial<HistoryBlock>)
    const spans = dayTimeline([b], '2026-10-01', '04:00')
    const hour = 1 / 24
    expect(spans.map((s) => s.kind)).toEqual(['focus', 'pause', 'rest'])
    expect(spans[0].start).toBeCloseTo(6 * hour)
    expect(spans[0].end).toBeCloseTo(7 * hour)
    expect(spans[2].end - spans[2].start).toBeCloseTo(hour / 6)
  })
})

it('excludes later weekdays and later prior-month dates from elapsed comparisons',()=>{
 const rows=[blk('2026-10-14',1),blk('2026-10-15',1),blk('2026-10-07',1),blk('2026-10-09',1),blk('2026-09-14',1),blk('2026-09-15',1)]
 const [week,month]=compareRanges(rows,'2026-10-14',6)
 expect(week.current.sessions).toBe(1);expect(week.previous.sessions).toBe(1)
 expect(month.previous.sessions).toBe(1)
})
