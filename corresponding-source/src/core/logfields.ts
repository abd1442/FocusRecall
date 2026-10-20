// The after-block log as data: groups of fields, each with options or a
// named scale. Insights loop over every field, so new fields and options the
// user adds are analysed like the built-in ones.

export type FieldType = 'single' | 'multi' | 'scale' | 'slider' | 'number' | 'text' | 'activity' | 'progress'

/** quick: asked every time; setup: remembered study setup; detail: optional "More detail". */
/** quick: per subject, every session. setup: remembered. detail: per session, optional. day: once per study day. */
export type Section = 'quick' | 'setup' | 'detail' | 'day'

export interface FieldOption {
  /** Stable id stored in answers; labels can be renamed freely. */
  id: string
  label: string
  archived?: boolean
  /** Activity options only: the unit progress is recorded in. */
  defaultUnit?: string
  units?: string[]
}

/** A slider with named stops. Values are numbers; only the names are shown. */
export interface ScaleConfig {
  min: number
  max: number
  labels: string[]
  /** For a number shown as a slider (hours of sleep): the step and the unit after the value. */
  step?: number
  unit?: string
}

export interface LogGroup {
  id: number
  /** Built-in groups have a key; user groups have null. */
  key: string | null
  name: string
  section: Section
  sortOrder: number
  archived: boolean
}

export interface LogField {
  id: number
  key: string | null
  groupId: number
  label: string
  type: FieldType
  options: FieldOption[]
  scale: ScaleConfig | null
  sortOrder: number
  archived: boolean
}

export interface LogSchema {
  groups: LogGroup[]
  fields: LogField[]
}

export interface ProgressValue {
  amount: number | null
  unit: string | null
  /** For timestamp units (minutes of video) from and to are seconds. */
  from: number | null
  to: number | null
}

export type FieldValue = string | string[] | number | ProgressValue | null

/** Answers for one block, by field id. */
export type LogValues = Record<number, FieldValue>

/** Short notes per group, by group id. */
export type GroupNotes = Record<number, string>

// --- Units -------------------------------------------------------------------

/** Units whose from/to are positions in a recording (h:mm:ss), not counts. */
export const TIMESTAMP_UNITS = ['minutes of video'] as const

export function isTimestampUnit(unit: string | null | undefined): boolean {
  return !!unit && (TIMESTAMP_UNITS as readonly string[]).includes(unit)
}

/** Amount from a from/to range: counts subtract; timestamps give minutes. */
export function amountFromRange(unit: string | null, from: number | null, to: number | null): number | null {
  if (from === null || to === null || to < from) return null
  if (isTimestampUnit(unit)) return Math.round(((to - from) / 60) * 10) / 10
  return to - from
}

/** "1:02:05" or "12:30" to seconds; null when it does not parse. */
export function parseTimestamp(text: string): number | null {
  const parts = text.trim().split(':')
  if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  return parts.reduce((s, p) => s * 60 + Number(p), 0)
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Units offered for an activity: its default first, then the others. */
export function unitsFor(activity: FieldOption | undefined, itemUnit: string): string[] {
  if (!activity?.defaultUnit) return [itemUnit]
  return [activity.defaultUnit, ...(activity.units ?? []).filter((u) => u !== activity.defaultUnit)]
}

export const unitMemoryKey = (itemId: number, activityId: string): string => `${itemId}:${activityId}`

/**
 * The unit to preselect: the last unit used for this subject and activity,
 * else the activity's default, else (custom activities) the subject's unit.
 */
export function resolveUnit(
  activity: FieldOption | undefined,
  itemId: number,
  itemUnit: string,
  memory: Record<string, string>
): string {
  if (activity) {
    const remembered = memory[unitMemoryKey(itemId, activity.id)]
    if (remembered) return remembered
  }
  return activity?.defaultUnit || itemUnit
}

// --- Named scales ------------------------------------------------------------

/** The name for a value on a named scale (labels split the range evenly). */
export function scaleLabel(scale: ScaleConfig, value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const span = scale.max - scale.min + 1
  const i = Math.floor(((Math.round(value) - scale.min) * scale.labels.length) / span)
  return scale.labels[Math.min(scale.labels.length - 1, Math.max(0, i))]
}

/** A representative value for each name (the middle of its stretch, rounded down). */
export function scaleStops(scale: ScaleConfig): { label: string; value: number }[] {
  const span = scale.max - scale.min + 1
  return scale.labels.map((label, i) => {
    const lo = scale.min + Math.ceil((i * span) / scale.labels.length)
    const hi = scale.min + Math.ceil(((i + 1) * span) / scale.labels.length) - 1
    return { label, value: Math.floor((lo + hi) / 2) }
  })
}

/** Old 1-to-5 difficulty to the 1-to-10 slider, keeping each answer under the same name. */
export function difficultyFromOld(v: number): number {
  return 2 * v - 1
}

export const SCALES = {
  focus: { min: 1, max: 5, labels: ['Scattered', 'Drifting', 'Steady', 'Focused', 'Deep'] },
  difficulty: { min: 1, max: 10, labels: ['Easy', 'Manageable', 'Challenging', 'Hard', 'Very hard'] },
  understanding: { min: 1, max: 4, labels: ['Lost', 'Partly', 'Mostly', 'Fully'] },
  energy: { min: 1, max: 5, labels: ['Exhausted', 'Tired', 'Okay', 'Alert', 'Energised'] },
  level: { min: 1, max: 10, labels: ['None', 'Low', 'Moderate', 'High', 'Very high'] },
  recall: { min: 1, max: 5, labels: ['Nothing', 'A little', 'About half', 'Most', 'Almost all'] }
} satisfies Record<string, ScaleConfig>

// --- Seed schema -------------------------------------------------------------

export interface SeedField {
  key: string
  label: string
  type: FieldType
  options?: (string | FieldOption)[]
  scale?: ScaleConfig
}

export interface SeedGroup {
  key: string
  name: string
  section: Section
  fields: SeedField[]
}

const act = (id: string, label: string, defaultUnit: string, units: string[] = []): FieldOption => ({ id, label, defaultUnit, units })

export const SEED_ACTIVITIES: FieldOption[] = [
  act('reading-book', 'Reading a book', 'pages', ['chapters', 'sections']),
  act('reading-pdf', 'Reading a PDF, paper or slides', 'pages', ['slides', 'sections']),
  act('lecture-recorded', 'Watching a recorded lecture', 'minutes of video', ['lectures', 'videos']),
  act('lecture-live', 'Attending a live lecture or class', 'minutes', ['sessions']),
  act('listening', 'Listening (audio, podcast, audiobook)', 'minutes', ['chapters', 'episodes']),
  act('notes', 'Taking or rewriting notes', 'pages', ['sections']),
  act('problems', 'Solving problems or exercises', 'problems', ['sets']),
  act('past-paper', 'Past paper or mock exam', 'questions', ['papers']),
  act('flashcards', 'Flashcards or memorising', 'cards', ['decks']),
  act('reviewing', 'Reviewing or revising', 'topics', ['sections', 'pages']),
  act('summarising', 'Summarising or mind-mapping', 'sections', ['topics']),
  act('writing', 'Writing (essay, report, thesis)', 'words', ['pages', 'sections']),
  act('coding', 'Coding or practical project', 'tasks', ['minutes']),
  act('studio', 'Drawing, design or studio work', 'tasks', ['sheets']),
  act('lab', 'Lab or practical', 'tasks', ['experiments']),
  act('language', 'Language practice', 'exercises', ['minutes']),
  act('group', 'Group study or discussion', 'topics', ['minutes']),
  act('research', 'Research or finding sources', 'sources', ['pages']),
  { id: 'other', label: 'Other' }
]

export const SEED_GROUPS: SeedGroup[] = [
  {
    key: 'did',
    name: 'What you did',
    section: 'quick',
    fields: [
      { key: 'activity', label: 'Activity', type: 'activity', options: SEED_ACTIVITIES },
      { key: 'progress', label: 'Progress', type: 'progress' },
      { key: 'difficulty', label: 'How hard was this material?', type: 'slider', scale: SCALES.difficulty }
    ]
  },
  {
    key: 'went',
    name: 'How it went',
    section: 'quick',
    fields: [
      { key: 'focus', label: 'Focus', type: 'scale', scale: SCALES.focus },
      { key: 'understanding', label: 'Understanding', type: 'scale', scale: SCALES.understanding }
    ]
  },
  {
    key: 'setup',
    name: 'Study setup',
    section: 'setup',
    fields: [
      { key: 'place', label: 'Place', type: 'single', options: ['Desk at home', 'Bedroom', 'Living room', 'Kitchen table', 'Office', 'Library', 'University', 'Cafe', 'Outdoors', 'Commuting', 'Other'] },
      { key: 'posture', label: 'Seat and posture', type: 'single', options: ['Desk chair', 'Sofa', 'Sitting on bed', 'Lying down', 'Standing desk', 'Floor'] },
      { key: 'device', label: 'Device', type: 'single', options: ['Laptop', 'Desktop', 'Tablet', 'Phone', 'Paper only'] },
      { key: 'screens', label: 'Screens', type: 'single', options: ['One', 'Two', 'Three or more'] },
      { key: 'format', label: 'Material format', type: 'single', options: ['Printed book', 'PDF', 'E-reader', 'Video', 'Audio', 'Slides', 'Handwritten notes', 'Website'] },
      { key: 'sound', label: 'Sound', type: 'single', options: ['Silence', 'Instrumental', 'Music with lyrics', 'Lo-fi', 'Classical', 'White or brown noise', 'Nature sounds', 'Cafe noise', 'Talk or podcast in the background'] },
      { key: 'headphones', label: 'Headphones', type: 'single', options: ['None', 'Earbuds', 'Over-ear', 'Noise-cancelling'] },
      { key: 'noise', label: 'Noise around me', type: 'single', options: ['Quiet', 'Some noise', 'Noisy'] },
      { key: 'lighting', label: 'Lighting', type: 'single', options: ['Daylight', 'Bright lamp', 'Dim', 'Dark with screen only'] },
      { key: 'temperature', label: 'Temperature', type: 'single', options: ['Cold', 'Comfortable', 'Warm', 'Hot'] },
      { key: 'people', label: 'People around', type: 'single', options: ['Alone', 'Others present and quiet', 'Others talking', 'Studying with someone', 'Online study call'] },
      { key: 'pet', label: 'Pet in the room', type: 'single', options: ['No', 'Yes'] },
      { key: 'phone-location', label: 'Phone location', type: 'single', options: ['Another room', 'In a bag or drawer', 'On desk face down', 'On desk face up', 'In hand'] },
      { key: 'phone-mode', label: 'Phone mode', type: 'single', options: ['Off', 'Do not disturb', 'Silent', 'Normal'] },
      { key: 'internet', label: 'Internet', type: 'single', options: ['Normal', 'Blockers on', 'Offline'] }
    ]
  },
  {
    key: 'food',
    name: 'Food and drink',
    section: 'detail',
    fields: [
      { key: 'drinks', label: 'Drinks', type: 'single', options: ['None', 'Water', 'Coffee', 'Tea', 'Energy drink', 'Juice or soft drink'] },
      { key: 'food', label: 'Food', type: 'single', options: ['Nothing', 'Snacking', 'Eating a meal', 'Just ate', 'Hungry'] }
    ]
  },
  {
    key: 'alongside',
    name: 'Alongside studying',
    section: 'detail',
    fields: [
      { key: 'side', label: 'Alongside studying', type: 'multi', options: ['Fidget toy', 'Doodling', 'Chewing gum', 'Pacing', 'Chat open', 'TV or video on', 'Social media tab open', 'Browsing music', 'Other'] }
    ]
  },
  {
    key: 'methods',
    name: 'Study methods',
    section: 'detail',
    fields: [
      { key: 'methods', label: 'Study methods used', type: 'multi', options: ['Reading', 'Re-reading', 'Highlighting', 'Summarising', 'Handwritten notes', 'Typed notes', 'Practice problems', 'Flashcards', 'Self-testing', 'Explaining aloud', 'Mind map', 'Following along', 'Memorising'] }
    ]
  },
  {
    key: 'feeling',
    name: 'How you felt',
    section: 'detail',
    fields: [
      { key: 'energy', label: 'Energy', type: 'scale', scale: SCALES.energy },
      { key: 'mood', label: 'Mood', type: 'multi', options: ['Calm', 'Content', 'Motivated', 'Excited', 'Neutral', 'Bored', 'Low', 'Anxious', 'Stressed', 'Frustrated'] },
      { key: 'stress', label: 'Stress', type: 'slider', scale: SCALES.level },
      { key: 'motivation', label: 'Motivation for this subject', type: 'slider', scale: SCALES.level }
    ]
  },
  {
    key: 'day',
    name: 'Body and day',
    section: 'detail',
    fields: [
      { key: 'sleep', label: 'Sleep last night', type: 'single', options: ['Poor', 'Okay', 'Good'] },
      { key: 'sleep-hours', label: 'Hours of sleep', type: 'number' },
      { key: 'exercise', label: 'Exercise today', type: 'single', options: ['No', 'Light', 'Yes'] },
      { key: 'physical', label: 'Physical state', type: 'multi', options: ['Fine', 'Headache', 'Eye strain', 'Back or neck pain', 'Sick', 'Sleepy'] }
    ]
  },
  {
    key: 'pressure',
    name: 'Pressure',
    section: 'detail',
    fields: [{ key: 'pressure', label: 'Pressure', type: 'single', options: ['No deadline', 'Deadline this week', 'Exam within days', 'Catching up'] }]
  },
  {
    key: 'note',
    name: 'Note',
    section: 'detail',
    fields: [{ key: 'note', label: 'Free note', type: 'text' }]
  }
]

/** A stable option id from a label: "Desk at home" becomes "desk-at-home". */
export function optionId(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'option'
  )
}

/** A new option id that does not clash with existing ones. */
export function uniqueOptionId(label: string, existing: FieldOption[]): string {
  const base = optionId(label)
  const ids = new Set(existing.map((o) => o.id))
  if (!ids.has(base)) return base
  let n = 2
  while (ids.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export function seedOptions(options: (string | FieldOption)[] | undefined): FieldOption[] {
  return (options ?? []).map((o) => (typeof o === 'string' ? { id: optionId(o), label: o } : o))
}

// --- Schema helpers ----------------------------------------------------------

export function fieldByKey(schema: LogSchema, key: string): LogField | undefined {
  return schema.fields.find((f) => f.key === key)
}

export function groupOf(schema: LogSchema, field: LogField): LogGroup | undefined {
  return schema.groups.find((g) => g.id === field.groupId)
}

export function fieldsIn(schema: LogSchema, section: Section, includeArchived = false): LogField[] {
  const groups = new Map(schema.groups.map((g) => [g.id, g]))
  return schema.fields
    .filter((f) => groups.get(f.groupId)?.section === section && (includeArchived || (!f.archived && !groups.get(f.groupId)!.archived)))
    .sort((a, b) => groups.get(a.groupId)!.sortOrder - groups.get(b.groupId)!.sortOrder || a.sortOrder - b.sortOrder)
}

export function isEmptyValue(v: FieldValue | undefined): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return v.amount === null && v.from === null && v.to === null
  return false
}

/** A readable answer: option labels, scale names, or the number or text itself. */
export function valueLabel(field: LogField, v: FieldValue | undefined): string | null {
  if (isEmptyValue(v)) return null
  const opt = (id: string): string => field.options.find((o) => o.id === id)?.label ?? id
  switch (field.type) {
    case 'single':
    case 'activity':
      return opt(v as string)
    case 'multi':
      return (v as string[]).map(opt).join(', ')
    case 'scale':
    case 'slider':
      return field.scale ? scaleLabel(field.scale, v as number) : String(v)
    case 'progress': {
      const p = v as ProgressValue
      const range =
        p.from !== null || p.to !== null
          ? isTimestampUnit(p.unit)
            ? `${p.from !== null ? formatTimestamp(p.from) : '?'} to ${p.to !== null ? formatTimestamp(p.to) : '?'}`
            : `${p.from ?? '?'} to ${p.to ?? '?'}`
          : null
      return [p.amount !== null ? `${p.amount} ${p.unit ?? ''}`.trim() : null, range && `(${range})`].filter(Boolean).join(' ')
    }
    default:
      return String(v)
  }
}

/** One line for the study setup: "Desk at home · Laptop · Instrumental". */
export function setupSummary(schema: LogSchema, values: LogValues): string {
  return sectionSummary(schema, values, 'setup')
}

/** One line of the answers in a section, for "Study setup: … Change" and "Today: … Change". */
export function sectionSummary(schema: LogSchema, values: LogValues, section: Section): string {
  return fieldsIn(schema, section)
    .map((f) => valueLabel(f, values[f.id]))
    .filter((s): s is string => !!s)
    .join(' · ')
}

/**
 * The default study setup from past answers (newest first): per field either
 * the last answer given or the most common one (ties go to the most recent).
 */
export function setupDefault(schema: LogSchema, history: LogValues[], mode: 'last' | 'most'): LogValues {
  const out: LogValues = {}
  for (const f of fieldsIn(schema, 'setup')) {
    const answers = history.map((h) => h[f.id]).filter((v) => !isEmptyValue(v))
    if (!answers.length) continue
    if (mode === 'last') {
      out[f.id] = answers[0]
      continue
    }
    const counts = new Map<string, { n: number; first: number; v: FieldValue }>()
    answers.forEach((v, i) => {
      const k = JSON.stringify(v)
      const e = counts.get(k)
      if (e) e.n++
      else counts.set(k, { n: 1, first: i, v })
    })
    out[f.id] = [...counts.values()].sort((a, b) => b.n - a.n || a.first - b.first)[0].v
  }
  return out
}

/**
 * Pre-fill for a new log. Quick answers come from the last log on the same
 * subject (the planned activity wins over the last one); progress starts
 * where it stopped, in the remembered unit, with amount and end empty. Setup
 * comes from the default setup. "More detail" is never pre-filled.
 */
export function prefillLog(
  schema: LogSchema,
  previous: LogValues | null,
  setup: LogValues,
  ctx: { itemId: number; itemUnit: string; plannedActivity: string | null; unitMemory: Record<string, string> }
): LogValues {
  const out: LogValues = {}
  const activityField = fieldByKey(schema, 'activity')
  const progressField = fieldByKey(schema, 'progress')

  for (const f of fieldsIn(schema, 'quick')) {
    if (f.type === 'progress') continue
    const prev = previous?.[f.id]
    if (!isEmptyValue(prev)) out[f.id] = Array.isArray(prev) ? [...prev] : prev!
  }
  if (activityField && ctx.plannedActivity && activityField.options.some((o) => o.id === ctx.plannedActivity)) {
    out[activityField.id] = ctx.plannedActivity
  }
  if (progressField) {
    const activity = activityField?.options.find((o) => o.id === out[activityField.id])
    const unit = resolveUnit(activity, ctx.itemId, ctx.itemUnit, ctx.unitMemory)
    const prev = previous?.[progressField.id] as ProgressValue | undefined
    const sameUnit = prev && prev.unit === unit
    out[progressField.id] = { amount: null, unit, from: sameUnit ? prev!.to : null, to: null }
  }
  for (const f of fieldsIn(schema, 'setup')) if (!isEmptyValue(setup[f.id])) out[f.id] = setup[f.id]
  return out
}

/** Fields shown as sliders: named scales, sliders, and numbers with a range (hours of sleep). */
export function isSliderField(f: Pick<LogField, 'type' | 'scale'>): boolean {
  return f.type === 'scale' || f.type === 'slider' || (f.type === 'number' && !!f.scale && f.scale.max > f.scale.min)
}

/** A slider's starting value when nothing earlier applies: the middle stop. */
export function sliderMiddle(f: Pick<LogField, 'scale'>): number {
  const s = f.scale ?? { min: 1, max: 5, labels: [] }
  const step = s.step ?? 1
  return s.min + Math.round((s.max - s.min) / 2 / step) * step
}

/**
 * Every slider in the given sections gets a value: the one already there
 * (pre-filled from the last session on the subject), otherwise the middle.
 * All of them start untouched; the form marks a slider touched when it is
 * moved, and a cleared slider (null) stays cleared.
 */
export function fillSliderDefaults(schema: LogSchema, values: LogValues, sections: Section[]): { values: LogValues; untouched: number[] } {
  const out: LogValues = { ...values }
  const untouched: number[] = []
  for (const section of sections) {
    for (const f of fieldsIn(schema, section)) {
      if (!isSliderField(f)) continue
      if (out[f.id] === undefined) out[f.id] = sliderMiddle(f)
      if (out[f.id] !== null) untouched.push(f.id)
    }
  }
  return { values: out, untouched }
}

/** Short names for the check-in chips ("Hours of sleep" reads "Sleep"). */
const CHIP_NAMES: Record<string, string> = {
  'sleep-hours': 'Sleep',
  sleep: 'Sleep',
  'day-energy': 'Energy',
  'day-mood': 'Mood',
  exercise: 'Exercise',
  physical: 'Body',
  pressure: 'Pressure'
}

/** "7½ h" for a number with a unit. */
function numberWithUnit(n: number, unit?: string): string {
  const whole = Math.floor(n)
  const half = Math.abs(n - whole - 0.5) < 1e-9
  const text = half ? `${whole}½` : String(Math.round(n * 10) / 10)
  return unit ? `${text} ${unit}` : text
}

/**
 * A section's answers as short chips: "Sleep 7½ h", "Energy Alert", "Mood Good".
 * When hours of sleep are given, the sleep quality is left out (one Sleep chip).
 */
export function answerChips(schema: LogSchema, values: LogValues, section: Section): { label: string; value: string }[] {
  const fields = fieldsIn(schema, section)
  const hasHours = fields.some((f) => f.key === 'sleep-hours' && !isEmptyValue(values[f.id]))
  const out: { label: string; value: string }[] = []
  for (const f of fields) {
    const v = values[f.id]
    if (isEmptyValue(v) || (f.key === 'sleep' && hasHours)) continue
    const value = f.type === 'number' && typeof v === 'number' ? numberWithUnit(v, f.scale?.unit) : valueLabel(f, v)
    if (!value) continue
    out.push({ label: (f.key && CHIP_NAMES[f.key]) || f.label.replace(/ today$/i, ''), value })
  }
  return out
}
