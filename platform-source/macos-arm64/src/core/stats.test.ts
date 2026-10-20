import { describe, expect, it } from 'vitest'
import {
  onDay,
  openReviews,
  perSubject,
  perWeek,
  searchNotes,
  stoppedAtLabel,
  streak,
  subjectOverview,
  totals,
  weekBars,
  type BlockSummary
} from './stats'

let nextId = 1
/** A block starting at local time on 2026-10-<d> h:m. */
function blk(d: number, h: number, p: Partial<BlockSummary> = {}): BlockSummary {
  const id = nextId++
  return {
    id,
    sittingId: 1,
    sessionId: id,
    itemId: 1,
    focusStartedAt: new Date(2026, 9, d, h, 0).toISOString(),
    focusSeconds: 1500,
    recallText: null,
    reviewMarked: false,
    reviewNote: null,
    reviewDone: false,
    focusRating: null,
    progressTo: null,
    progressUnit: null,
    notesLink: null,
    logged: true,
    origin: 'normal',
    timerMode: 'flow',
    activityId: null,
    ...p
  }
}

describe('today and totals', () => {
  it('counts a 01:00 block on the previous study day', () => {
    const blocks = [blk(11, 9), blk(12, 1, { itemId: 2 }), blk(12, 10)]
    expect(totals(onDay(blocks, '2026-10-11', '04:00'))).toEqual({ focusSeconds: 3000, sessions: 2, subjects: 2 })
    expect(totals(onDay(blocks, '2026-10-12', '04:00'))).toEqual({ focusSeconds: 1500, sessions: 1, subjects: 1 })
  })
})

describe('weekBars', () => {
  it('lists seven days from the configured week start', () => {
    // 2026-10-10 is a Saturday.
    const bars = weekBars([blk(10, 9), blk(10, 15), blk(13, 9)], '2026-10-14', 6, '04:00')
    expect(bars.map((b) => b.day)).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16'
    ])
    expect(bars[0].focusSeconds).toBe(3000)
    expect(bars[3].focusSeconds).toBe(1500)
    expect(bars[6].focusSeconds).toBe(0)
  })
})

describe('streak', () => {
  const blocks = [blk(8, 9), blk(9, 9), blk(10, 9), blk(11, 9)]
  it('counts consecutive days ending today', () => {
    expect(streak(blocks, '2026-10-11', '04:00')).toBe(4)
  })
  it('keeps the streak alive when today is not studied yet', () => {
    expect(streak(blocks, '2026-10-12', '04:00')).toBe(4)
  })
  it('breaks after a missed day', () => {
    expect(streak(blocks, '2026-10-13', '04:00')).toBe(0)
    expect(streak([...blocks, blk(13, 9)], '2026-10-13', '04:00')).toBe(1)
  })
  it('is zero with no blocks', () => {
    expect(streak([], '2026-10-11', '04:00')).toBe(0)
  })
})

describe('openReviews', () => {
  it('returns marked, not done, newest first', () => {
    const a = blk(10, 9, { reviewMarked: true })
    const b = blk(11, 9, { reviewMarked: true })
    const done = blk(11, 10, { reviewMarked: true, reviewDone: true })
    const unmarked = blk(11, 11)
    expect(openReviews([a, b, done, unmarked]).map((x) => x.id)).toEqual([b.id, a.id])
  })
})

describe('subjectOverview', () => {
  it('summarises one subject', () => {
    const blocks = [
      blk(9, 9, { focusRating: 4, progressTo: 40, progressUnit: 'pages', recallText: 'first' }),
      blk(10, 9, { focusRating: 2, progressTo: 58, progressUnit: 'pages' }),
      blk(11, 9, { focusRating: null }),
      blk(11, 10, { itemId: 2, focusRating: 5 })
    ]
    const o = subjectOverview(blocks, 1)
    expect(o.sessions).toBe(3)
    expect(o.focusSeconds).toBe(4500)
    expect(o.averageFocus).toBe(3)
    expect(o.stoppedAt).toEqual({ value: 58, unit: 'pages' })
    expect(o.lastRecall?.recallText).toBe('first')
    expect(o.lastStudiedAt).toBe(blocks[2].focusStartedAt)
  })
  it('handles a subject with no blocks', () => {
    expect(subjectOverview([], 9)).toMatchObject({ sessions: 0, averageFocus: null, stoppedAt: null, lastRecall: null, lastStudiedAt: null })
  })
})

describe('perSubject and perWeek', () => {
  it('sums by subject, largest first', () => {
    const r = perSubject([blk(9, 9, { itemId: 1 }), blk(9, 10, { itemId: 2, focusSeconds: 3000 }), blk(10, 9, { itemId: 1 })])
    expect(r).toEqual([
      { itemId: 1, focusSeconds: 3000, sessions: 2 },
      { itemId: 2, focusSeconds: 3000, sessions: 1 }
    ])
  })
  it('sums the last weeks, oldest first', () => {
    const r = perWeek([blk(1, 9), blk(10, 9), blk(14, 9)], '2026-10-14', 6, '04:00', 3)
    expect(r.map((w) => w.weekStart)).toEqual(['2026-09-26', '2026-10-03', '2026-10-10'])
    expect(r.map((w) => w.focusSeconds)).toEqual([1500, 0, 3000])
  })
})

describe('searchNotes', () => {
  it('finds text in recall and review notes, newest first', () => {
    const a = blk(9, 9, { recallText: 'Eigenvalues and eigenvectors' })
    const b = blk(10, 9, { reviewMarked: true, reviewNote: 'eigen decomposition proof' })
    const c = blk(11, 9, { recallText: 'Beam deflection' })
    expect(searchNotes([a, b, c], 'EIGEN').map((x) => x.id)).toEqual([b.id, a.id])
    expect(searchNotes([a, b, c, blk(12, 9)], '').map((x) => x.id)).toEqual([c.id, b.id, a.id])
  })
})

describe('stoppedAtLabel', () => {
  it('reads like a place in the material', () => {
    expect(stoppedAtLabel({ value: 58, unit: 'pages' })).toBe('page 58')
    expect(stoppedAtLabel({ value: 9, unit: 'chapters' })).toBe('chapter 9')
    expect(stoppedAtLabel({ value: 34, unit: 'video minutes' })).toBe('video minutes 34')
    expect(stoppedAtLabel({ value: 3, unit: null })).toBe('3')
  })
})

describe('sessions with several subjects', () => {
  it('count once in totals but per subject in perSubject', () => {
    const a = blk(11, 9, { sessionId: 500, itemId: 1 })
    const b = blk(11, 9, { sessionId: 500, itemId: 2 })
    const c = blk(11, 11, { sessionId: 501, itemId: 1 })
    expect(totals([a, b, c])).toEqual({ focusSeconds: 4500, sessions: 2, subjects: 2 })
    expect(perSubject([a, b, c])).toEqual([
      { itemId: 1, focusSeconds: 3000, sessions: 2 },
      { itemId: 2, focusSeconds: 1500, sessions: 1 }
    ])
  })
})
