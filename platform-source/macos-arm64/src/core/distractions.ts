// Distractions: the reasons offered after "Back", where a distraction came
// from, and the numbers and quality label of a session.
import { mergeIntervals } from './timer'

/** A reason for a distraction. Stored by id in distractions.kind; the user can rename, reorder and archive them. */
export interface ReasonOption {
  id: string
  label: string
  archived?: boolean
}

/** "Other": chosen in the 4-second picker it is saved as is, and its text is asked in the review. */
export const OTHER_REASON = 'other'

/** The starting reasons. The user's list lives in settings (distractionReasons). */
export const DISTRACTION_REASONS: ReasonOption[] = [
  { id: 'phone', label: 'Phone' },
  { id: 'people', label: 'People' },
  { id: 'mind-wandering', label: 'Mind wandering' },
  { id: 'other-subject', label: 'Other subject' },
  { id: 'toilet-water', label: 'Toilet or water' },
  { id: 'food-drink', label: 'Food or drink' },
  { id: 'call-message', label: 'Call or message' },
  { id: 'tired', label: 'Tired' },
  { id: 'other', label: 'Other' }
]

/** Kinds that are not reasons the user picks. Older reasons keep their old names. */
const OTHER_KINDS: Record<string, string> = {
  'timer-pause': 'Timer pause',
  untagged: 'No reason yet',
  app: 'App',
  website: 'Website',
  away: 'Away',
  'tired-or-hungry': 'Tired or hungry'
}

export function reasonLabel(kind: string, reasons: ReasonOption[] = DISTRACTION_REASONS): string {
  return (
    reasons.find((r) => r.id === kind)?.label ??
    DISTRACTION_REASONS.find((r) => r.id === kind)?.label ??
    OTHER_KINDS[kind] ??
    kind.replace(/-/g, ' ')
  )
}

/**
 * The reasons to offer, most used first (ties keep the user's order), without
 * archived ones. "Other" always comes last, so it is easy to find.
 */
export function orderReasons(reasons: ReasonOption[], useCounts: Record<string, number>): ReasonOption[] {
  const active = reasons.filter((r) => !r.archived && r.id !== OTHER_REASON)
  const order = new Map(reasons.map((r, i) => [r.id, i]))
  const sorted = [...active].sort((a, b) => (useCounts[b.id] ?? 0) - (useCounts[a.id] ?? 0) || order.get(a.id)! - order.get(b.id)!)
  const other = reasons.find((r) => r.id === OTHER_REASON) ?? { id: OTHER_REASON, label: 'Other' }
  return [...sorted, other]
}

/**
 * The text typed for "Other" becomes a reason of its own. Returns the list with
 * it added (or an archived one with the same name restored) and its id.
 */
export function addReason(reasons: ReasonOption[], label: string): { reasons: ReasonOption[]; id: string } {
  const text = label.trim()
  const same = reasons.find((r) => r.label.toLowerCase() === text.toLowerCase())
  if (same) return { reasons: reasons.map((r) => (r.id === same.id ? { ...r, archived: false } : r)), id: same.id }
  const base =
    'r-' +
      text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/g, '') || 'r-reason'
  let id = base
  for (let n = 2; reasons.some((r) => r.id === id) || OTHER_KINDS[id]; n++) id = `${base}-${n}`
  // New reasons go before "Other".
  const at = reasons.findIndex((r) => r.id === OTHER_REASON)
  const next = [...reasons]
  next.splice(at < 0 ? next.length : at, 0, { id, label: text })
  return { reasons: next, id }
}

/**
 * Where a distraction came from. "manual" is the Distracted button (and its hotkey);
 * "pause" is the old name for the same thing, kept for rows from before
 * migration 8.
 */
export type DistractionSource = 'manual' | 'auto' | 'idle' | 'pause'

export const SOURCE_LABEL: Record<DistractionSource, string> = {
  manual: 'You pressed Distracted',
  pause: 'You pressed Distracted',
  auto: 'Detected app or site',
  idle: 'No input (possibly away)'
}

/** Quick's Pause is an observed timer action, not a claimed distraction cause. */
export const distractionSourceLabel=(d:{source:DistractionSource;kind:string}):string=>d.kind==='timer-pause'?'Timer pause':SOURCE_LABEL[d.source]

/** What the session numbers need to know about one distraction. */
export interface LostSpan {
  /** Wall-clock start, ms. */
  startedAt: number
  durationSeconds: number
  source: DistractionSource
  confirmed: boolean
}

/**
 * Whether a distraction counts as lost time. Distracted presses always do;
 * detected apps do unless dismissed (dismissing deletes them); idle gaps only
 * once confirmed as "away".
 */
export function countsAsLost(d: Pick<LostSpan, 'source' | 'confirmed'>): boolean {
  return d.source === 'idle' ? d.confirmed : true
}

export interface SessionStats {
  distractionCount: number
  distractedSeconds: number
  /** 0 to 1: distracted time as a share of the whole session (first start to last end). */
  lostShare: number
  /** The longest stretch inside the session without a distraction. */
  longestStretchSeconds: number
}

export const EMPTY_STATS: SessionStats = { distractionCount: 0, distractedSeconds: 0, lostShare: 0, longestStretchSeconds: 0 }

/**
 * The raw numbers of one session. Its span runs from the start of its first
 * part to the end of its last; overlapping distractions are counted once in
 * time but each one counts in the number.
 */
export function sessionStats(parts: { start: number; end: number }[], distractions: LostSpan[]): SessionStats {
  if (!parts.length) return EMPTY_STATS
  const from = Math.min(...parts.map((p) => p.start))
  const to = Math.max(...parts.map((p) => p.end))
  const span = Math.max(0, to - from)
  const lost = distractions.filter(countsAsLost)
  const merged = mergeIntervals(
    lost.map((d) => ({ start: Math.max(from, d.startedAt), end: Math.min(to, d.startedAt + d.durationSeconds * 1000) })),
    to
  )
  const lostMs = merged.reduce((s, iv) => s + (iv.end - iv.start), 0)
  let longest = 0
  let cursor = from
  for (const iv of merged) {
    longest = Math.max(longest, iv.start - cursor)
    cursor = Math.max(cursor, iv.end)
  }
  longest = Math.max(longest, to - cursor)
  return {
    distractionCount: lost.length,
    distractedSeconds: lostMs / 1000,
    lostShare: span > 0 ? lostMs / span : 0,
    longestStretchSeconds: longest / 1000
  }
}

export type Quality = 'clean' | 'some' | 'distracted'

export const QUALITY_LABEL: Record<Quality, string> = {
  clean: 'Clean',
  some: 'Some distraction',
  distracted: 'Distracted'
}

/** Thresholds for the quality label. Shares are percentages. */
export interface QualityThresholds {
  /** Clean: under this share of the session lost ... */
  cleanMaxShare: number
  /** ... and at most this many distractions. */
  cleanMaxCount: number
  /** Some distraction: under this share lost. Anything above is Distracted. */
  someMaxShare: number
}

export const DEFAULT_QUALITY: QualityThresholds = { cleanMaxShare: 5, cleanMaxCount: 1, someMaxShare: 15 }

export function qualityOf(s: SessionStats, t: QualityThresholds): Quality {
  const pct = s.lostShare * 100
  if (pct < t.cleanMaxShare && s.distractionCount <= t.cleanMaxCount) return 'clean'
  if (pct < t.someMaxShare) return 'some'
  return 'distracted'
}
