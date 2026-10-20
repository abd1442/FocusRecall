import { describe, expect, it } from 'vitest'
import { compare, compareFactor, diffText, rankFactors } from './insights'
import { markdownToHtml, buildReport } from './report'
import type { FactorDef, StatSession } from './statsData'
import { distractionNumbers, overview, weekly, weekOf, subjectRows, subjectHighlights } from './statsSections'

const place: FactorDef = { key: 'place', label: 'Place', group: 'setup', options: ['Library', 'Home'], multi: false }
const sound: FactorDef = { key: 'sound', label: 'Sound', group: 'setup', options: ['Silence', 'Lyrics'], multi: false }

let id = 0
function session(p: Partial<StatSession> & { focus?: number; place?: string; item?: number }): StatSession {
  id++
  const start = Date.UTC(2026, 8, 1) + id * 86_400_000
  return {
    id,
    start,
    end: start + 1_800_000,
    day: new Date(start).toISOString().slice(0,10),
    hour: 10,
    weekday: 2,
    sittingId: 1,
    positionInSitting: 1,
    positionInDay: 1,
    itemId: p.item ?? 1,
    itemIds: [p.item ?? 1],
    categoryId: 1,
    topCategoryId: 1,
    activity: 'reading',
    timerMode: 'flow',
    focusSeconds: 1800,
    targetSeconds: 1500,
    overTarget: true,
    outcomes: { focus: p.focus ?? 3, length: 30, lostShare: 0 },
    untouchedOutcomes: [],
    factors: { place: [p.place ?? 'Home'] },
    untouchedFactors: [],
    difficulty: null,
    difficultyTouched: true,
    progressAmount: null,
    progressUnit: null,
    distractions: [],
    quality: 'clean',
    goalResult: null,
    hasGoal: false,
    resisted: 0,
    stuck: 0,
    parked: 0,
    windowSwitches: 0,
    appSeconds: {},
    rest: null,
    restBefore: null,
    stage: 'First 20 hours',
    stageIndex: 0,
    hoursOnSubject: 1,
    priorKnowledge: null,
    newField: null,
    buildsOn: false,
    ...p
  }
}

/** n sessions in a place, focus alternating around a centre. */
const many = (n: number, where: string, centre: number, item = 1): StatSession[] =>
  Array.from({ length: n }, (_, i) => session({place:where,focus:centre+(i%2?.5:-.5),item,start:Date.UTC(2026,8,1+i),end:Date.UTC(2026,8,1+i)+1800000,day:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10)}))

describe('strength in plain words', () => {
  it('uses answered outcome counts, not total sessions, for subject highlights',()=>{
    const ss=Array.from({length:5},(_,i)=>session({outcomes:i===0?{focus:5}:{},untouchedOutcomes:[]}))
    const rows=subjectRows(ss,'item');expect(rows[0].usable.focus).toBe(1);expect(subjectHighlights(rows).bestFocus).toBeNull()
  })
  it('counts each eligible outcome independently, including defaults only when selected',()=>{
    const ss=Array.from({length:10},(_,i)=>session({outcomes:{focus:4,...(i<3?{recall:3}:{}),...(i<6?{understanding:4}:{})},untouchedOutcomes:i<2?['focus']:[],difficulty:i<4?3:null,difficultyTouched:i!==0}))
    expect(subjectRows(ss,'item')[0].usable).toEqual({focus:8,recall:3,understanding:6,difficulty:3})
    expect(subjectRows(ss,'item',{withinSubject:false,includeUntouched:true})[0].usable).toEqual({focus:10,recall:3,understanding:6,difficulty:4})
    expect(subjectHighlights(subjectRows(ss,'item')).weakestRecall).toBeNull()
  })

})

describe('comparisons', () => {
  it('compares an option with all other answers, with sample sizes', () => {
    const ss = [...many(12, 'Library', 4), ...many(12, 'Home', 3)]
    const c = compare(ss, place, 'Library', 'focus')
    expect(c.n).toBe(12)
    expect(c.nRest).toBe(12)
    expect(c.mean).toBeCloseTo(4)
    expect(c.meanRest).toBeCloseTo(3)
    expect(c.better).toBeGreaterThan(0)
    expect(c.strength).toBe('none')
    expect(diffText(c)).toBe('+1.0 steps')
  })
  it('leaves out untouched defaults unless asked', () => {
    const ss = [...many(6, 'Library', 4), ...many(6, 'Home', 3)]
    ss[0].untouchedOutcomes = ['focus']
    ss[1].untouchedFactors = ['place']
    expect(compare(ss, place, 'Library', 'focus').n).toBe(4)
    expect(compare(ss, place, 'Library', 'focus', { withinSubject: false, includeUntouched: true }).n).toBe(6)
  })
  it('within the same subject, a hard subject studied in one place does not make the place look bad', () => {
    // Subject 2 is always lower; it is mostly studied at home. Within each subject the place makes no difference.
    const ss = [...many(10, 'Library', 4, 1), ...many(4, 'Home', 4, 1), ...many(4, 'Library', 2, 2), ...many(10, 'Home', 2, 2)]
    const plain = compare(ss, place, 'Home', 'focus')
    const within = compare(ss, place, 'Home', 'focus', { withinSubject: true, includeUntouched: false })
    expect(Math.abs(plain.better)).toBeLessThan(0.2)
    expect(Math.abs(within.diff)).toBeLessThan(0.2)
    expect(within.strength).toBe('none')
  })
  it('turns "lower is better" outcomes around', () => {
    const ss = [...many(8, 'Library', 3), ...many(8, 'Home', 3)]
    ss.forEach((s) => (s.outcomes.distractionsPerHour = s.factors.place[0] === 'Library' ? 1 + (s.id % 2) : 4 + (s.id % 2)))
    expect(compare(ss, place, 'Library', 'distractionsPerHour').better).toBeGreaterThan(0)
  })
  it('lists exploratory factors without ranking by effect size', () => {
    const ss = [...many(40, 'Library', 4), ...many(40, 'Home', 3)]
    ss.forEach((s, i) => (s.factors.sound = [i % 3 === 0 ? 'Lyrics' : 'Silence']))
    const { positive, negative } = rankFactors(ss, [place, sound], 'focus')
    expect(positive[0].option).toBe('Library')
    expect(negative[0].option).toBe('Home')
    expect(compareFactor(ss, place, 'focus').map((c) => c.option)).toEqual(['Library', 'Home'])
  })

})

describe('section numbers', () => {
  it('sums the overview, goals and captures', () => {
    const ss = many(4, 'Home', 3)
    ss[0].hasGoal = true
    ss[0].goalResult = 'done'
    ss[1].resisted = 2
    const o = overview(ss)
    expect(o.sessions).toBe(4)
    expect(o.focusSeconds).toBe(7200)
    expect(o.goals).toEqual({ set: 1, done: 1, partly: 0, notDone: 0 })
    expect(o.resisted).toBe(2)
  })
  it('puts study days in weeks and fills empty weeks', () => {
    expect(weekOf('2026-09-02', 6)).toBe('2026-08-29')
    const a = session({day:'2026-09-01'})
    const b = session({})
    b.day = '2026-09-20'
    expect(weekly([a, b], 6).map((w) => w.week)).toEqual(['2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19'])
  })
  it('counts distractions by reason, site and five-minute slice', () => {
    const s = session({})
    s.distractions = [
      { itemId: 1, label: null, offsetSeconds: 60, durationSeconds: 30, startedAt: 0, source: 'manual', kind: 'phone', app: null, title: null, confirmed: true },
      { itemId: 1, label: 'YouTube', offsetSeconds: 400, durationSeconds: 90, startedAt: 0, source: 'auto', kind: 'website', app: 'chrome', title: 'x', confirmed: true },
      { itemId: 1, label: null, offsetSeconds: 500, durationSeconds: 300, startedAt: 0, source: 'idle', kind: 'away', app: null, title: null, confirmed: false }
    ]
    const d = distractionNumbers([s], (k) => (k === 'phone' ? 'Phone' : k))
    expect(d.byReason).toEqual([{ key: 'Phone', count: 1, seconds: 30 }])
    expect(d.byApp[0].key).toBe('YouTube')
    expect(d.byMinute.map((x) => x.count)).toEqual([1, 1, 0, 0, 0, 0])
  })
})

describe('report', () => {
  it('writes a short paper with the strongest signals and limits', () => {
    const ss = [...many(40, 'Library', 4), ...many(40, 'Home', 3)]
    const md = buildReport({
      title: 'Study report',
      periodLabel: 'September 2026',
      previousLabel: 'August 2026',
      sessions: ss,
      previous: [],
      factors: [place],
      options: { withinSubject: false, includeUntouched: false },
      itemName: () => 'Structures'
    })
    expect(md).toContain('## What was measured')
    expect(md).toContain('**Place: Library**')
    expect(md).toContain('not proof of cause')
    expect(md).toContain('Sliders left at their default were not counted.')
  })
  it('turns the report into HTML for the PDF', () => {
    expect(markdownToHtml('# T\n\nSome **bold** text.\n\n- one\n- two <3')).toBe('<h1>T</h1>\n<p>Some <strong>bold</strong> text.</p>\n<ul>\n<li>one</li>\n<li>two &lt;3</li>\n</ul>')
  })
})

describe('time patterns', () => {
  it('keeps the 5th session of a day apart from the 4th', async () => {
    const { timePatterns } = await import('./statsSections')
    const ss = Array.from({ length: 6 }, (_, i) => session({ positionInDay: i + 1 } as Partial<StatSession>))
    expect(timePatterns(ss, 'focus').dayPosition.map((r) => r.key)).toEqual(['1st', '2nd', '3rd', '4th', '5th', '6th or later'])
  })
})
