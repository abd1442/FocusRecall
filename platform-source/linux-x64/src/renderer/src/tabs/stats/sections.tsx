import { useFactorRanking } from './useFactorRanking'
import { AnalysisAnnouncement, AnalysisStatus } from './AnalysisStatus'
import { TRACKING_COVERAGE_NOTE } from '@core/trackingConsent'
import { isStudyMethodFactor, METHOD_OBSERVATION_NOTE } from '@core/recommendations'
import { evidenceCopy } from '@core/evidenceCopy'
import { DEFAULT_REST_SUGGESTIONS } from '@core/rest'
import { factorName, factorOption } from '../../statsCopy'
import { formatDuration , formatDate , count , countEvidence } from '../../i18n'
import { t as uiText , currentLanguage } from '../../i18n'
// The Stats sections (round 4 section 4, round 5 section 8). Each reads the
// filtered per-session records and the analysis options from StatsContext.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RestoredOutcomeContext } from './RestoredOutcomeContext'
import { InsightContext } from './InsightContext'
import { compareFactor, MIN_SESSIONS, type AnalysisOptions, type Comparison } from '@core/insights'
import { PRIOR_KNOWLEDGE } from '@core/learning'
import { normalizeStages, type StageStep } from '@core/learning'
import { outcomeDef, type FactorDef, type OutcomeKey, type StatSession } from '@core/statsData'
import {
  difficultyBy,
  distractionNumbers,
  modeNumbers,
  overview,
  restNumbers,
  stageNumbers,
  subjectHighlights,
  subjectRows,
  timePatterns,
  weekly,
  type SubjectRow
} from '@core/statsSections'

import type { BlockSummary } from '@core/stats'
import { HeatMap } from '../../components/HeatMap'
import { factorFamily } from '@core/studyPatterns'
import { timeOrDash } from '../../components/overview'
import { Segmented } from '../../components/ui'
import { AXIS, ComparisonRow, GroupBars, Kpi, OutcomePicker, Panel, StatsSection, StrengthBadge, TOOLTIP, better, formatOutcome } from './parts'

export interface StatsContextValue {
  subjectFilter?:{itemId:number|null;categoryId:number|null}
  sessions: StatSession[]
  factors: FactorDef[]
  options: AnalysisOptions
  stages: StageStep[]
  weekStartsOn: number
  blocks: BlockSummary[]
  itemName: (id: number) => string
  itemColor: (id: number) => string
  categoryName: (id: number) => string
  categoryColor: (id: number) => string
  activityLabel: (id: string) => string
  reasonLabel: (kind: string) => string
  /** Progress toward a subject's total, if it has one. */
  progressOf: (itemId: number) => { done: number; total: number; unit: string } | null
}

export const StatsContext = createContext<StatsContextValue>(null as unknown as StatsContextValue)
const useStats = (): StatsContextValue => useContext(StatsContext)

const n1 = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : '–')
const pct = (x: number): string => `${Math.round(x * 100)} %`
const weekLabel = (w: string): string => formatDate(new Date(w + 'T12:00:00'), { day: 'numeric', month: 'short' })

/** Restoring a saved view restores all section outcome pickers together. */
export function useComparisonOutcome(initial:OutcomeKey, section?:string):[OutcomeKey,(o:OutcomeKey)=>void] {
  const restored=useContext(RestoredOutcomeContext)
  const [value,setValue]=useState(restored?.outcome??initial)
  useEffect(()=>{if(restored)setValue(restored.outcome)},[restored])
  const insight=useContext(InsightContext), previous=useRef<OutcomeKey|null>(null)
  useEffect(()=>{if(insight&&insight.section===section&&insight.outcome){previous.current??=value;setValue(insight.outcome)}else if(previous.current!==null){setValue(previous.current);previous.current=null}},[insight,section])
  useEffect(()=>{const apply=(e:Event):void=>setValue((e as CustomEvent<OutcomeKey>).detail);window.addEventListener('tf-comparison-outcome',apply);return()=>window.removeEventListener('tf-comparison-outcome',apply)},[])
  return [value,setValue]
}

// --- 1. Overview ---------------------------------------------------------------

export function OverviewSection(): React.JSX.Element {
  const { sessions, options, weekStartsOn, blocks } = useStats()
  const o = useMemo(() => overview(sessions, options), [sessions, options])
  const weeks = useMemo(() => weekly(sessions, weekStartsOn, options).map((w) => ({ ...w, label: weekLabel(w.week), hours: Math.round(w.hours * 10) / 10 })), [sessions, weekStartsOn, options])
  const goalTotal = o.goals.done + o.goals.partly + o.goals.notDone
  return (
    <StatsSection id="overview" title={uiText("Overview")} lead="Totals and averages for the sessions in view, the year at a glance, and focused time week by week." note={false}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi value={timeOrDash(o.focusSeconds)} label={uiText("Focused time")} sub={count(o.sessions,'session')+' · '+count(o.activeDays,'day')} />
        <Kpi value={timeOrDash(o.averageSessionSeconds)} label={uiText("Average session")} />
        <Kpi value={formatOutcome('focus', o.averageFocus)} label={uiText("Average focus")} />
        <Kpi value={formatOutcome('recall', o.averageRecall)} label={uiText("Average recall")} />
        <Kpi value={n1(o.distractionsPerHour)} label={uiText("Distractions per focused hour")} />
        <Kpi value={pct(o.cleanShare)} label={uiText("Clean sessions")} />
      </div>
      <HeatMap blocks={blocks} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel title={uiText("Focused time per week")} hint={uiText("Bars: hours. Line: average focus (right axis).")}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--tf-border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" {...AXIS} minTickGap={16} />
                <YAxis yAxisId="h" {...AXIS} unit={uiText(' h')} />
                <YAxis yAxisId="f" orientation="right" domain={[1, 5]} {...AXIS} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, name) => (name === 'hours' ? [String(v)+' '+uiText('h'), uiText('Focused')] : [n1(Number(v)), uiText('Average focus')])}
                  labelFormatter={(l) => uiText('Week of {date}',{date:formatDate(String(l))})}
                />
                <Bar yAxisId="h" dataKey="hours" fill="color-mix(in srgb, var(--fr-stage-focus) 70%, transparent)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="f" dataKey="averageFocus" stroke="var(--fr-stage-rest)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={uiText("Goals and captures")}>
          {o.goals.set ? (
            <div className="flex flex-col gap-3">
              <p className="text-base text-muted">{uiText("A goal was set in ")}{o.goals.set}{uiText(" of ")}{count(o.sessions, 'session')}.</p>
              <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" aria-label={uiText("Goal results")}>
                {goalTotal > 0 && (
                  <>
                    <div className="bg-rest" style={{ width: `${(o.goals.done / goalTotal) * 100}%` }} />
                    <div className="bg-[var(--tf-line-distracted)]" style={{ width: `${(o.goals.partly / goalTotal) * 100}%` }} />
                    <div className="bg-[var(--tf-line-detected)]" style={{ width: `${(o.goals.notDone / goalTotal) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-base">
                <span>
                  <span className="mr-2 inline-block size-2.5 rounded-full bg-rest" />{uiText("Done ")}{o.goals.done}
                </span>
                <span>
                  <span className="mr-2 inline-block size-2.5 rounded-full bg-[var(--tf-line-distracted)]" />{uiText("Partly ")}{o.goals.partly}
                </span>
                <span>
                  <span className="mr-2 inline-block size-2.5 rounded-full bg-[var(--tf-line-detected)]" />{uiText("Not done ")}{o.goals.notDone}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-base text-muted">{uiText("No session goals in this period.")}</p>
          )}
          <div className="mt-2 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{o.resisted}</div>
              <div className="text-sm text-muted">{uiText("Resisted")}</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{o.stuck}</div>
              <div className="text-sm text-muted">{uiText("Stuck markers")}</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{o.parked}</div>
              <div className="text-sm text-muted">{uiText("Parked thoughts")}</div>
            </div>
          </div>
        </Panel>
      </div>
    </StatsSection>
  )
}

// --- 2. Subjects ---------------------------------------------------------------

export function SubjectsSection(): React.JSX.Element {
  const { sessions, options, subjectFilter, itemName, itemColor, categoryName, categoryColor, progressOf } = useStats()
  const [by, setBy] = useState<'item' | 'category'>('item')
  const rows = useMemo(() => subjectRows(sessions, by, options, subjectFilter), [sessions, by, options, subjectFilter])
  const items = useMemo(() => subjectRows(sessions, 'item', options, subjectFilter), [sessions, options, subjectFilter])
  const h = subjectHighlights(items)
  const name = (r: SubjectRow): string => (by === 'item' ? itemName(r.id) : categoryName(r.id))
  const color = (r: SubjectRow): string => (by === 'item' ? itemColor(r.id) : categoryColor(r.id))
  // Plain numbers in the table; the header says what they are out of.
  const cell = (v: number, n: number): string => (n < MIN_SESSIONS || !Number.isFinite(v) ? '–' : v.toFixed(1))
  const callouts: { label: string; row: SubjectRow | null; outcome:keyof SubjectRow['usable']; text: (r: SubjectRow) => string }[] = [
    { label: 'Highest reported focus', row: h.bestFocus,outcome:'focus', text: (r) => formatOutcome('focus', r.focus) },
    { label: 'Lowest reported focus', row: h.worstFocus,outcome:'focus', text: (r) => formatOutcome('focus', r.focus) },
    { label: 'Highest reported difficulty', row: h.hardest,outcome:'difficulty', text: (r) => `${r.difficulty.toFixed(1)} of 10` },
    { label: 'Lowest reported recall', row: h.weakestRecall,outcome:'recall', text: (r) => formatOutcome('recall', r.recall) }
  ]
  return (
    <StatsSection
      id="subjects"
      title={uiText("Subjects")}
      lead="Time, focus, difficulty, understanding and recall per subject or category, and which ones stand out."
      action={<Segmented<'item' | 'category'> value={by} onChange={setBy} options={[{ value: 'item', label: 'Subjects' }, { value: 'category', label: 'Categories' }]} />}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
        {callouts.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-surface px-5 py-4">
            <div className="text-sm text-muted">{c.label}</div>
            {c.row ? (
              <>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold" dir="auto">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: itemColor(c.row.id) }} />
                  <span className="truncate">{itemName(c.row.id)}</span>
                </div>
                <div className="text-base text-muted tabular-nums">
                  {c.text(c.row)} · {count(c.row.usable[c.outcome], 'usableAnswer')}</div>
              </>
            ) : (
              <div className="mt-1 text-base text-muted">{uiText("Needs 5 usable answers on a subject")}</div>
            )}
          </div>
        ))}
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-base">
            <thead className="text-sm text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-4 font-medium">{by === 'item' ? uiText("Subject") : uiText("Category")}</th>
                <th className="py-2 pr-4 font-medium">{uiText("Time")}</th>
                <th className="py-2 pr-4 font-medium">{uiText("Sessions")}</th>
                <th className="py-2 pr-4 font-medium">{uiText("Focus ")}<span className="font-normal">/5</span>
                </th>
                <th className="py-2 pr-4 font-medium">{uiText("Difficulty ")}<span className="font-normal">/10</span>
                </th>
                <th className="py-2 pr-4 font-medium">{uiText("Understanding ")}<span className="font-normal">/4</span>
                </th>
                <th className="py-2 pr-4 font-medium">{uiText("Recall ")}<span className="font-normal">/5</span>
                </th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{uiText("Distractions per hour")}</th>
                {by === 'item' && <th className="py-2 font-medium">{uiText("Progress")}</th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => {
                const p = by === 'item' ? progressOf(r.id) : null
                return (
                  <tr key={r.id} className="border-b border-line/60 whitespace-nowrap last:border-0">
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2.5" dir="auto">
                        <span className="size-3 shrink-0 rounded-full" style={{ background: color(r) }} />
                        <span className="max-w-64 truncate font-medium whitespace-normal">{name(r)}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4">{timeOrDash(r.focusSeconds)}</td>
                    <td className="py-3 pr-4">{r.sessions}</td>
                    <td className="py-3 pr-4">{cell(r.focus, r.usable.focus)} <span className="text-xs text-muted">{uiText("n=")}{r.usable.focus}</span></td>
                    <td className="py-3 pr-4">{cell(r.difficulty, r.usable.difficulty)} <span className="text-xs text-muted">{uiText("n=")}{r.usable.difficulty}</span></td>
                    <td className="py-3 pr-4">{cell(r.understanding, r.usable.understanding)} <span className="text-xs text-muted">{uiText("n=")}{r.usable.understanding}</span></td>
                    <td className="py-3 pr-4">{cell(r.recall, r.usable.recall)} <span className="text-xs text-muted">{uiText("n=")}{r.usable.recall}</span></td>
                    <td className="py-3 pr-4">{r.sessions >= MIN_SESSIONS ? n1(r.distractionsPerHour) : '–'}</td>
                    {by === 'item' && (
                      <td className="py-3">
                        {p ? (
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-20 overflow-hidden rounded-full bg-surface-2">
                              <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (p.done / p.total) * 100)}%`, background: itemColor(r.id) }} />
                            </span>
                            <span className="text-sm text-muted">
                              {Math.round(p.done)}{uiText(" of ")}{p.total} {p.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">{uiText("Averages need at least 5 sessions; a dash means not enough yet.")}</p>
      </Panel>
    </StatsSection>
  )
}

// --- 3. What affects my study ---------------------------------------------------

const GROUP_LABEL: Record<FactorDef['group'], string> = {
  session: 'Session questions',
  setup: 'Place and setup',
  day: 'Body and sleep',
  detail: 'Methods and other questions',
  derived: 'Time, rest and learning stage'
}

export function FactorsSection(): React.JSX.Element {
  const { sessions, factors, options } = useStats()
  const [outcome, setOutcome] = useComparisonOutcome('focus', 'factors')
  const [family, setFamily] = useState('All')
  const filteredFactors = useMemo(()=>factors.filter((f) => family === 'All' || factorFamily(f) === family),[factors,family])
  const ranking=useFactorRanking(sessions,filteredFactors,outcome,options,factors)
  const ranked=ranking.result??{positive:[],negative:[]}
  const [factorKey, setFactorKey] = useState<string>(() => factors.find((f) => f.group === 'setup')?.key ?? factors[0]?.key ?? '')
  const insight=useContext(InsightContext),previousQuestion=useRef<{family:string;key:string}|null>(null)
  useEffect(()=>{if(insight?.section==='factors'&&factors.some(f=>f.key===insight.factorKey)){previousQuestion.current??={family,key:factorKey};setFactorKey(insight.factorKey);setFamily('All')}else if(previousQuestion.current){setFamily(previousQuestion.current.family);setFactorKey(previousQuestion.current.key);previousQuestion.current=null}},[insight,factors])
  const factor = factors.find((f) => f.key === factorKey) ?? factors[0]
  const comps = useMemo(() => (factor ? compareFactor(sessions, factor, outcome, options) : []), [sessions, factor, outcome, options])
  const shownComps = comps.filter((c) => c.strength !== null)
  const hidden = comps.filter((c) => c.strength === null)
  const groups = [...new Set(factors.map((f) => f.group))]
  const word = currentLanguage()==='en'?outcomeDef(outcome).label.toLowerCase():uiText(outcomeDef(outcome).label)
  return (
    <StatsSection
      id="factors"
      title={uiText("Recorded comparisons")}
      lead="Matched comparisons share one context-day method. Activity charts are descriptive summaries. Associations do not establish cause."
      action={<OutcomePicker value={outcome} onChange={setOutcome} />}
    >
      <div className="flex flex-wrap gap-2" aria-label={uiText("Finding families")}>{['All', ...new Set(factors.map(factorFamily))].map((name) => <button key={name} type="button" aria-pressed={family === name} onClick={() => setFamily(name)} className={`rounded-full border px-4 py-2 text-sm ${family === name ? 'border-rest bg-rest/15 text-rest' : 'border-line bg-surface text-muted'}`}>{uiText(name)}</button>)}</div>
      {(factor&&isStudyMethodFactor(factor)||[...ranked.positive,...ranked.negative].some(c=>isStudyMethodFactor(c.factor)))&&<p className="text-sm text-muted">{uiText(METHOD_OBSERVATION_NOTE)}</p>}
      <Panel title={uiText("Look at one question")} hint={uiText("Pick any question; fields you add later appear here by themselves.")}>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label={uiText("Question")}
            className="min-h-11 min-w-72 rounded-lg border border-line bg-surface-2/60 px-3 text-base text-ink outline-none focus:border-focus"
            value={factor?.key}
            onChange={(e) => setFactorKey(e.target.value)}
          >
            {groups.map((g) => (
              <optgroup key={g} label={uiText(GROUP_LABEL[g])}>
                {factors
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {factorName(f)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        {shownComps.length ? (
          <div className="flex flex-col gap-2.5">
            {shownComps.map((c) => (
              <OptionBar key={factorOption(c.factor,c.option)} c={c} highlighted={insight?.factorKey===factor?.key&&insight.rows[0]?.label===c.option} />
            ))}
          </div>
        ) : (
          <p className="text-base text-muted">{uiText("Not enough comparable study days")}</p>
        )}
        {hidden.length > 0 && (
          <p className="text-sm text-muted">{uiText("Not enough sessions yet: ")}{hidden.map((c) => `${factorOption(c.factor,c.option)} (${c.n})`).join(', ')}.
          </p>
        )}
      </Panel>
      <AnalysisAnnouncement pending={!ranking.result&&!ranking.failed} failed={ranking.failed}/><div data-stats-ranking aria-busy={!ranking.result&&!ranking.failed} className="grid gap-4 xl:grid-cols-2">
        {!ranking.result?<AnalysisStatus {...ranking}/>:<>
        <Panel title={uiText("Goes with {value0} {value1}", {value0: (uiText(better(outcome))), value1: (word)})} hint={uiText("Exploratory association")}>
          {ranked.positive.length ? ranked.positive.slice(0, 8).map((c) => <ComparisonRow key={c.factor.key + c.option} c={c} />) : <Empty />}
        </Panel>
        <Panel title={uiText("Goes with {value0} {value1}", {value0: (uiText(outcomeDef(outcome).higherIsBetter ? 'lower' : 'higher')), value1: (word)})} hint={uiText("Exploratory association")}>
          {ranked.negative.length ? ranked.negative.slice(0, 8).map((c) => <ComparisonRow key={c.factor.key + c.option} c={c} />) : <Empty />}
        </Panel>
        </>}
      </div>
    </StatsSection>
  )
}

function Empty(): React.JSX.Element {
  return <p className="text-base text-muted">{uiText("Not enough comparable study days")}</p>
}

/** One option's average against the rest, as a bar with the difference and strength. */
function OptionBar({ c, highlighted=false }: { c: Comparison; highlighted?:boolean }): React.JSX.Element {
  const [lo, hi] = c.outcome === 'focus' || c.outcome === 'recall' ? [1, 5] : c.outcome === 'understanding' ? [1, 4] : [0, Math.max(c.mean, c.meanRest) * 1.2 || 1]
  const w = (v: number): number => Math.max(2, ((v - lo) / (hi - lo)) * 100)
  return (
    <div className="space-y-2"><div data-selected-insight={highlighted||undefined} className={`grid grid-cols-[minmax(6rem,12rem)_minmax(5rem,1fr)_auto] items-center gap-4 rounded-xl ${highlighted?'border border-focus/60 bg-focus/8 p-3':''}`}>
      <span dir="auto" className="text-base leading-snug">
        {factorOption(c.factor,c.option)}
      </span>
      <div className="relative h-3 rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${isStudyMethodFactor(c.factor)?'bg-muted':c.better > 0 ? 'bg-rest' : c.better < 0 ? 'bg-[var(--tf-line-detected)]' : 'bg-muted'}`} style={{ width: `${w(c.mean)}%` }} />
        {/* Where everything else sits. */}
        <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink/60" style={{ left: `${w(c.meanRest)}%` }} title={uiText("Other answers: {value0}", {value0: (formatOutcome(c.outcome, c.meanRest))})} />
      </div>
      <span className="flex items-center justify-end gap-3 whitespace-nowrap tabular-nums">
        <span className="text-base font-medium">{formatOutcome(c.outcome, c.mean)}</span>
        <span className="text-sm text-muted">{countEvidence(c.n,c.countUnit??'sessions')}</span>
        {!isStudyMethodFactor(c.factor)&&<StrengthBadge strength={c.strength!} />}
      </span>
    </div>{c.evidence&&<details className="text-sm text-muted"><summary className="cursor-pointer">{uiText("Evidence")}</summary>{Object.entries(evidenceCopy(c.evidence,currentLanguage())).filter(([key])=>key!=='summary').map(([key,value])=><p key={key} className="mt-2">{value}</p>)}</details>}</div>
  )
}

// --- 4. My best setup -----------------------------------------------------------

export function BestSetupSection(): React.JSX.Element {
  const {sessions,factors,options}=useStats()
  const [outcome,setOutcome]=useComparisonOutcome('focus','setup')
  const choosable=useMemo(()=>factors.filter(f=>f.group==='setup'||f.group==='detail'),[factors])
  const [key,setKey]=useState(choosable[0]?.key??'')
  const factor=choosable.find(f=>f.key===key)??choosable[0]
  const comparisons=useMemo(()=>factor?compareFactor(sessions,factor,outcome,options):[],[sessions,factor,outcome,options])
  return <StatsSection id="setup" title={uiText("Recorded setup comparisons")} lead="Compare one recorded condition at a time. No overall best or worst session score." action={<OutcomePicker value={outcome} onChange={setOutcome}/>}>
    <Panel><label className="text-sm text-muted">{uiText("Question")}<select className="input mt-2 w-full" value={factor?.key??''} onChange={e=>setKey(e.target.value)}>{choosable.map(f=><option key={f.key} value={f.key}>{factorName(f)}</option>)}</select></label><p className="text-sm text-muted">{uiText("These comparisons describe recorded conditions, not a best setup or proof of learning.")}</p>{factor&&isStudyMethodFactor(factor)&&<p className="text-sm text-muted">{uiText(METHOD_OBSERVATION_NOTE)}</p>}{comparisons.filter(c=>c.strength!==null).map(c=><ComparisonRow key={c.option} c={c}/>)}{!comparisons.some(c=>c.strength!==null)&&<Empty/>}</Panel>
  </StatsSection>
}

// --- 5. Time patterns -----------------------------------------------------------

export function TimeSection(): React.JSX.Element {
  const { sessions, options } = useStats()
  const [outcome, setOutcome] = useComparisonOutcome('focus', 'time')
  const t = useMemo(() => timePatterns(sessions, outcome, options), [sessions, outcome, options])
  const lengthFocus = useMemo(() => timePatterns(sessions, 'focus', options).length, [sessions, options])
  return (
    <StatsSection
      id="time"
      title={uiText("Time patterns")}
      lead="Find your better times and session lengths."
      action={<OutcomePicker value={outcome} onChange={setOutcome} />}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={uiText("Time of day")}>
          <GroupBars rows={t.timeOfDay} outcome={outcome} />
        </Panel>
        <Panel title={uiText("Day of the week")}>
          <GroupBars rows={t.weekday} outcome={outcome} />
        </Panel>
        <Panel title={uiText("Position in the sitting")} hint={uiText("The first session of a sitting against the second, third, fourth.")}>
          <GroupBars rows={t.position} outcome={outcome} />
        </Panel>
        <Panel title={uiText("Across a long day")} hint={uiText("The day's first session, second, and so on.")}>
          <GroupBars rows={t.dayPosition} outcome={outcome} />
        </Panel>
        <Panel title={uiText("Session length against focus")} hint={uiText("Longer sessions are often the focused ones; this shows how focus changes with length.")}>
          <GroupBars rows={lengthFocus} outcome="focus" />
        </Panel>
      </div>
    </StatsSection>
  )
}

// --- 6. Distractions -------------------------------------------------------------

export function DistractionsSection(): React.JSX.Element {
  const { sessions, reasonLabel, itemName, itemColor, activityLabel, weekStartsOn, options } = useStats()
  const d = useMemo(() => distractionNumbers(sessions, reasonLabel), [sessions, reasonLabel])
  const weeks = useMemo(
    () => weekly(sessions, weekStartsOn, options).map((w) => ({ label: weekLabel(w.week), clean: Math.round(w.clean * 100), some: Math.round(w.some * 100), distracted: Math.round(w.distracted * 100), sessions: w.sessions })),
    [sessions, weekStartsOn, options]
  )
  const minutes = d.byMinute.map((m) => ({ label: `${m.slice * 5}`, perSession: m.eventsPerHour, count: m.count }))
  const sourceLabel: Record<string, string> = { manual: 'Pressed Distracted', auto: 'Detected app or site', idle: 'No input (confirmed away)' }
  return (
    <StatsSection id="distractions" title={uiText("Distractions")} lead="What pulls you away, and when?" note={false}>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={uiText("By reason")} hint={uiText("Distractions you pressed, by the reason you gave.")}>
          <CountBars rows={d.byReason} />
        </Panel>
        <Panel title={uiText("By app or site")} hint={uiText("Detected during focus.")}>
          <CountBars rows={d.byApp.slice(0, 8)} />
        </Panel>
        <Panel title={uiText("By source")}>
          <CountBars rows={d.bySource.map((r) => ({ ...r, key: sourceLabel[r.key] ?? r.key }))} />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={uiText("When in the session")} hint={uiText("Distraction starts per focused hour in each five-minute slice. Partial slices count proportionally.")}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={minutes} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--tf-border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} />
                <Tooltip {...TOOLTIP} labelFormatter={(l)=>uiText('{from} to {to} min',{from:String(l),to:Number(l)+5})} formatter={v=>[uiText('{value} per hour',{value:Number(v).toFixed(1)}),uiText('Distractions')]} />
                <Bar dataKey="perSession" name={uiText('Distractions per focused hour')} fill="var(--tf-line-distracted)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={uiText("Recorded interruption level")} hint={uiText("Share of Clean, Some distraction and Distracted sessions each week.")}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <XAxis dataKey="label" {...AXIS} minTickGap={16} />
                <YAxis {...AXIS} unit="%" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow />
                <Tooltip {...TOOLTIP} formatter={(v, n) => [`${v} %`, n === 'clean' ? 'Clean' : n === 'some' ? 'Some distraction' : 'Distracted']} />
                <Bar dataKey="clean" name={uiText('Clean')} stackId="q" fill="var(--tf-rest)" isAnimationActive={false} />
                <Bar dataKey="some" name={uiText('Some distraction')} stackId="q" fill="var(--tf-line-distracted)" isAnimationActive={false} />
                <Bar dataKey="distracted" name={uiText('Distracted')} stackId="q" fill="var(--tf-line-detected)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={uiText("Per subject")} hint={uiText("Distractions per focused hour.")}>
          <RateBars rows={d.perSubject.map((r) => ({ key: itemName(r.id), rate: r.perHour, n: r.sessions, color: itemColor(r.id) }))} />
        </Panel>
        <Panel title={uiText("Per activity")} hint={uiText("Distractions per focused hour.")}>
          <RateBars rows={d.perActivity.map((r) => ({ key: activityLabel(r.activity), rate: r.perHour, n: r.sessions }))} />
        </Panel>
        <Panel title={uiText("Window activity")}>
          <p className="text-xs text-muted">{uiText(TRACKING_COVERAGE_NOTE)}</p>
          <p className="text-base">
            <span className="text-2xl font-semibold tabular-nums">{d.appTime.length?n1(d.windowSwitchesPer10Min):'—'}</span> <span className="text-muted">{uiText("window switches per 10 minutes of focus")}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            {d.appTime.slice(0, 6).map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 text-base">
                <span className="truncate" dir="auto">
                  {a.key}
                </span>
                <span className="text-muted tabular-nums">{timeOrDash(a.seconds)}</span>
              </div>
            ))}
            {!d.appTime.length && <p className="text-base text-muted">{uiText("No window tracking in this period.")}</p>}
          </div>
        </Panel>
      </div>
    </StatsSection>
  )
}

function CountBars({ rows }: { rows: { key: string; count: number; seconds: number }[] }): React.JSX.Element {
  if (!rows.length) return <p className="text-base text-muted">{uiText("None in this period.")}</p>
  const max = Math.max(...rows.map((r) => r.count))
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="truncate" dir="auto">
              {r.key}
            </span>
            <span className="text-sm text-muted tabular-nums whitespace-nowrap">
              {r.count} · {formatDuration(r.seconds)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[var(--tf-line-distracted)]" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RateBars({ rows }: { rows: { key: string; rate: number; n: number; color?: string }[] }): React.JSX.Element {
  const ok = rows.filter((r) => r.n >= MIN_SESSIONS)
  if (!ok.length) return <p className="text-base text-muted">{uiText("Needs 5 sessions in a group.")}</p>
  const max = Math.max(0.1, ...ok.map((r) => r.rate))
  return (
    <div className="flex flex-col gap-2.5">
      {ok.map((r) => (
        <div key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="truncate" dir="auto">
              {r.key}
            </span>
            <span className="text-sm text-muted tabular-nums whitespace-nowrap">
              {r.rate.toFixed(1)}{uiText(" / h · ")}{r.n}{uiText(" sess.")}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(r.rate / max) * 100}%`, background: r.color ?? 'var(--tf-line-distracted)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// --- 7. Rest ----------------------------------------------------------------------

export function RestSection(): React.JSX.Element {
  const { sessions, options } = useStats()
  const [outcome, setOutcome] = useComparisonOutcome('focus', 'rest')
  const r = useMemo(() => restNumbers(sessions, outcome, options), [sessions, outcome, options])
  return (
    <StatsSection id="rest" title={uiText("Rest")} lead="Compare breaks, screens, and the session that followed." action={<OutcomePicker value={outcome} onChange={setOutcome} />}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={uiText("Rest taken or skipped")}>
          <GroupBars rows={r.taken} outcome={outcome} />
        </Panel>
        <Panel title={uiText("Screens during the rest")}>
          <GroupBars rows={r.screen} outcome={outcome} />
        </Panel>
        <Panel title={uiText("What you did in the rest")}>
          <GroupBars rows={r.activity} outcome={outcome} labelOf={k=>DEFAULT_REST_SUGGESTIONS.includes(k)||['Screens','Something else','Not noted'].includes(k)?uiText(k):k} />
        </Panel>
        <Panel title={uiText("Rest length")}>
          <GroupBars rows={r.length} outcome={outcome} />
        </Panel>
      </div>
    </StatsSection>
  )
}

// --- 8. Methods -------------------------------------------------------------------

export function MethodsSection(): React.JSX.Element {
  const { sessions, factors, options } = useStats()
  const [outcome, setOutcome] = useComparisonOutcome('focus', 'methods')
  const activity = factors.find((f) => f.label === 'Activity')
  const methods = factors.find((f) => f.label === 'Study methods used')
  const a = useMemo(() => (activity ? compareFactor(sessions, activity, outcome, options) : []), [sessions, activity, outcome, options])
  const m = useMemo(() => (methods ? compareFactor(sessions, methods, outcome, options) : []), [sessions, methods, outcome, options])
  const list = (cs: Comparison[]): React.JSX.Element => {
    const shown = cs.filter((c) => c.evidence?.descriptive.groups.some(g=>g.sessions>0))
    if (!shown.length) return <Empty />
    return (
      <div className="flex flex-col gap-2.5">
        {shown.map((c) => (
          <MethodObservation key={factorOption(c.factor,c.option)} c={c} />
        ))}
      </div>
    )
  }
  return (
    <StatsSection id="methods" title={uiText("Methods")} lead={METHOD_OBSERVATION_NOTE} action={<OutcomePicker value={outcome} onChange={setOutcome} selfRatings only={['recall', 'understanding', 'focus']} />}>
      <p className="text-sm text-muted">{uiText(METHOD_OBSERVATION_NOTE)}</p>
      <div className="grid gap-4">
        <Panel title={uiText("Activity")} hint={uiText(['recall','understanding','focus'].includes(outcome)?"Recorded self-ratings, in option order. No method ranking or learning-effect score.":"Recorded time and activity do not measure learning.")}>
          {list(a)}
        </Panel>
        <Panel title={uiText("Study methods")} hint={uiText("Sessions where you used a method against sessions where you did not (from More detail).")}>
          {methods ? list(m) : <p className="text-base text-muted">{uiText("No study methods answered yet.")}</p>}
        </Panel>
      </div>
    </StatsSection>
  )
}

/** Full recorded experience stays visible even when a context cannot support
 * inference. Equal visual treatment: no better/worse colour or strength badge. */
function MethodObservation({c}:{c:Comparison}):React.JSX.Element {
  const groups=c.evidence!.descriptive.groups
  return <article data-method-observation className="rounded-xl border border-line p-4 space-y-3">
    <h4 className="font-medium" dir="auto">{factorOption(c.factor,c.option)}</h4>
    <p className="text-sm text-muted">{uiText(c.outcome==='recall'?'Immediate self-rated recall':c.outcome==='understanding'?'Self-rated understanding':c.outcome==='focus'?'Self-rated focus':outcomeDef(c.outcome).label)}</p>
    {groups.map((g,i)=><div key={i} className="flex flex-wrap justify-between gap-2 text-sm">
      <span dir="auto">{i===0?factorOption(c.factor,c.option):uiText('Other answers')}</span>
      <span className="tabular-nums">{g.contextDays?formatOutcome(c.outcome,g.mean):'–'} · {g.days} {uiText('study days')}</span>
    </div>)}
    <details className="text-sm text-muted"><summary className="cursor-pointer">{uiText('Recorded comparison details')}</summary>
      <p className="mt-2">{uiText('Matched recorded averages across all shared contexts, including contexts too sparse for uncertainty. Subjects, tasks and dates may still explain differences.')}</p>
      <p className="mt-2">{uiText(METHOD_OBSERVATION_NOTE)}</p>
      <p className="mt-2">{uiText('Rating distribution by context-day mean')}</p>
      {groups.map((g,i)=><p key={i} dir="auto">{i===0?factorOption(c.factor,c.option):uiText('Other answers')}: {g.distribution.map(r=>new Intl.NumberFormat(currentLanguage(),{maximumFractionDigits:1}).format(r.value)+' ('+r.days+')').join(', ')}</p>)}
    </details>
  </article>
}

// --- 9. Learning stage --------------------------------------------------------------

export function StageSection(): React.JSX.Element {
  const { sessions, stages, options } = useStats()
  const [outcome, setOutcome] = useComparisonOutcome('understanding', 'stage')
  const names = normalizeStages(stages).map((s) => s.name)
  const s = useMemo(() => stageNumbers(sessions, names, outcome, options), [sessions, outcome, options]) // eslint-disable-line react-hooks/exhaustive-deps
  const diff = useMemo(() => difficultyBy(sessions, (x) => x.stage, options, names), [sessions, options]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <StatsSection
      id="stage"
      title={uiText("Study-time milestones")}
      lead="Compare first hours, later experience, and prior knowledge."
      action={<OutcomePicker value={outcome} onChange={setOutcome} only={['understanding', 'focus', 'recall', 'distractionsPerHour']} />}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={uiText("Stage of the subject at the time")} hint={uiText("Each session counts in the stage its subject was in then.")}>
          <GroupBars rows={s.stage} outcome={outcome} labelOf={k=>k} />
        </Panel>
        <Panel title={uiText("Difficulty by stage")}>
          <GroupBars rows={diff} outcome="length" labelOf={k=>k} format={(v) => uiText('{value} of {maximum}',{value:v.toFixed(1),maximum:10})} />
        </Panel>
        <Panel title={uiText("Prior knowledge")} hint={uiText("As set on each subject.")}>
          <GroupBars rows={s.prior} outcome={outcome} />
          {!s.prior.length && <p className="text-sm text-muted">{uiText("Set prior knowledge in each subject's Edit dialog.")}</p>}
        </Panel>
        <Panel title={uiText("New field, and building on another subject")}>
          <GroupBars rows={[...s.newField, ...s.buildsOn]} outcome={outcome} />
        </Panel>
      </div>
      <p className="text-sm text-muted">{uiText("Stages: ")}{normalizeStages(stages).map((x) => x.name).join(', ')}{uiText(" (change them in Settings). Prior knowledge options: ")}{PRIOR_KNOWLEDGE.map((p) => uiText(p.label)).join(', ')}.</p>
    </StatsSection>
  )
}

// --- 10. Timer modes ------------------------------------------------------------------

export function ModesSection(): React.JSX.Element {
  const { sessions, options } = useStats()
  const [outcome, setOutcome] = useComparisonOutcome('focus', 'modes')
  const m = useMemo(() => modeNumbers(sessions, outcome, options), [sessions, outcome, options])
  return (
    <StatsSection id="modes" title={uiText("Timer modes")} lead="Flow, Fixed and Adaptive against how sessions went, and how often you go past the target." action={<OutcomePicker value={outcome} onChange={setOutcome} />}>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={uiText("By mode")}>
          <GroupBars rows={m.rows} outcome={outcome} />
        </Panel>
        <Panel title={uiText("Past the target")} hint={uiText("Share of sessions that went beyond their target.")}>
          <GroupBars
            rows={m.overTarget.map((x) => ({ key: x.mode, n: x.n, nOutcome: x.n, mean: x.share * 100 }))}
            outcome="lostShare"
            format={(v) => `${Math.round(v)} %`}
          />
        </Panel>
      </div>
    </StatsSection>
  )
}
