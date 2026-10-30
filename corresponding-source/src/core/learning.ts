// Learning stage and prior knowledge (round 4 section 3). A subject's stage
// comes from its hours: tracked focus plus the hours before A14 Pomodoro. Nothing
// here is stored; every session's stage is calculated from the data.

export type PriorKnowledge = 'new' | 'some' | 'before' | 'well'

export const PRIOR_KNOWLEDGE: { id: PriorKnowledge; label: string }[] = [
  { id: 'new', label: 'Completely new' },
  { id: 'some', label: 'Some exposure' },
  { id: 'before', label: 'Studied before' },
  { id: 'well', label: 'Know it well' }
]

export const priorLabel = (p: PriorKnowledge | null | undefined): string | null => PRIOR_KNOWLEDGE.find((x) => x.id === p)?.label ?? null

/** One stage boundary: the stage named `name` lasts until `untilHours`. The last stage has no end. */
export interface StageStep {
  untilHours: number | null
  name: string
}

export const DEFAULT_STAGES: StageStep[] = [
  { untilHours: 20, name: 'First 20 hours' },
  { untilHours: 50, name: '20 to 50 hours' },
  { untilHours: 100, name: '50 to 100 hours' },
  { untilHours: null, name: '100 hours and more' }
]

/** Sorted, with exactly one open-ended last stage. */
export function normalizeStages(stages: StageStep[]): StageStep[] {
  const bounded = stages
    .filter((s) => s.untilHours !== null && s.untilHours > 0)
    .sort((a, b) => a.untilHours! - b.untilHours!)
    .filter((s, i, a) => i === 0 || s.untilHours !== a[i - 1].untilHours)
  const last = stages.find((s) => s.untilHours === null) ?? { untilHours: null, name: `${bounded.at(-1)?.untilHours ?? 0} hours and more` }
  return [...bounded, last]
}

export interface Stage {
  index: number
  name: string
  /** Hours where this stage starts and ends (null: open-ended). */
  fromHours: number
  untilHours: number | null
  /** 0 to 1 toward the end of the stage (1 for the last stage). */
  progress: number
  /** The first stage (the "First 20 hours" badge). */
  first: boolean
}

export function stageFor(hours: number, stages: StageStep[] = DEFAULT_STAGES): Stage {
  const list = normalizeStages(stages)
  let from = 0
  for (let i = 0; i < list.length; i++) {
    const until = list[i].untilHours
    if (until === null || hours < until) {
      return {
        index: i,
        name: list[i].name,
        fromHours: from,
        untilHours: until,
        progress: until === null ? 1 : Math.max(0, Math.min(1, (hours - from) / (until - from))),
        first: i === 0
      }
    }
    from = until
  }
  // Unreachable: the last stage is open-ended.
  return { index: list.length - 1, name: list[list.length - 1].name, fromHours: from, untilHours: null, progress: 1, first: false }
}

/** "7 h 40" from hours. */
export function hoursLabel(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** "7 h 40 of your first 20 hours", or "54 h · 50 to 100 hours". */
export function stageLine(hours: number, stage: Stage): string {
  if (stage.first && stage.untilHours !== null) return `${hoursLabel(hours)} of your first ${stage.untilHours} hours`
  if (stage.untilHours !== null) return `${hoursLabel(hours)}, ${hoursLabel(stage.untilHours - hours)} to the next stage`
  return `${hoursLabel(hours)} in total`
}

export interface StageCrossing {
  itemId: number
  /** When the threshold was crossed (ms), inside the session that crossed it. */
  at: number
  /** The stage reached. */
  stage: string
  hours: number
}

/**
 * When each subject crossed a stage boundary. `parts` are focus spans (any
 * order); a crossing is placed at the moment within the span where the
 * running total passes the threshold (treating the span as evenly focused).
 * Hours before A14 Pomodoro count from the start, so a subject that starts past
 * a threshold never "crosses" it.
 */
export function stageCrossings(
  parts: { itemId: number; start: number; end: number; focusSeconds: number }[],
  hoursBefore: Map<number, number>,
  stages: StageStep[] = DEFAULT_STAGES
): StageCrossing[] {
  const list = normalizeStages(stages)
  const out: StageCrossing[] = []
  const byItem = new Map<number, typeof parts>()
  for (const p of parts) byItem.set(p.itemId, [...(byItem.get(p.itemId) ?? []), p])
  for (const [itemId, ps] of byItem) {
    let hours = hoursBefore.get(itemId) ?? 0
    for (const p of [...ps].sort((a, b) => a.start - b.start)) {
      const add = p.focusSeconds / 3600
      for (let i = 0; i < list.length - 1; i++) {
        const t = list[i].untilHours!
        if (hours < t && hours + add >= t) {
          const share = add > 0 ? (t - hours) / add : 1
          out.push({ itemId, at: Math.round(p.start + (p.end - p.start) * share), stage: list[i + 1].name, hours: t })
        }
      }
      hours += add
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

/**
 * Hours on a subject before a moment: earlier focus plus hours before A14 Pomodoro.
 * Used to give each session the stage its subject was in at the time.
 */
export function hoursBeforeMoment(parts: { itemId: number; start: number; focusSeconds: number }[], itemId: number, moment: number, hoursBefore = 0): number {
  return hoursBefore + parts.filter((p) => p.itemId === itemId && p.start < moment).reduce((s, p) => s + p.focusSeconds, 0) / 3600
}

/** Same strict-before semantics, indexed once for a complete Stats construction. */
export function indexedHoursBefore(parts:{itemId:number;start:number;focusSeconds:number}[]):(itemId:number,moment:number,prior?:number)=>number {
  const groups=new Map<number,typeof parts>()
  for(const p of parts){const rows=groups.get(p.itemId)??[];rows.push(p);groups.set(p.itemId,rows)}
  const index=new Map<number,{starts:number[];totals:number[]}>()
  for(const [id,rows] of groups){rows.sort((a,b)=>a.start-b.start);let total=0;const totals=[0];for(const r of rows){total+=r.focusSeconds;totals.push(total)}index.set(id,{starts:rows.map(r=>r.start),totals})}
  return (id,moment,prior=0)=>{const own=index.get(id);if(!own)return prior;let lo=0,hi=own.starts.length;while(lo<hi){const mid=(lo+hi)>>>1;if(own.starts[mid]<moment)lo=mid+1;else hi=mid}return prior+own.totals[lo]/3600}
}

/** A new subject is suggested as "new field" when nothing was studied in its category yet. */
export function suggestNewField(categoryFocusSeconds: number): boolean {
  return categoryFocusSeconds <= 0
}
