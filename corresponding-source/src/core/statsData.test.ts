import { describe, expect, it } from 'vitest'
import { outcomeOf } from './insights'
import { DEFAULT_QUALITY } from './distractions'
import { DEFAULT_STAGES } from './learning'
import { SCALES, type LogSchema } from './logfields'
import { buildStatSessions, filterSessions, numberBins, NO_FILTER, type RawBlock, type StatsRaw } from './statsData'
import { subjectRows } from './statsSections'

const schema: LogSchema = {
  groups: [
    { id: 1, key: 'went', name: 'How it went', section: 'quick', sortOrder: 0, archived: false },
    { id: 2, key: 'setup', name: 'Setup', section: 'setup', sortOrder: 1, archived: false },
    { id: 3, key: 'today', name: 'Today', section: 'day', sortOrder: 2, archived: false }
  ],
  fields: [
    { id: 10, key: 'focus', groupId: 1, label: 'Focus', type: 'scale', options: [], scale: SCALES.focus, sortOrder: 0, archived: false },
    { id: 11, key: 'activity', groupId: 1, label: 'Activity', type: 'activity', options: [{ id: 'reading', label: 'Reading' }], scale: null, sortOrder: 1, archived: false },
    { id: 20, key: 'place', groupId: 2, label: 'Place', type: 'single', options: [{ id: 'lib', label: 'Library' }, { id: 'home', label: 'Home' }], scale: null, sortOrder: 0, archived: false },
    { id: 21, key: 'methods', groupId: 2, label: 'Methods', type: 'multi', options: [{ id: 'a', label: 'Flashcards' }, { id: 'b', label: 'Notes' }], scale: null, sortOrder: 1, archived: false },
    { id: 30, key: 'sleep-hours', groupId: 3, label: 'Hours of sleep', type: 'number', options: [], scale: { min: 3, max: 12, labels: [], unit: 'h' }, sortOrder: 0, archived: false }
  ]
}

const H = 3_600_000
const base = new Date(2026, 8, 7, 10).getTime()

it('compares progress with earlier completed exposure in the same subject/activity/unit only',()=>{
 const progress=(id:number,minutes:number,amount:number,activity='reading',unit='pages')=>block(id,id,base+id*86400000,minutes,{values:[{fieldId:11,value:activity,touched:true},{fieldId:40,value:{amount,unit},touched:true}]})
 const input=raw([progress(1,30,10),progress(2,60,30),progress(3,30,10),progress(4,60,25),progress(5,30,100,'solving'),progress(6,30,100,'reading','problems')])
 input.schema={...schema,fields:[...schema.fields,{...schema.fields[0],id:40,key:'progress',label:'Progress',type:'progress',scale:null}]}
 const settings={dayStart:'04:00',stages:DEFAULT_STAGES,quality:DEFAULT_QUALITY}
 const result=buildStatSessions(input,settings).sessions
 expect(result.slice(0,3).every(s=>s.outcomes.progressRate===undefined)).toBe(true)
 expect(result[3].outcomes.progressRate).toBeCloseTo(100)
 expect(result[4].outcomes.progressRate).toBeUndefined();expect(result[5].outcomes.progressRate).toBeUndefined()
 const future=progress(7,30,10000)
 const extended=buildStatSessions({...input,blocks:[...input.blocks,future],sessions:[...input.sessions,{...input.sessions[0],id:7}]},settings).sessions
 expect(extended[3].outcomes.progressRate).toBe(result[3].outcomes.progressRate)
 const zero=buildStatSessions({...input,blocks:[...input.blocks.slice(0,3),progress(4,60,0)]},settings).sessions[3]
 expect(zero.progressAmount).toBe(0);expect(zero.outcomes.progressRate).toBe(0)
})

it('conserves actual subject time in the reproduced A 10 min / B 40 min session',()=>{
 const input=raw([block(100,100,base,10,{itemId:1}),block(101,100,base+600000,40,{itemId:2})])
 const built=buildStatSessions(input,{dayStart:'04:00',stages:[],quality:DEFAULT_QUALITY})
 const selected=filterSessions(built.sessions,{...NO_FILTER,itemId:1})
 expect(subjectRows(selected,'item').map(r=>[r.id,r.focusSeconds])).toEqual([[2,2400],[1,600]])
 expect(subjectRows(selected,'item',undefined,{itemId:1}).map(r=>[r.id,r.focusSeconds])).toEqual([[1,600]])
 expect(subjectRows(selected,'item').every(r=>r.usable.focus===0&&r.usable.recall===0)).toBe(true)
})

function block(id: number, sessionId: number, start: number, minutes: number, p: Partial<RawBlock> = {}): RawBlock {
  return {
    id,
    sessionId,
    sittingId: 1,
    itemId: 1,
    start,
    end: start + minutes * 60_000,
    focusSeconds: minutes * 60,
    targetSeconds: 1500,
    timerMode: 'flow',
    recallRating: 4,
    recallTouched: true,
    values: [],
    restPlannedSeconds: 300,
    restActualSeconds: 300,
    restActivity: 'walk',
    restSkipped: false,
    restScreen: false,
    distractions: [],
    appSeconds: {},
    stuck: 0,
    resisted: 0,
    ...p
  }
}

const raw = (blocks: RawBlock[], dayValues: StatsRaw['dayValues'] = []): StatsRaw => ({
  blocks,
  sessions: [...new Set(blocks.map((b) => b.sessionId))].map((id) => ({
    id,
    sittingId: 1,
    lostShare: 0.02,
    distractionCount: 1,
    distractedSeconds: 30,
    longestStretchSeconds: 1200,
    goal: id === 1 ? 'Chapter 3' : null,
    goalResult: id === 1 ? 'done' : null,
    windowSwitches: 3,

  })),
  items: [
    { id: 1, categoryId: 5, name: 'Structures', color: '#000', priorKnowledge: 'new', hoursBefore: 19.5, newField: true, buildsOn: [] },
    { id: 2, categoryId: 6, name: 'History', color: '#000', priorKnowledge: null, hoursBefore: 0, newField: null, buildsOn: [1] }
  ],
  categories: [
    { id: 4, parentId: null, name: 'University', color: '#000' },
    { id: 5, parentId: 4, name: 'Year 3', color: '#000' },
    { id: 6, parentId: null, name: 'Books', color: '#000' }
  ],
  schema,
  dayValues
})

const settings = { dayStart: '04:00', stages: DEFAULT_STAGES, quality: DEFAULT_QUALITY }

describe('stat sessions from raw rows', () => {
  it('excludes untouched recall parts without losing the include-defaults option', () => {
    const result=buildStatSessions(raw([block(1,1,base,10,{recallRating:1,recallTouched:true}),block(2,1,base+600000,10,{itemId:2,recallRating:5,recallTouched:false})]),settings).sessions[0]
    expect(outcomeOf(result,'recall')).toBe(1)
    expect(outcomeOf(result,'recall',{withinSubject:false,includeUntouched:true})).toBe(3)
  })
  it('does not treat all-untouched or missing recall as an answered outcome',()=>{
    const untouched=buildStatSessions(raw([block(1,1,base,10,{recallRating:5,recallTouched:false}),block(2,1,base+600000,10,{recallRating:null,recallTouched:false})]),settings).sessions[0]
    expect(outcomeOf(untouched,'recall')).toBeUndefined()
    expect(outcomeOf(untouched,'recall',{withinSubject:false,includeUntouched:true})).toBe(5)
    const missing=buildStatSessions(raw([block(1,1,base,10,{recallRating:null,recallTouched:true})]),settings).sessions[0]
    expect(outcomeOf(missing,'recall',{withinSubject:false,includeUntouched:true})).toBeUndefined()
  })
  it('takes answers from the main part, marks untouched sliders, adds the day check-in', () => {
    const b1 = block(1, 1, base, 10, { values: [{ fieldId: 10, value: 2, touched: true }] })
    const b2 = block(2, 1, base + 10 * 60_000, 30, {
      itemId: 2,
      values: [
        { fieldId: 10, value: 4, touched: false },
        { fieldId: 11, value: 'reading', touched: true },
        { fieldId: 20, value: 'lib', touched: true },
        { fieldId: 21, value: ['a', 'b'], touched: true }
      ]
    })
    const { sessions, factors } = buildStatSessions(raw([b1, b2], [{ day: '2026-09-07', values: [{ fieldId: 30, value: 7, touched: true }] }]), settings)
    const s = sessions[0]
    expect(s.itemId).toBe(2)
    expect(s.itemIds).toEqual([1, 2])
    expect(s.outcomes.focus).toBe(4)
    expect(s.untouchedOutcomes).toContain('focus')
    expect(s.activity).toBe('reading')
    expect(s.factors['field:20']).toEqual(['Library'])
    expect(s.factors['field:21']).toEqual(['Flashcards', 'Notes'])
    expect(s.hasGoal).toBe(true)
    expect(s.goalResult).toBe('done')
    expect(s.buildsOn).toBe(true)
    expect(s.topCategoryId).toBe(6)
    expect(factors.find((f) => f.key === 'field:21')?.multi).toBe(true)
    // Too few answers to bin the hours of sleep: the factor is left out.
    expect(factors.find((f) => f.key === 'field:30')).toBeUndefined()
  })
  it('numbers positions in the sitting and the day, and links the rest before', () => {
    const blocks = [block(1, 1, base, 25), block(2, 2, base + H, 25, { restSkipped: true }), block(3, 3, base + 2 * H, 25)]
    const { sessions } = buildStatSessions(raw(blocks), settings)
    expect(sessions.map((s) => s.positionInSitting)).toEqual([1, 2, 3])
    expect(sessions[0].restBefore).toBeNull()
    expect(sessions[1].factors['rest-before']).toEqual(['Walk'])
    expect(sessions[2].factors['rest-before']).toEqual(['Skipped'])
  })
  it('gives each session the learning stage its subject was in at the time', () => {
    const blocks = [block(1, 1, base, 60), block(2, 2, base + 2 * H, 30)]
    const { sessions } = buildStatSessions(raw(blocks), settings)
    expect(sessions[0].stage).toBe('First 20 hours')
    expect(sessions[1].stage).toBe('20 to 50 hours')
  })
  it('filters by subject, category (with its sub-categories) and days', () => {
    const blocks = [block(1, 1, base, 25), block(2, 2, base + H, 25, { itemId: 2 })]
    const { sessions } = buildStatSessions(raw(blocks), settings)
    expect(filterSessions(sessions, { ...NO_FILTER, categoryId: 4 }).map((s) => s.id)).toEqual([1])
    expect(filterSessions(sessions, { ...NO_FILTER, itemId: 2 }).map((s) => s.id)).toEqual([2])
    expect(filterSessions(sessions, { ...NO_FILTER, from: '2026-09-08' })).toHaveLength(0)
  })
  it('bins numbers into three groups', () => {
    const bin = numberBins([5, 6, 6.5, 7, 7, 7.5, 8, 8, 9], 'h')!
    expect(bin(5)).toBe('under 7 h')
    expect(bin(7.5)).toBe('7 to 8 h')
    expect(bin(9)).toBe('8 h and over')
  })
})
