// Migration 10 (round 6): ordered choices become named sliders. Rule for the
// whole app: options with an order get a slider; chips stay only for options
// with no order. Existing answers are converted; an answer with an option the
// user added (which has no place on the new scale) is dropped.
import type Database from 'better-sqlite3'

interface Conversion {
  key: string
  labels: string[]
  /** Old option id to the new value (1 = first label). */
  map: Record<string, number>
}

const SINGLE: Conversion[] = [
  { key: 'sleep', labels: ['Poor', 'Okay', 'Good'], map: { poor: 1, okay: 2, good: 3 } },
  { key: 'exercise', labels: ['None', 'Light', 'Moderate', 'Hard'], map: { no: 1, light: 2, yes: 3 } },
  {
    key: 'pressure',
    labels: ['Relaxed', 'Some', 'Deadline this week', 'Exam within days'],
    map: { 'no-deadline': 1, 'catching-up': 2, 'deadline-this-week': 3, 'exam-within-days': 4 }
  },
  { key: 'screens', labels: ['One', 'Two', 'Three or more'], map: { one: 1, two: 2, 'three-or-more': 3 } },
  { key: 'noise', labels: ['Quiet', 'Some noise', 'Noisy'], map: { quiet: 1, 'some-noise': 2, noisy: 3 } },
  { key: 'temperature', labels: ['Cold', 'Comfortable', 'Warm', 'Hot'], map: { cold: 1, comfortable: 2, warm: 3, hot: 4 } }
]

/** "Mood today" was a set of words; it becomes one slider. Each word counts toward a place on it. */
const MOOD_TODAY = {
  key: 'day-mood',
  labels: ['Low', 'Flat', 'Okay', 'Good', 'Great'],
  score: { low: 1, bored: 2, anxious: 2, stressed: 2, frustrated: 2, neutral: 3, calm: 4, content: 4, motivated: 5, excited: 5 } as Record<string, number>
}

export function migrate10(db: Database.Database): void {
  const field = db.prepare('SELECT id FROM log_fields WHERE key = ?')
  const setScale = db.prepare("UPDATE log_fields SET type = 'scale', options = '[]', scale = ? WHERE id = ?")
  const tables = ['block_log_values', 'day_log_values']

  const convert = (fieldId: number, fn: (old: unknown) => number | null): void => {
    for (const table of tables) {
      const keyCol = table === 'block_log_values' ? 'block_id' : 'day'
      const rows = db.prepare(`SELECT ${keyCol} AS k, value FROM ${table} WHERE field_id = ?`).all(fieldId) as { k: string | number; value: string }[]
      for (const r of rows) {
        const next = fn(JSON.parse(r.value))
        if (next === null) db.prepare(`DELETE FROM ${table} WHERE ${keyCol} = ? AND field_id = ?`).run(r.k, fieldId)
        else db.prepare(`UPDATE ${table} SET value = ? WHERE ${keyCol} = ? AND field_id = ?`).run(JSON.stringify(next), r.k, fieldId)
      }
    }
  }

  for (const c of SINGLE) {
    const f = field.get(c.key) as { id: number } | undefined
    if (!f) continue
    setScale.run(JSON.stringify({ min: 1, max: c.labels.length, labels: c.labels }), f.id)
    convert(f.id, (old) => (typeof old === 'string' && c.map[old] !== undefined ? c.map[old] : null))
  }

  const mood = field.get(MOOD_TODAY.key) as { id: number } | undefined
  if (mood) {
    setScale.run(JSON.stringify({ min: 1, max: 5, labels: MOOD_TODAY.labels }), mood.id)
    convert(mood.id, (old) => {
      const scores = (Array.isArray(old) ? old : []).map((w) => MOOD_TODAY.score[String(w)]).filter((n): n is number => n !== undefined)
      return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    })
  }

  // Hours of sleep stays a number, shown as a slider from 0 to 12 in half hours.
  const hours = field.get('sleep-hours') as { id: number } | undefined
  if (hours) db.prepare('UPDATE log_fields SET scale = ? WHERE id = ?').run(JSON.stringify({ min: 0, max: 12, step: 0.5, unit: 'h', labels: [] }), hours.id)
}
