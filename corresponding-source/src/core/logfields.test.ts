import { describe, expect, it } from 'vitest'
import {
  SCALES,
  SEED_ACTIVITIES,
  SEED_GROUPS,
  amountFromRange,
  difficultyFromOld,
  formatTimestamp,
  optionId,
  parseTimestamp,
  prefillLog,
  resolveUnit,
  scaleLabel,
  scaleStops,
  seedOptions,
  setupDefault,
  setupSummary,
  uniqueOptionId,
  unitsFor,
  valueLabel,
  fillSliderDefaults,
  isSliderField,
  sliderMiddle,
  type LogField,
  type LogSchema
} from './logfields'

/** Build a schema from the seeds, with ids 1.. for groups and 100.. for fields. */
function seedSchema(): LogSchema {
  const schema: LogSchema = { groups: [], fields: [] }
  let fid = 100
  SEED_GROUPS.forEach((g, gi) => {
    schema.groups.push({ id: gi + 1, key: g.key, name: g.name, section: g.section, sortOrder: gi, archived: false })
    g.fields.forEach((f, i) =>
      schema.fields.push({
        id: fid++,
        key: f.key,
        groupId: gi + 1,
        label: f.label,
        type: f.type,
        options: seedOptions(f.options),
        scale: f.scale ?? null,
        sortOrder: i,
        archived: false
      })
    )
  })
  return schema
}
const schema = seedSchema()
const field = (key: string): LogField => schema.fields.find((f) => f.key === key)!

describe('named scales', () => {
  it('maps focus 1-5 to its five names', () => {
    expect([1, 2, 3, 4, 5].map((v) => scaleLabel(SCALES.focus, v))).toEqual(['Scattered', 'Drifting', 'Steady', 'Focused', 'Deep'])
  })
  it('maps difficulty 1-10 to five names, two values each', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => scaleLabel(SCALES.difficulty, v))).toEqual([
      'Easy', 'Easy', 'Manageable', 'Manageable', 'Challenging', 'Challenging', 'Hard', 'Hard', 'Very hard', 'Very hard'
    ])
  })
  it('maps understanding 1-4', () => {
    expect([1, 2, 3, 4].map((v) => scaleLabel(SCALES.understanding, v))).toEqual(['Lost', 'Partly', 'Mostly', 'Fully'])
  })
  it('is null when unanswered and clamps out-of-range values', () => {
    expect(scaleLabel(SCALES.focus, null)).toBeNull()
    expect(scaleLabel(SCALES.focus, 9)).toBe('Deep')
    expect(scaleLabel(SCALES.focus, 0)).toBe('Scattered')
  })
  it('gives each name a stop that maps back to it', () => {
    for (const scale of Object.values(SCALES)) {
      for (const s of scaleStops(scale)) expect(scaleLabel(scale, s.value)).toBe(s.label)
    }
  })
  it('converts old 1-5 difficulty to 1-10 under the same name', () => {
    const oldNames = ['Easy', 'Manageable', 'Challenging', 'Hard', 'Very hard']
    ;[1, 2, 3, 4, 5].forEach((v, i) => expect(scaleLabel(SCALES.difficulty, difficultyFromOld(v))).toBe(oldNames[i]))
  })
})

describe('units by activity', () => {
  const lecture = SEED_ACTIVITIES.find((a) => a.id === 'lecture-recorded')!
  const book = SEED_ACTIVITIES.find((a) => a.id === 'reading-book')!
  const other = SEED_ACTIVITIES.find((a) => a.id === 'other')!
  it('offers the activity default first, then its other units', () => {
    expect(unitsFor(lecture, 'pages')).toEqual(['minutes of video', 'lectures', 'videos'])
    expect(unitsFor(other, 'sheets')).toEqual(['sheets'])
  })
  it('remembers the last unit per subject and activity', () => {
    const memory = { '7:reading-book': 'chapters' }
    expect(resolveUnit(book, 7, 'pages', memory)).toBe('chapters')
    expect(resolveUnit(book, 8, 'pages', memory)).toBe('pages')
    expect(resolveUnit(lecture, 7, 'pages', memory)).toBe('minutes of video')
    expect(resolveUnit(other, 7, 'sheets', memory)).toBe('sheets')
  })
  it('handles video timestamps', () => {
    expect(parseTimestamp('12:30')).toBe(750)
    expect(parseTimestamp('1:02:05')).toBe(3725)
    expect(parseTimestamp('12:3x')).toBeNull()
    expect(formatTimestamp(3725)).toBe('1:02:05')
    expect(formatTimestamp(750)).toBe('12:30')
    expect(amountFromRange('minutes of video', 750, 2010)).toBe(21)
    expect(amountFromRange('pages', 40, 58)).toBe(18)
    expect(amountFromRange('pages', 58, 40)).toBeNull()
  })
})

describe('option ids', () => {
  it('slugs labels and avoids clashes', () => {
    expect(optionId('Desk at home')).toBe('desk-at-home')
    expect(optionId('White or brown noise')).toBe('white-or-brown-noise')
    expect(optionId('مكتبة')).toBe('مكتبة')
    expect(uniqueOptionId('Other', [{ id: 'other', label: 'Other' }])).toBe('other-2')
  })
})

describe('seed schema', () => {
  it('has the quick fields, the setup fields and the renamed alongside group', () => {
    expect(['activity', 'progress', 'difficulty', 'focus', 'understanding'].every((k) => !!field(k))).toBe(true)
    expect(schema.fields.filter((f) => schema.groups.find((g) => g.id === f.groupId)!.section === 'setup')).toHaveLength(15)
    expect(schema.groups.find((g) => g.key === 'alongside')!.name).toBe('Alongside studying')
    expect(field('activity').options).toHaveLength(19)
  })
})

describe('study setup', () => {
  const place = field('place')
  const device = field('device')
  const history = [
    { [place.id]: 'library', [device.id]: 'laptop' },
    { [place.id]: 'desk-at-home' },
    { [place.id]: 'desk-at-home', [device.id]: 'tablet' },
    { [place.id]: 'library' }
  ]
  it('last used takes the latest answer per field', () => {
    expect(setupDefault(schema, history, 'last')).toEqual({ [place.id]: 'library', [device.id]: 'laptop' })
  })
  it('most used takes the most common answer, ties to the most recent', () => {
    expect(setupDefault(schema, history, 'most')).toEqual({ [place.id]: 'library', [device.id]: 'laptop' })
    const h2 = [{ [place.id]: 'cafe' }, ...history]
    expect(setupDefault(schema, h2, 'most')[place.id]).toBe('library')
  })
  it('summarises as one line in field order', () => {
    expect(setupSummary(schema, { [device.id]: 'laptop', [place.id]: 'library' })).toBe('Library · Laptop')
  })
})

describe('prefillLog', () => {
  const activity = field('activity')
  const progress = field('progress')
  const focus = field('focus')
  const difficulty = field('difficulty')
  const place = field('place')
  const mood = field('mood')
  const previous = {
    [activity.id]: 'reading-book',
    [progress.id]: { amount: 18, unit: 'pages', from: 40, to: 58 },
    [focus.id]: 4,
    [difficulty.id]: 6,
    [place.id]: 'cafe',
    [mood.id]: ['calm']
  }
  const ctx = { itemId: 3, itemUnit: 'pages', plannedActivity: null, unitMemory: {} }

  it('copies quick answers, starts progress where it stopped, takes setup from the default, skips detail', () => {
    const p = prefillLog(schema, previous, { [place.id]: 'library' }, ctx)
    expect(p[activity.id]).toBe('reading-book')
    expect(p[focus.id]).toBe(4)
    expect(p[difficulty.id]).toBe(6)
    expect(p[progress.id]).toEqual({ amount: null, unit: 'pages', from: 58, to: null })
    expect(p[place.id]).toBe('library')
    expect(p[mood.id]).toBeUndefined()
  })
  it('lets the planned activity win and switches the unit with it', () => {
    const p = prefillLog(schema, previous, {}, { ...ctx, plannedActivity: 'lecture-recorded' })
    expect(p[activity.id]).toBe('lecture-recorded')
    expect(p[progress.id]).toEqual({ amount: null, unit: 'minutes of video', from: null, to: null })
  })
  it('works with no previous log', () => {
    const p = prefillLog(schema, null, {}, ctx)
    expect(p[progress.id]).toEqual({ amount: null, unit: 'pages', from: null, to: null })
    expect(p[focus.id]).toBeUndefined()
  })
})

describe('valueLabel', () => {
  it('reads answers in words', () => {
    expect(valueLabel(field('focus'), 5)).toBe('Deep')
    expect(valueLabel(field('place'), 'desk-at-home')).toBe('Desk at home')
    expect(valueLabel(field('mood'), ['calm', 'bored'])).toBe('Calm, Bored')
    expect(valueLabel(field('progress'), { amount: 18, unit: 'pages', from: 40, to: 58 })).toBe('18 pages (40 to 58)')
    expect(valueLabel(field('progress'), { amount: 21, unit: 'minutes of video', from: 750, to: 2010 })).toBe('21 minutes of video (12:30 to 33:30)')
    expect(valueLabel(field('place'), null)).toBeNull()
  })
})

describe('slider defaults', () => {
  const s: LogSchema = {
    groups: [{ id: 1, key: null, name: 'G', section: 'quick', sortOrder: 0, archived: false }],
    fields: [
      { id: 1, key: 'focus', groupId: 1, label: 'Focus', type: 'scale', options: [], scale: { min: 1, max: 5, labels: ['a', 'b', 'c', 'd', 'e'] }, sortOrder: 0, archived: false },
      { id: 2, key: null, groupId: 1, label: 'Hours', type: 'number', options: [], scale: { min: 0, max: 12, step: 0.5, labels: [] }, sortOrder: 1, archived: false },
      { id: 3, key: null, groupId: 1, label: 'Diff', type: 'slider', options: [], scale: { min: 1, max: 10, labels: [] }, sortOrder: 2, archived: false },
      { id: 4, key: null, groupId: 1, label: 'Pages', type: 'number', options: [], scale: null, sortOrder: 3, archived: false }
    ]
  }
  it('fills the middle where nothing applies, keeps pre-filled and cleared answers, and marks all untouched', () => {
    const { values, untouched } = fillSliderDefaults(s, { 1: 4, 3: null }, ['quick'])
    expect(values).toEqual({ 1: 4, 2: 6, 3: null })
    expect(untouched).toEqual([1, 2])
    expect(isSliderField(s.fields[3])).toBe(false)
    expect(sliderMiddle(s.fields[2])).toBe(6)
  })
})

describe('check-in chips', () => {
  it('shows short names, half hours, and one Sleep chip', async () => {
    const { answerChips } = await import('./logfields')
    const s: LogSchema = {
      groups: [{ id: 1, key: 'today', name: 'Today', section: 'day', sortOrder: 0, archived: false }],
      fields: [
        { id: 1, key: 'sleep', groupId: 1, label: 'Sleep last night', type: 'scale', options: [], scale: { min: 1, max: 3, labels: ['Poor', 'Okay', 'Good'] }, sortOrder: 0, archived: false },
        { id: 2, key: 'sleep-hours', groupId: 1, label: 'Hours of sleep', type: 'number', options: [], scale: { min: 0, max: 12, step: 0.5, unit: 'h', labels: [] }, sortOrder: 1, archived: false },
        { id: 3, key: 'day-energy', groupId: 1, label: 'Energy today', type: 'scale', options: [], scale: { min: 1, max: 5, labels: ['Exhausted', 'Tired', 'Okay', 'Alert', 'Energised'] }, sortOrder: 2, archived: false },
        { id: 4, key: null, groupId: 1, label: 'Coffee today', type: 'single', options: [{ id: 'y', label: 'Yes' }], scale: null, sortOrder: 3, archived: false }
      ]
    }
    expect(answerChips(s, { 1: 3, 2: 7.5, 3: 4, 4: 'y' }, 'day')).toEqual([
      { label: 'Sleep', value: '7½ h' },
      { label: 'Energy', value: 'Alert' },
      { label: 'Coffee', value: 'Yes' }
    ])
    expect(answerChips(s, { 1: 3 }, 'day')).toEqual([{ label: 'Sleep', value: 'Good' }])
  })
})
