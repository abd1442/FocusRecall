import { describe, expect, it } from 'vitest'
import type { LogSchema } from './logfields'
import { rememberedDetailSuggestions,answerField, sessionLogEntries, splitBySection } from './sessionLog'
import { sessionSubjects, type FinishedBlock } from './session'

const schema: LogSchema = {
  groups: [
    { id: 1, key: 'did', name: 'What you did', section: 'quick', sortOrder: 0, archived: false },
    { id: 2, key: null, name: 'Place', section: 'setup', sortOrder: 1, archived: false },
    { id: 3, key: null, name: 'Drinks', section: 'detail', sortOrder: 2, archived: false }
  ],
  fields: [
    { id: 10, key: 'activity', groupId: 1, label: 'Activity', type: 'activity', options: [], scale: null, sortOrder: 0, archived: false },
    { id: 11, key: 'progress', groupId: 1, label: 'Progress', type: 'progress', options: [], scale: null, sortOrder: 1, archived: false },
    { id: 20, key: null, groupId: 2, label: 'Place', type: 'single', options: [], scale: null, sortOrder: 0, archived: false },
    { id: 30, key: null, groupId: 3, label: 'Drinks', type: 'single', options: [], scale: null, sortOrder: 0, archived: false }
  ]
}

const part = (id: number, itemId: number, startMin: number, focus = 600): FinishedBlock => ({
  id,
  sessionId: 1,
  origin: 'normal',
  focusStartedAt: new Date(startMin * 60_000).toISOString(),
  focusEndedAt: new Date((startMin + 10) * 60_000).toISOString(),
  itemId,
  itemName: `S${itemId}`,
  itemColor: '#000',
  itemUnit: 'pages',
  focusSeconds: focus
})

describe('sessionSubjects', () => {
  it('groups parts by subject in the order first studied', () => {
    const s = sessionSubjects([part(3, 1, 20), part(1, 1, 0), part(2, 2, 10)])
    expect(s.map((x) => x.itemId)).toEqual([1, 2])
    expect(s[0].blockIds).toEqual([1, 3])
    expect(s[0].focusSeconds).toBe(1200)
  })
})

describe('splitBySection', () => {
  it('separates the quick answers from the shared ones', () => {
    const { quick, shared } = splitBySection(schema, { values: { 10: 'reading', 20: 'desk', 30: 'tea' }, notes: { 1: 'q', 2: 's' } })
    expect(quick).toEqual({ values: { 10: 'reading' }, notes: { 1: 'q' }, untouched: [] })
    expect(shared).toEqual({ values: { 20: 'desk', 30: 'tea' }, notes: { 2: 's' }, untouched: [] })
  })
})

describe('sessionLogEntries', () => {
  it('gives every part its subject answers plus the shared ones, progress only on the latest part', () => {
    const subjects = sessionSubjects([part(1, 1, 0), part(2, 2, 10), part(3, 1, 20)])
    const progress = { amount: 10, unit: 'pages', from: 1, to: 11 }
    const entries = sessionLogEntries(
      schema,
      subjects,
      { 1: { values: { 10: 'reading', 11: progress }, notes: {} }, 2: { values: { 10: 'problems' }, notes: { 1: 'hard' } } },
      { values: { 20: 'desk' }, notes: { 2: 'quiet' } }
    )
    expect(entries).toEqual([
      { blockId: 1, values: { 20: 'desk', 10: 'reading' }, notes: { 2: 'quiet' }, untouched: [] },
      { blockId: 3, values: { 20: 'desk', 10: 'reading', 11: progress }, notes: { 2: 'quiet' }, untouched: [] },
      { blockId: 2, values: { 20: 'desk', 10: 'problems' }, notes: { 2: 'quiet', 1: 'hard' }, untouched: [] }
    ])
  })
})

describe('untouched sliders', () => {
  it('travel with their section and only for answers that are there', () => {
    const { quick, shared } = splitBySection(schema, { values: { 10: 'reading', 30: 2 }, notes: {}, untouched: [10, 30] })
    expect(quick.untouched).toEqual([10])
    expect(shared.untouched).toEqual([30])
    const subjects = sessionSubjects([part(1, 1, 0)])
    const [e] = sessionLogEntries(schema, subjects, { 1: { values: { 10: 'reading' }, notes: {}, untouched: [10] } }, { values: { 20: null }, notes: {}, untouched: [20] })
    expect(e.untouched).toEqual([10])
  })
})

it('confirms only an explicit answer while preserving unrelated suggested values and notes',()=>{
 const draft={values:{10:'reading',20:3},notes:{1:'Keep this note'},untouched:[10,20]}
 const confirmed=answerField(draft,20,3)
 expect(confirmed.untouched).toEqual([10]);expect(confirmed.notes).toEqual(draft.notes)
 expect(draft.untouched).toEqual([10,20])
 expect(answerField(confirmed,20,null).values[20]).toBeNull()
})

it('remembers structured detail suggestions but never duplicates free notes or completed progress',()=>{
 const testSchema:LogSchema={groups:[schema.groups[2]],fields:[
  {...schema.fields[3],options:[{id:'tea',label:'Tea'}]},
  {...schema.fields[3],id:31,type:'text'},
  {...schema.fields[3],id:32,type:'progress'},
  {...schema.fields[3],id:33,type:'number'},
  {...schema.fields[3],id:34,type:'multi',options:[{id:'desk',label:'Desk'},{id:'old',label:'Old',archived:true}]}
 ]}
 expect(rememberedDetailSuggestions(testSchema,{30:'tea',31:'private note',32:{amount:5,unit:'pages',from:1,to:6},33:0,34:['desk','old']})).toEqual({30:'tea',33:0,34:['desk']})
 expect(rememberedDetailSuggestions(testSchema,{30:'removed-option'})).toEqual({})
})
