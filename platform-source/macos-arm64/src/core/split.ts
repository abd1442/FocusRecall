// The forgotten switch: one part split into several subjects afterwards, with
// dividers the user drags to estimate when each switch happened.

/** Dividers are never closer than this to each other or to the ends. */
export const MIN_SPLIT_MS = 60_000

/** n-1 dividers that cut [start, end] into n equal parts. */
export function evenBoundaries(start: number, end: number, n: number): number[] {
  const step = (end - start) / Math.max(1, n)
  return Array.from({ length: Math.max(0, n - 1) }, (_, i) => Math.round(start + step * (i + 1)))
}

/**
 * Keep dividers in order and inside the range, at least `minGap` apart where
 * the range allows it. Used while dragging and before saving.
 */
export function normalizeBoundaries(start: number, end: number, boundaries: number[], minGap = MIN_SPLIT_MS): number[] {
  const n = boundaries.length
  const gap = Math.min(minGap, (end - start) / (n + 1))
  const out = [...boundaries].sort((a, b) => a - b)
  for (let i = 0; i < n; i++) {
    const lo = (i === 0 ? start : out[i - 1]) + gap
    const hi = end - gap * (n - i)
    out[i] = Math.round(Math.min(hi, Math.max(lo, out[i])))
  }
  return out
}

/** Which part a moment falls in, given the dividers (ordered). */
export function partIndexAt(t: number, boundaries: number[]): number {
  let i = 0
  while (i < boundaries.length && t >= boundaries[i]) i++
  return i
}

/** The [start, end] of each part from the range and its dividers. */
export function partRanges(start: number, end: number, boundaries: number[]): { start: number; end: number }[] {
  const cuts = [start, ...boundaries, end]
  return cuts.slice(0, -1).map((s, i) => ({ start: s, end: cuts[i + 1] }))
}
