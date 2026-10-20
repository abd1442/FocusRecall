import { describe, expect, it } from 'vitest'
import { cardAnswered, hasAnswer, likelyActivities, questionCards } from './logcards'
import { SEED_GROUPS, seedOptions, type LogField, type LogSchema } from './logfields'

function seedSchema(): LogSchema {
  const schema: LogSchema = { groups: [], fields: [] }
  let fid = 100
  SEED_GROUPS.forEach((g, gi) => {
    schema.groups.push({ id: gi + 1, key: g.key, name: g.name, section: g.section, sortOrder: gi, archived: false })
    g.fields.forEach((f, i) =>
      schema.fields.push({ id: fid++, key: f.key, groupId: gi + 1, label: f.label, type: f.type, options: seedOptions(f.options), scale: f.scale ?? null, sortOrder: i, archived: false })
    )
  })
  return schema
}
const schema = seedSchema()
const field = (key: string): LogField => schema.fields.find((f) => f.key === key)!

describe('likely activities', () => {
  const options = ['read', 'watch', 'practice', 'review', 'teach', 'archived'].map((id) => ({ id, label: id, archived: id === 'archived' }))
  it('keeps the current and most recent choice, then fills from frequency', () => {
    expect(likelyActivities(options, 'watch', ['teach', 'read', 'read', 'practice', 'practice', 'review']).map(o => o.id))
      .toEqual(['watch', 'teach', 'read', 'practice'])
  })
  it('offers four defaults without history and does not duplicate the selected activity', () => {
    expect(likelyActivities(options, 'read', []).map(o => o.id)).toEqual(['read', 'watch', 'practice', 'review'])
  })
  it('ignores removed and archived history, but preserves a selected archived answer', () => {
    expect(likelyActivities(options, null, ['removed', 'archived', 'teach']).map(o => o.id)).toEqual(['teach', 'read', 'watch', 'practice'])
    expect(likelyActivities(options, 'archived', [])[0].id).toBe('archived')
  })
  it('makes a newly used activity likely next time even with a different planned choice', () => {
    expect(likelyActivities(options, 'watch', ['teach', ...Array(20).fill('read')]).map(o => o.id)).toContain('teach')
    expect(likelyActivities([], null, ['read'])).toEqual([])
  })
})

describe('question cards', () => {
  it('asks the essential questions in order, in plain words', () => {
    const cards = questionCards(schema)
    expect(cards.map((c) => c.field.key)).toEqual(['activity', 'progress', 'focus', 'difficulty', 'understanding'])
    expect(cards.map((c) => c.question)).toEqual([
      'What did you do?',
      'How far did you get?',
      'How focused were you?',
      'How hard was the material?',
      'How well did you understand it?'
    ])
  })
  it('puts a field the owner added after the essential ones, with its own label', () => {
    const s = seedSchema()
    s.fields.push({ id: 999, key: null, groupId: 1, label: 'Pages skimmed', type: 'number', options: [], scale: null, sortOrder: -1, archived: false })
    const cards = questionCards(s)
    expect(cards.at(-1)?.question).toBe('Pages skimmed')
  })
  it('leaves out archived fields and non-quick sections', () => {
    const s = seedSchema()
    s.fields.find((f) => f.key === 'understanding')!.archived = true
    expect(questionCards(s).map((c) => c.field.key)).not.toContain('understanding')
    expect(questionCards(s).map((c) => c.field.key)).not.toContain('energy')
  })
})

describe('answered', () => {
  it('needs a real value', () => {
    expect(hasAnswer(undefined)).toBe(false)
    expect(hasAnswer(null)).toBe(false)
    expect(hasAnswer([])).toBe(false)
    expect(hasAnswer({ amount: null, unit: 'pages', from: null, to: null })).toBe(false)
    expect(hasAnswer({ amount: 12, unit: 'pages', from: null, to: null })).toBe(true)
    expect(hasAnswer('opt-1')).toBe(true)
  })
  it('counts an untouched default slider only once it is confirmed or moved', () => {
    const f = field('focus')
    expect(cardAnswered(f, { [f.id]: 3 }, [f.id])).toBe(false)
    expect(cardAnswered(f, { [f.id]: 3 }, [])).toBe(true)
    expect(cardAnswered(f, { [f.id]: null }, [])).toBe(false)
  })
  it('does not count a suggested choice until explicitly confirmed', () => {
    const a = field('activity')
    expect(cardAnswered(a, { [a.id]: 'reading' }, [a.id])).toBe(false)
    expect(cardAnswered(a, { [a.id]: 'reading' }, [])).toBe(true)
  })
})
