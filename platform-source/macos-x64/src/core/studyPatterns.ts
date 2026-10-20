import { compareEvidence } from './evidence'
// Additional descriptive statistics. These describe recorded sessions, not causal effects.
import { countsAsLost } from './distractions'
import { DEFAULT_ANALYSIS, factorOf, outcomeOf, type AnalysisOptions } from './insights'
import { type FactorDef, type OutcomeKey, type StatSession, type StatsRaw } from './statsData'
import { addDays } from './studyDay'

const mean = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

export function consistency(sessions: StatSession[], today: string): { current: number; longest: number; days: number; last28: number } {
  const days = new Set(sessions.map((s) => s.day).filter((day) => day <= today))
  let longest = 0, run = 0, previous = ''
  for (const day of [...days].sort()) { run = previous && addDays(previous, 1) === day ? run + 1 : 1; longest = Math.max(longest, run); previous = day }
  let cursor = days.has(today) ? today : addDays(today, -1), current = 0
  while (days.has(cursor)) { current++; cursor = addDays(cursor, -1) }
  return { current, longest, days: days.size, last28: [...days].filter((day) => day >= addDays(today, -27)).length }
}

/** Wall-clock minutes, subtracting the union of lost distraction spans so overlaps never count twice. */
export function minuteContinuity(sessions: StatSession[]): { minute: number; share: number; n: number }[] {
  const rows: { minute: number; share: number; n: number }[] = []
  const longest = Math.min(180, Math.ceil(Math.max(0, ...sessions.map((s) => (s.end - s.start) / 60000))))
  for (let minute = 0; minute < longest; minute++) {
    let focused = 0, total = 0, n = 0
    for (const s of sessions) {
      const start = s.start + minute * 60000, end = Math.min(s.end, start + 60000)
      if (end <= start) continue
      const ranges=(s.wallRanges??[{start:s.start,end:s.end}]).map(r=>({start:Math.max(start,r.start),end:Math.min(end,r.end)})).filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start)
      const merged:{start:number;end:number}[]=[]
      for(const r of ranges){const last=merged.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else merged.push({...r})}
      if(!merged.length)continue
      n++
      for(const r of merged){total+=r.end-r.start
        const spans=s.distractions.filter(countsAsLost).map(d=>[Math.max(r.start,d.startedAt),Math.min(r.end,d.startedAt+Math.max(0,d.durationSeconds)*1000)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])
        let lost=0,lastEnd=r.start
        for(const [a,b] of spans){lost+=Math.max(0,b-Math.max(a,lastEnd));lastEnd=Math.max(lastEnd,b)}
        focused+=r.end-r.start-lost
      }
    }
    if (n) rows.push({ minute: minute + 1, share: focused / total, n })
  }
  return rows
}

export function weekWindows(sessions: StatSession[], options: AnalysisOptions = DEFAULT_ANALYSIS): { weekday: number; hour: number; n: number; mean: number | null }[] {
  return Array.from({ length: 168 }, (_, i) => {
    const weekday = Math.floor(i / 24), hour = i % 24
    const values = sessions.filter((s) => s.weekday === weekday && s.hour === hour).map((s) => outcomeOf(s, 'focus', options)).filter((v): v is number => v !== undefined)
    return { weekday, hour, n: values.length, mean: values.length >= 5 ? mean(values) : null }
  })
}

/** Progress per subject AND unit, including all parts of mixed sessions. Never add unlike units. */
export function progressSpeeds(raw: StatsRaw, sessionIds: Set<number>): { itemId: number; unit: string; amount: number; hours: number; rate: number; n: number }[] {
  const progress = raw.schema.fields.find((f) => f.key === 'progress')?.id
  const groups = new Map<string, { itemId: number; unit: string; amount: number; hours: number; ids: Set<number> }>()
  for (const block of raw.blocks) {
    if (!sessionIds.has(block.sessionId) || block.focusSeconds <= 0) continue
    const v = block.values.find((x) => x.fieldId === progress && x.touched)?.value as { amount?: number; unit?: string } | undefined
    if (!v || !Number.isFinite(v.amount) || v.amount! < 0 || !v.unit) continue
    const key = `${block.itemId}:${v.unit}`, g = groups.get(key) ?? { itemId: block.itemId, unit: v.unit, amount: 0, hours: 0, ids: new Set<number>() }
    g.amount += v.amount!
    if (!g.ids.has(block.sessionId)) g.hours += raw.blocks.filter((b) => b.sessionId === block.sessionId && b.itemId === block.itemId).reduce((sum, b) => sum + Math.max(0, b.focusSeconds), 0) / 3600
    g.ids.add(block.sessionId); groups.set(key, g)
  }
  return [...groups.values()].map((g) => ({ itemId: g.itemId, unit: g.unit, amount: g.amount, hours: g.hours, rate: g.amount / g.hours, n: g.ids.size }))
}

/** Consecutive sessions on the same subject, paired before any outcome exclusion. */
export function recallNext(sessions: StatSession[], options: AnalysisOptions = DEFAULT_ANALYSIS): { recall: number; understanding: number; n: number }[] {
  const previous = new Map<number, StatSession>(), groups = new Map<number, number[]>()
  for (const s of [...sessions].sort((a, b) => a.start - b.start || a.id - b.id)) {
    const before = previous.get(s.itemId)
    if (before) {
      const recall = outcomeOf(before, 'recall', options), understanding = outcomeOf(s, 'understanding', options)
      if (recall !== undefined && understanding !== undefined) groups.set(recall, [...(groups.get(recall) ?? []), understanding])
    }
    previous.set(s.itemId, s)
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([recall, values]) => ({ recall, understanding: mean(values)!, n: values.length }))
}

export function habitChange(sessions: StatSession[], key: string, option: string, date: string, outcome: OutcomeKey, options: AnalysisOptions = DEFAULT_ANALYSIS): { before: { n: number; mean: number | null; share: number | null }; after: { n: number; mean: number | null; share: number | null }; difference: number | null; evidence:ReturnType<typeof compareEvidence> } {
  const beforeSessions = sessions.filter((s) => s.itemIds?.length===1 && s.day >= addDays(date, -28) && s.day < date)
  const afterSessions = sessions.filter((s) => s.itemIds?.length===1 && s.day >= date && s.day <= addDays(date, 27))
  const compared=[...beforeSessions.map(s=>({...s,factors:{...s.factors,'habit-period':['before']}})),...afterSessions.map(s=>({...s,factors:{...s.factors,'habit-period':['after']}}))]
  const evidence=compareEvidence(compared,{key:'habit-period',label:'period',options:['before','after'],multi:false,group:'derived'},'after',outcome,options)
  const part = (xs: StatSession[]) => {
    const answered = xs.filter((s) => factorOf(s, key, options) !== undefined)
    const rated = xs.map((s) => outcomeOf(s, outcome, options)).filter((v): v is number => v !== undefined)
    return { n: rated.length, mean: mean(rated), share: answered.length ? answered.filter((s) => factorOf(s, key, options)!.includes(option)).length / answered.length : null }
  }
  const before = part(beforeSessions), after = part(afterSessions)
  return {before,after,evidence,difference:evidence.status==='insufficient'||options.includeUntouched?null:evidence.estimate}
}

export function factorFamily(f: FactorDef): string {
  if (f.group === 'setup') return 'Place and setup'
  if (f.group === 'day') return 'Body and sleep'
  if (/rest/i.test(f.key + ' ' + f.label)) return 'Rest'
  if (/stage|prior|new-field|builds/i.test(f.key)) return 'Learning stage'
  if (/time|weekday|position|length/i.test(f.key)) return 'Time of day'
  if (/method|activity/i.test(f.key + ' ' + f.label)) return 'Methods'
  if (/distract|phone/i.test(f.key + ' ' + f.label)) return 'Distractions'
  return 'Other questions'
}
