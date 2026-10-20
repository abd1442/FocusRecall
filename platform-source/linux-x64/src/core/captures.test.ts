import { describe, expect, it } from 'vitest'
import { isLongAbsence, stuckReviewNote,thoughtGroups } from './captures'
import { DISTRACTION_REASONS, addReason, orderReasons, reasonLabel } from './distractions'

describe('isLongAbsence', () => {
  const since = new Date(2026, 9, 12, 10, 0).toISOString()
  const at = (min: number): number => Date.parse(since) + min * 60_000
  it('is true only past the limit, and never when off or not distracted', () => {
    expect(isLongAbsence(since, at(10), 10)).toBe(false)
    expect(isLongAbsence(since, at(11), 10)).toBe(true)
    expect(isLongAbsence(since, at(60), 0)).toBe(false)
    expect(isLongAbsence(null, at(60), 10)).toBe(false)
  })
})
it('groups repeated parked text without merging or changing stored captures',()=>{
  const thoughts=[{id:1,text:' Reply to Sara ',createdAt:'2026-10-15',sessionId:1,itemId:2,done:false},{id:2,text:'reply   to Sara',createdAt:'2026-10-16',sessionId:3,itemId:4,done:false},{id:3,text:'Buy paper',createdAt:'2026-10-15',sessionId:null,itemId:null,done:false}]
  const groups=thoughtGroups(thoughts);expect(groups).toHaveLength(2);expect(groups[0].thoughts.map(t=>t.id)).toEqual([1,2]);expect(groups[0].thoughts[1].sessionId).toBe(3);expect(thoughts[0].text).toBe(' Reply to Sara ')
})

describe('stuckReviewNote', () => {
  it('turns stuck markers into the Review later note', () => {
    expect(stuckReviewNote([])).toBe('')
    expect(stuckReviewNote([{ kind: 'resisted', note: null }])).toBe('')
    expect(stuckReviewNote([{ kind: 'stuck', note: null }])).toBe('Got stuck here')
    expect(stuckReviewNote([{ kind: 'stuck', note: 'eq. 4' }, { kind: 'stuck', note: ' ' }, { kind: 'stuck', note: 'proof' }])).toBe('Stuck: eq. 4; proof')
  })
})

describe('reasons', () => {
  it('puts the most used first, keeps Other last and leaves out archived ones', () => {
    const reasons = [...DISTRACTION_REASONS.slice(0, 3), { id: 'x', label: 'Gone', archived: true }, ...DISTRACTION_REASONS.slice(3)]
    const out = orderReasons(reasons, { 'mind-wandering': 5, people: 2 })
    expect(out.slice(0, 3).map((r) => r.id)).toEqual(['mind-wandering', 'people', 'phone'])
    expect(out[out.length - 1].id).toBe('other')
    expect(out.some((r) => r.id === 'x')).toBe(false)
  })
  it('turns typed Other text into a new reason before Other, or reuses one with the same name', () => {
    const { reasons, id } = addReason(DISTRACTION_REASONS, 'Noise outside')
    expect(id).toBe('r-noise-outside')
    expect(reasons[reasons.length - 2]).toEqual({ id, label: 'Noise outside' })
    expect(reasonLabel(id, reasons)).toBe('Noise outside')
    expect(addReason(reasons, 'noise OUTSIDE').id).toBe(id)
    expect(addReason(reasons, 'Noise outside 2').id).toBe('r-noise-outside-2')
    expect(addReason(DISTRACTION_REASONS, 'الجيران').id).toBe('r-الجيران')
    const archived = reasons.map((r) => (r.id === id ? { ...r, archived: true } : r))
    expect(addReason(archived, 'Noise outside').reasons.find((r) => r.id === id)?.archived).toBe(false)
  })
})
