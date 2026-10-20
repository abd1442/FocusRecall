import { type FieldOption, type FieldValue, type LogField, type LogSchema, type LogValues, type ProgressValue } from './logfields'

/** Selected and most recent activity, then frequent choices; history is newest first. */
export function likelyActivities(options: FieldOption[], selected: string | null, history: string[], limit = 4): FieldOption[] {
  const available = options.filter((o) => !o.archived || o.id === selected)
  const counts = new Map<string, number>()
  for (const id of history) counts.set(id, (counts.get(id) ?? 0) + 1)
  const recent = history.find((id) => available.some((o) => o.id === id))
  const ranked = [...available].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  const ids = [...new Set([selected, recent, ...ranked.map((o) => o.id)].filter((id): id is string => !!id))]
  return ids.map((id) => available.find((o) => o.id === id)).filter((o): o is FieldOption => !!o).slice(0, limit)
}

/**
 * The essential questions after a session, asked as large cards in this
 * order. Other per-subject (quick) fields the owner added come after them.
 */
export const ESSENTIAL_QUESTIONS: { key: string; question: string }[] = [
  { key: 'activity', question: 'What did you do?' },
  { key: 'progress', question: 'How far did you get?' },
  { key: 'focus', question: 'How focused were you?' },
  { key: 'difficulty', question: 'How hard was the material?' },
  { key: 'understanding', question: 'How well did you understand it?' }
]

export interface QuestionCard {
  field: LogField
  question: string
}

/** The question cards for one subject: the essential questions first, then any other quick field. */
export function questionCards(schema: LogSchema): QuestionCard[] {
  const quickGroups = new Map(schema.groups.filter((g) => g.section === 'quick' && !g.archived).map((g) => [g.id, g]))
  const fields = schema.fields
    .filter((f) => quickGroups.has(f.groupId) && !f.archived)
    .sort((a, b) => quickGroups.get(a.groupId)!.sortOrder - quickGroups.get(b.groupId)!.sortOrder || a.sortOrder - b.sortOrder)
  const rank = (f: LogField): number => {
    const i = ESSENTIAL_QUESTIONS.findIndex((q) => q.key === f.key)
    return i < 0 ? ESSENTIAL_QUESTIONS.length : i
  }
  return fields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map(({ f }) => ({ field: f, question: ESSENTIAL_QUESTIONS.find((q) => q.key === f.key)?.question ?? f.label }))
}

/** Whether a value counts as an answer (an empty progress or text does not). */
export function hasAnswer(value: FieldValue | undefined): boolean {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    const p = value as ProgressValue
    return p.amount !== null || p.from !== null || p.to !== null
  }
  return true
}

/**
 * Whether a card is answered: it has a value, and a slider still at its
 * default (untouched) only counts once it is confirmed or moved.
 */
export function cardAnswered(field: LogField, values: LogValues, untouched: number[] = []): boolean {
  if (!hasAnswer(values[field.id])) return false
  return !untouched.includes(field.id)
}
