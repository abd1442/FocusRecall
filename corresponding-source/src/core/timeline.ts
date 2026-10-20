// The editable session timeline: one line for the whole session. What the
// numbers are while the user drags, where time marks go, and how a dragged
// span is kept inside the session.
import { sessionStats, type DistractionSource, type SessionStats } from './distractions'
import { mergeIntervals, overlapMs } from './timer'
import type { Id } from './types'

export interface LinePart {
  id: Id
  itemId: Id
  start: number
  end: number
}

export interface LineDistraction {
  id: Id
  start: number
  end: number
  source: DistractionSource
  confirmed: boolean
}

/** Spans that take time out of focus: Distracted spells, and idle gaps confirmed as away. */
export function removesTime(d: Pick<LineDistraction, 'source' | 'confirmed'>): boolean {
  return d.source === 'manual' || d.source === 'pause' || (d.source === 'idle' && d.confirmed)
}

export interface LinePreview {
  /** Focus seconds per part. */
  parts: Record<Id, number>
  /** Focus seconds per subject. */
  subjects: Record<Id, number>
  totalFocus: number
  stats: SessionStats
}

/** Focus time per part and per subject, and the session numbers, for the line as drawn now. */
export function previewLine(parts: LinePart[], distractions: LineDistraction[]): LinePreview {
  const removed = mergeIntervals(
    distractions.filter(removesTime).map((d) => ({ start: d.start, end: d.end })),
    Number.MAX_SAFE_INTEGER
  )
  const out: LinePreview = { parts: {}, subjects: {}, totalFocus: 0, stats: sessionStats([], []) }
  for (const p of parts) {
    const f = Math.max(0, p.end - p.start - overlapMs(removed, p.start, p.end)) / 1000
    out.parts[p.id] = f
    out.subjects[p.itemId] = (out.subjects[p.itemId] ?? 0) + f
    out.totalFocus += f
  }
  out.stats = sessionStats(
    parts.map((p) => ({ start: p.start, end: p.end })),
    distractions.map((d) => ({ startedAt: d.start, durationSeconds: (d.end - d.start) / 1000, source: d.source, confirmed: d.confirmed }))
  )
  return out
}

/** Shortest span a dragged distraction can have. */
export const MIN_SPAN_MS = 5_000

/** Keep a span inside [from, to] and at least `min` long, moving the edge that was dragged. */
export function clampSpan(start: number, end: number, from: number, to: number, min = MIN_SPAN_MS): { start: number; end: number } {
  let s = Math.max(from, Math.min(start, to - min))
  let e = Math.min(to, Math.max(end, from + min))
  if (e - s < min) {
    if (start !== s) s = Math.max(from, e - min)
    else e = Math.min(to, s + min)
  }
  return { start: Math.round(s), end: Math.round(e) }
}

/** Move a whole span by `delta`, keeping its length and keeping it inside [from, to]. */
export function moveSpan(start: number, end: number, delta: number, from: number, to: number): { start: number; end: number } {
  const len = end - start
  const s = Math.max(from, Math.min(to - len, start + delta))
  return { start: Math.round(s), end: Math.round(s + len) }
}

/** The part a moment falls in (the last part for the very end). */
export function partAt(parts: LinePart[], t: number): LinePart | null {
  const sorted = [...parts].sort((a, b) => a.start - b.start)
  return sorted.find((p) => t >= p.start && t < p.end) ?? (sorted.length && t === sorted[sorted.length - 1].end ? sorted[sorted.length - 1] : null)
}

const TICK_STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120]

/** Time marks every 1, 2, 5, 10 ... minutes, chosen so the line gets about 4 to 10 of them, on round clock minutes. */
export function timeTicks(from: number, to: number, maxTicks = 10): number[] {
  const minutes = Math.max(1, (to - from) / 60_000)
  const step = TICK_STEPS_MIN.find((m) => minutes / m <= maxTicks) ?? 240
  const stepMs = step * 60_000
  const out: number[] = []
  // Round to the clock: marks fall on whole minutes that are multiples of the step.
  const offset = new Date(from).getTimezoneOffset() * 60_000
  let t = Math.ceil((from - offset) / stepMs) * stepMs + offset
  for (; t <= to; t += stepMs) out.push(t)
  return out
}

/** One piece of the flat session line. Each moment of the session is exactly one piece. */
export interface LineSegment {
  kind: 'focus' | 'distracted' | 'detected' | 'idle'
  start: number
  end: number
  /** The part (subject) this moment belongs to. */
  partId: Id
  itemId: Id
  /** For distraction pieces: the distraction drawn here. */
  distractionId: Id | null
  confirmed: boolean
}

const KIND_OF: Record<DistractionSource, LineSegment['kind']> = { manual: 'distracted', pause: 'distracted', auto: 'detected', idle: 'idle' }
/** Where distractions overlap, the one you pressed wins, then no input, then a detection. */
const RANK: Record<LineSegment['kind'], number> = { distracted: 3, idle: 2, detected: 1, focus: 0 }

/**
 * The session as side-by-side pieces, never nested: focus in each part,
 * cut by distractions. Neighbouring pieces of the same kind and part join up.
 */
export function flattenLine(parts: LinePart[], distractions: LineDistraction[]): LineSegment[] {
  const sorted = [...parts].sort((a, b) => a.start - b.start)
  const out: LineSegment[] = []
  for (const p of sorted) {
    const cuts = new Set([p.start, p.end])
    const inside = distractions.filter((d) => d.end > p.start && d.start < p.end)
    for (const d of inside) {
      cuts.add(Math.max(p.start, d.start))
      cuts.add(Math.min(p.end, d.end))
    }
    const points = [...cuts].sort((a, b) => a - b)
    for (let i = 0; i < points.length - 1; i++) {
      const s = points[i]
      const e = points[i + 1]
      if (e <= s) continue
      const mid = (s + e) / 2
      const top = inside
        .filter((d) => d.start <= mid && d.end > mid)
        .sort((a, b) => RANK[KIND_OF[b.source]] - RANK[KIND_OF[a.source]])[0]
      const seg: LineSegment = top
        ? { kind: KIND_OF[top.source], start: s, end: e, partId: p.id, itemId: p.itemId, distractionId: top.id, confirmed: top.confirmed }
        : { kind: 'focus', start: s, end: e, partId: p.id, itemId: p.itemId, distractionId: null, confirmed: true }
      const last = out[out.length - 1]
      if (last && last.end === s && last.kind === seg.kind && last.partId === seg.partId && last.distractionId === seg.distractionId) last.end = e
      else out.push(seg)
    }
  }
  return out
}

/** Seconds of each kind on the line, for "focus, distracted, detected, no input". */
export function lineTotals(segments: LineSegment[]): Record<LineSegment['kind'], number> {
  const t = { focus: 0, distracted: 0, detected: 0, idle: 0 }
  for (const s of segments) t[s.kind] += (s.end - s.start) / 1000
  return t
}

/**
 * Tick marks for a line `widthPx` wide: a step of 1, 5, 10 or 15 minutes (or
 * more for long sessions) so labels about `labelPx` wide never overlap, and
 * none too close to the start and end labels.
 */
export function axisTicks(from: number, to: number, widthPx: number, labelPx = 80): number[] {
  const room = Math.max(1, Math.floor(widthPx / (labelPx * 1.25)))
  const minutes = Math.max(1 / 60, (to - from) / 60_000)
  const steps = [1, 5, 10, 15, 30, 60, 120, 240]
  const step = steps.find((m) => minutes / m <= room) ?? 480
  const stepMs = step * 60_000
  const edge = ((labelPx * 1.1) / Math.max(1, widthPx)) * (to - from)
  const offset = new Date(from).getTimezoneOffset() * 60_000
  const out: number[] = []
  for (let t = Math.ceil((from - offset) / stepMs) * stepMs + offset; t <= to; t += stepMs) {
    if (t - from >= edge && to - t >= edge) out.push(t)
  }
  return out
}
