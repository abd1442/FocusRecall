// Named scales: answers are shown as words, never digits, and stored as numbers.

export const FOCUS_WORDS = ['Scattered', 'Drifting', 'Steady', 'Focused', 'Deep'] as const
export const RECALL_WORDS = ['Nothing', 'A little', 'About half', 'Most', 'Almost all'] as const

/** The word for a stored 1-to-5 value, or null when unanswered or out of range. */
export function wordFor(words: readonly string[], value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const i = Math.round(value) - 1
  return i >= 0 && i < words.length ? words[i] : null
}
