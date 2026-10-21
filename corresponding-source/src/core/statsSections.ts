// Numbers for each Stats section, from the per-session records. Charts and
// tables in the renderer read these; nothing here touches the database.
import type { Quality } from './distractions'
import { DEFAULT_ANALYSIS, groupBy, outcomeOf, type AnalysisOptions, type GroupRow } from './insights'
import { lengthBucket, positionLabel, timeOfDay, WEEKDAYS, type OutcomeKey, type StatSession } from './statsData'

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

// --- overview ---------------------------------------------------------------------

export interface OverviewNumbers {
  sessions: number
  focusSeconds: number
  activeDays: number
  averageSessionSeconds: number
  /** Averages over sessions that have them (untouched defaults left out unless included). */
  averageFocus: number
  averageRecall: number
  averageUnderstanding: number
  distractionsPerHour: number
  cleanShare: number
  goals: { set: number; done: number; partly: number; notDone: number }
  resisted: number
  stuck: number
}

export function overview(sessions: StatSession[], o: AnalysisOptions = DEFAULT_ANALYSIS): OverviewNumbers {
  const focusSeconds = sessions.reduce((s, x) => s + x.focusSeconds, 0)
  const avg = (k: OutcomeKey): number => mean(sessions.map((s) => outcomeOf(s, k, o)).filter((v): v is number => v !== undefined))
  const count = sessions.reduce((n, s) => n + s.distractions.filter((d) => d.source !== 'idle' || d.confirmed).length, 0)
  return {
    sessions: sessions.length,
    focusSeconds,
    activeDays: new Set(sessions.map((s) => s.day)).size,
    averageSessionSeconds: sessions.length ? focusSeconds / sessions.length : 0,
    averageFocus: avg('focus'),
    averageRecall: avg('recall'),
    averageUnderstanding: avg('understanding'),
    distractionsPerHour: focusSeconds > 0 ? count / (focusSeconds / 3600) : 0,
    cleanShare: sessions.length ? sessions.filter((s) => s.quality === 'clean').length / sessions.length : 0,
    goals: {
      set: sessions.filter((s) => s.hasGoal).length,
      done: sessions.filter((s) => s.goalResult === 'done').length,
      partly: sessions.filter((s) => s.goalResult === 'partly').length,
      notDone: sessions.filter((s) => s.goalResult === 'not-done').length
    },
    resisted: sessions.reduce((n, s) => n + s.resisted, 0),
    stuck: sessions.reduce((n, s) => n + s.stuck, 0),

  }
}

/** Monday-or-Saturday-start week key ("YYYY-MM-DD" of the week's first day) for a study day. */
export function weekOf(day: string, weekStartsOn: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const back = (date.getDay() - weekStartsOn + 7) % 7
  date.setDate(date.getDate() - back)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface WeekPoint {
  week: string
  hours: number
  sessions: number
  averageFocus: number
  clean: number
  some: number
  distracted: number
}

/** Focused hours, sessions, average focus and quality shares per week, oldest first, gaps filled. */
export function weekly(sessions: StatSession[], weekStartsOn: number, o: AnalysisOptions = DEFAULT_ANALYSIS): WeekPoint[] {
  if (!sessions.length) return []
  const by = new Map<string, StatSession[]>()
  for (const s of sessions) {
    const w = weekOf(s.day, weekStartsOn)
    by.set(w, [...(by.get(w) ?? []), s])
  }
  const weeks = [...by.keys()].sort()
  const out: WeekPoint[] = []
  const [y, m, d] = weeks[0].split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  const last = weeks[weeks.length - 1]
  for (let i = 0; i < 520; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const ss = by.get(key) ?? []
    const q = (x: Quality): number => (ss.length ? ss.filter((s) => s.quality === x).length / ss.length : 0)
    out.push({
      week: key,
      hours: ss.reduce((n, s) => n + s.focusSeconds, 0) / 3600,
      sessions: ss.length,
      averageFocus: mean(ss.map((s) => outcomeOf(s, 'focus', o)).filter((v): v is number => v !== undefined)),
      clean: q('clean'),
      some: q('some'),
      distracted: q('distracted')
    })
    if (key >= last) break
    cursor.setDate(cursor.getDate() + 7)
  }
  return out
}

// --- subjects ---------------------------------------------------------------------

export interface SubjectRow {
  usable: {focus:number;recall:number;understanding:number;difficulty:number}
  id: number
  sessions: number
  focusSeconds: number
  focus: number
  difficulty: number
  understanding: number
  recall: number
  distractionsPerHour: number
}

function subjectRow(id: number, ss: StatSession[], o: AnalysisOptions): SubjectRow {
  const avg = (k: OutcomeKey): number => mean(ss.map((s) => outcomeOf(s, k, o)).filter((v): v is number => v !== undefined))
  const focusSeconds = ss.reduce((n, s) => n + s.focusSeconds, 0)
  const count = ss.reduce((n, s) => n + s.distractions.filter((d) => d.source !== 'idle' || d.confirmed).length, 0)
  return {
    id,
    usable:{focus:ss.filter(s=>outcomeOf(s,'focus',o)!==undefined).length,recall:ss.filter(s=>outcomeOf(s,'recall',o)!==undefined).length,understanding:ss.filter(s=>outcomeOf(s,'understanding',o)!==undefined).length,difficulty:ss.filter(s=>s.difficulty!==null && (o.includeUntouched||s.difficultyTouched)).length},
    sessions: ss.length,
    focusSeconds,
    focus: avg('focus'),
    difficulty: mean(ss.filter((s) => s.difficulty !== null && (o.includeUntouched || s.difficultyTouched)).map((s) => s.difficulty!)),
    understanding: avg('understanding'),
    recall: avg('recall'),
    distractionsPerHour: focusSeconds > 0 ? count / (focusSeconds / 3600) : 0
  }
}

/** Per subject (the session's main subject) or per category, most time first. */
export function subjectRows(sessions: StatSession[], by: 'item' | 'category', o: AnalysisOptions = DEFAULT_ANALYSIS, scope:{itemId?:number|null;categoryId?:number|null}={}): SubjectRow[] {
  const groups = new Map<number, StatSession[]>()
  for (const s of sessions) {
    const parts=s.subjectParts??[{itemId:s.itemId,categoryId:s.categoryId,topCategoryId:s.topCategoryId,focusSeconds:s.focusSeconds}]
    const totals=new Map<number,number>()
    for(const part of parts){
      if(scope.itemId!=null&&part.itemId!==scope.itemId || scope.categoryId!=null&&part.categoryId!==scope.categoryId&&part.topCategoryId!==scope.categoryId)continue
      const id=by==='item'?part.itemId:part.topCategoryId
      totals.set(id,(totals.get(id)??0)+part.focusSeconds)
    }
    for(const [id,focusSeconds] of totals){
      const included=new Set(parts.filter(p=>(by==='item'?p.itemId:p.topCategoryId)===id&&(scope.itemId==null||p.itemId===scope.itemId)&&(scope.categoryId==null||p.categoryId===scope.categoryId||p.topCategoryId===scope.categoryId)).map(p=>p.itemId))
      const scoped={...s,focusSeconds,distractions:s.distractions.filter(d=>included.has(d.itemId)),...(s.itemIds.length>1?{outcomes:{},answeredOutcomes:{},difficulty:null,difficultyTouched:false}:{})}
      groups.set(id,[...(groups.get(id)??[]),scoped])
    }
  }
  return [...groups].map(([id, ss]) => subjectRow(id, ss, o)).sort((a, b) => b.focusSeconds - a.focusSeconds)
}

export interface SubjectHighlights {
  bestFocus: SubjectRow | null
  worstFocus: SubjectRow | null
  hardest: SubjectRow | null
  weakestRecall: SubjectRow | null
}

/** Which subjects stand out (only subjects with at least 5 sessions). */
export function subjectHighlights(rows: SubjectRow[]): SubjectHighlights {
  const by = (k: keyof SubjectRow['usable'], dir: 1 | -1): SubjectRow | null =>
    rows.filter((r) => r.usable[k]>=5 && Number.isFinite(r[k])).sort((a, b) => dir * (b[k] - a[k]))[0] ?? null
  return { bestFocus: by('focus', 1), worstFocus: by('focus', -1), hardest: by('difficulty', 1), weakestRecall: by('recall', -1) }
}

// --- time patterns ----------------------------------------------------------------

export function timePatterns(sessions: StatSession[], k: OutcomeKey, o: AnalysisOptions = DEFAULT_ANALYSIS): Record<'timeOfDay' | 'weekday' | 'position' | 'length' | 'dayPosition', GroupRow[]> {
  return {
    timeOfDay: groupBy(sessions, (s) => timeOfDay(s.hour), k, o, ['Early morning (before 9)', 'Morning (9 to 12)', 'Afternoon (12 to 17)', 'Evening (17 to 21)', 'Night (21 and later)']),
    weekday: groupBy(sessions, (s) => WEEKDAYS[s.weekday], k, o, WEEKDAYS),
    position: groupBy(sessions, (s) => positionLabel(s.positionInSitting), k, o, ['1st', '2nd', '3rd', '4th or later']),
    length: groupBy(sessions, (s) => lengthBucket(s.focusSeconds / 60), k, o, ['under 15 min', '15 to 30 min', '30 to 45 min', '45 to 60 min', '60 min and more']),
    dayPosition: groupBy(sessions, (s) => (s.positionInDay >= 6 ? '6th or later' : ['1st', '2nd', '3rd', '4th', '5th'][s.positionInDay - 1]), k, o, [
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
      '6th or later'
    ])
  }
}

// --- distractions -----------------------------------------------------------------

export interface CountRow {
  key: string
  count: number
  seconds: number
}

const tally = (rows: { key: string; seconds: number }[]): CountRow[] => {
  const m = new Map<string, CountRow>()
  for (const r of rows) {
    const x = m.get(r.key) ?? { key: r.key, count: 0, seconds: 0 }
    x.count++
    x.seconds += r.seconds
    m.set(r.key, x)
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.seconds - a.seconds)
}

export interface DistractionNumbers {
  byReason: CountRow[]
  byApp: CountRow[]
  bySource: CountRow[]
  /** Distractions starting in each 5-minute slice of focus (0 = first 5 minutes). */
  byMinute: { slice: number; count: number; sessions: number; exposureHours:number; eventsPerHour:number }[]
  /** Per subject and per activity: distractions per focused hour. */
  perSubject: { id: number; perHour: number; sessions: number }[]
  perActivity: { activity: string; perHour: number; sessions: number }[]
  /** Time in front per program or site during focus, all sessions. */
  appTime: { key: string; seconds: number }[]
  windowSwitchesPer10Min: number
}

/** Distraction numbers. Unconfirmed idle gaps are left out (they are not counted as lost). */
export function distractionNumbers(sessions: StatSession[], reasonLabel: (kind: string) => string): DistractionNumbers {
  const all = sessions.flatMap((s) => s.distractions.filter((d) => d.source !== 'idle' || d.confirmed).map((d) => ({ s, d })))
  const human = all.filter((x) => x.d.source === 'manual' || x.d.source === 'pause')
  const slices = new Map<number, number>()
  for (const { s, d } of all) {
    if(!Number.isFinite(d.offsetSeconds)||d.offsetSeconds<0||d.offsetSeconds>=s.focusSeconds)continue
    const slice = Math.floor(d.offsetSeconds / 300)
    slices.set(slice, (slices.get(slice) ?? 0) + 1)
  }
  const maxSlice=Math.min(23,Math.ceil(Math.max(0,...sessions.map(s=>Number.isFinite(s.focusSeconds)?s.focusSeconds:0))/300)-1)
  const byMinute=Array.from({length:maxSlice+1},(_,slice)=>{const contributing=sessions.filter(s=>s.focusSeconds>slice*300),exposureHours=contributing.reduce((n,s)=>n+Math.min(300,s.focusSeconds-slice*300),0)/3600,count=slices.get(slice)??0;return {slice,count,sessions:contributing.length,exposureHours,eventsPerHour:exposureHours?count/exposureHours:0}})
  const rate = (ss: StatSession[]): number => {
    const h = ss.reduce((n, s) => n + s.focusSeconds, 0) / 3600
    const c = ss.reduce((n, s) => n + s.distractions.filter((d) => d.source !== 'idle' || d.confirmed).length, 0)
    return h > 0 ? c / h : 0
  }
  const byItem = new Map<number, StatSession[]>()
  const byAct = new Map<string, StatSession[]>()
  for (const s of sessions) {
    byItem.set(s.itemId, [...(byItem.get(s.itemId) ?? []), s])
    if (s.activity) byAct.set(s.activity, [...(byAct.get(s.activity) ?? []), s])
  }
  const appTime = new Map<string, number>()
  for (const s of sessions) for (const [k, v] of Object.entries(s.appSeconds)) appTime.set(k, (appTime.get(k) ?? 0) + v)
  const focus10 = sessions.reduce((n, s) => n + s.focusSeconds, 0) / 600
  return {
    byReason: tally(human.map((x) => ({ key: reasonLabel(x.d.kind), seconds: x.d.durationSeconds }))),
    byApp: tally(all.filter((x) => x.d.source === 'auto' && x.d.label).map((x) => ({ key: x.d.label!, seconds: x.d.durationSeconds }))),
    bySource: tally(all.map((x) => ({ key: x.d.source === 'pause' ? 'manual' : x.d.source, seconds: x.d.durationSeconds }))),
    byMinute,
    perSubject: [...byItem].map(([id, ss]) => ({ id, perHour: rate(ss), sessions: ss.length })).sort((a, b) => b.perHour - a.perHour),
    perActivity: [...byAct].map(([activity, ss]) => ({ activity, perHour: rate(ss), sessions: ss.length })).sort((a, b) => b.perHour - a.perHour),
    appTime: [...appTime].map(([key, seconds]) => ({ key, seconds })).sort((a, b) => b.seconds - a.seconds),
    windowSwitchesPer10Min: focus10 > 0 ? sessions.reduce((n, s) => n + s.windowSwitches, 0) / focus10 : 0
  }
}

// --- rest -------------------------------------------------------------------------

/** The rest before a session against that session's outcome. */
export function restNumbers(sessions: StatSession[], k: OutcomeKey, o: AnalysisOptions = DEFAULT_ANALYSIS): Record<'activity' | 'length' | 'taken' | 'screen', GroupRow[]> {
  const after = sessions.filter((s) => s.restBefore)
  const len = (sec: number | null): string | null => {
    if (sec === null) return null
    const m = sec / 60
    return m < 5 ? 'under 5 min' : m < 10 ? '5 to 10 min' : m < 15 ? '10 to 15 min' : '15 min and more'
  }
  return {
    activity: groupBy(after.filter((s) => !s.restBefore!.skipped), (s) => s.restBefore!.activity ?? 'Not noted', k, o),
    length: groupBy(after.filter((s) => !s.restBefore!.skipped), (s) => len(s.restBefore!.actualSeconds), k, o, ['under 5 min', '5 to 10 min', '10 to 15 min', '15 min and more']),
    taken: groupBy(after, (s) => (s.restBefore!.skipped ? 'Rest skipped' : 'Rest taken'), k, o, ['Rest taken', 'Rest skipped']),
    screen: groupBy(after.filter((s) => !s.restBefore!.skipped), (s) => (s.restBefore!.screen ? 'Screens during the rest' : 'No screens'), k, o, ['No screens', 'Screens during the rest'])
  }
}

// --- methods, learning stage, timer modes -------------------------------------------

export function modeNumbers(sessions: StatSession[], k: OutcomeKey, o: AnalysisOptions = DEFAULT_ANALYSIS): { rows: GroupRow[]; overTarget: { mode: string; share: number; n: number }[] } {
  const label = { flow: 'Flow', fixed: 'Fixed', adaptive: 'Adaptive' } as const
  const rows = groupBy(sessions, (s) => label[s.timerMode], k, o, ['Flow', 'Fixed', 'Adaptive'])
  const overTarget = (['flow', 'fixed', 'adaptive'] as const)
    .map((m) => {
      const ss = sessions.filter((s) => s.timerMode === m)
      return { mode: label[m], share: ss.length ? ss.filter((s) => s.overTarget).length / ss.length : 0, n: ss.length }
    })
    .filter((x) => x.n > 0)
  return { rows, overTarget }
}

export function stageNumbers(sessions: StatSession[], stageNames: string[], k: OutcomeKey, o: AnalysisOptions = DEFAULT_ANALYSIS): Record<'stage' | 'prior' | 'newField' | 'buildsOn', GroupRow[]> {
  const prior = { new: 'Completely new', some: 'Some exposure', before: 'Studied before', well: 'Know it well' } as const
  return {
    stage: groupBy(sessions, (s) => s.stage, k, o, stageNames),
    prior: groupBy(sessions, (s) => (s.priorKnowledge ? prior[s.priorKnowledge] : null), k, o, Object.values(prior)),
    newField: groupBy(sessions, (s) => (s.newField === null ? null : s.newField ? 'New field for me' : 'A field I knew'), k, o, ['New field for me', 'A field I knew']),
    buildsOn: groupBy(sessions, (s) => (s.buildsOn ? 'Builds on another subject' : 'Stands alone'), k, o, ['Builds on another subject', 'Stands alone'])
  }
}

/** The difficulty answer as an outcome-like average per group (it is a slider, so the untouched rule applies). */
export function difficultyBy(sessions: StatSession[], keyOf: (s: StatSession) => string | null, o: AnalysisOptions = DEFAULT_ANALYSIS, order?: string[]): GroupRow[] {
  const groups = new Map<string, StatSession[]>()
  for (const s of sessions) {
    const key = keyOf(s)
    if (key !== null) groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const rows = [...groups].map(([key, ss]) => {
    const vals = ss.filter((s) => s.difficulty !== null && (o.includeUntouched || s.difficultyTouched)).map((s) => s.difficulty!)
    return { key, n: ss.length, mean: mean(vals), nOutcome: vals.length }
  })
  return order ? rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : rows.sort((a, b) => b.n - a.n)
}
