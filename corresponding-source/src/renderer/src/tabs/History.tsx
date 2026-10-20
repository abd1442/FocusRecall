import { formatDuration , formatDate, formatTime , count as formatCount } from '../i18n'
import { t as uiText, displayField } from '../i18n'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NotesEditor } from '../components/NotesEditor'
import type { StudyNote } from '@core/notes'
import type { HistorySitting } from '@core/blocks'
import {
  compareRanges,
  dayTimeline,
  filterBlocks,
  filterByQuality,
  flattenBlocks,
  groupSessionsBy,
  rangeFor,
  summarize,
  type DayBlock,
  type DayRange,
  type GroupBy,
  type RangePreset
} from '@core/history'
import { QUALITY_LABEL, type Quality } from '@core/distractions'
import { categoryAndChildren, categoryPathLabel, categoryTree } from '@core/library'
import { fieldByKey } from '@core/logfields'
import { addDays, parseDayStart, studyDayKey, studyDayRange } from '@core/studyDay'
import { stageCrossings, type StageCrossing } from '@core/learning'

import type { Id } from '@core/types'
import { Card, HBars, ReviewRows, Stats, timeOrDash } from '../components/overview'
import { Button, Segmented, inputBase } from '../components/ui'
import { useBlocks } from '../store/blocks'
import { useLibrary } from '../store/library'
import { useLogSchema } from '../store/logSchema'
import { useSession, useSettings } from '../store/session'
import { useUi } from '../store/ui'
import { HeatMap } from '../components/HeatMap'
import { useToday } from './Home'
import { SessionCard } from './history/SessionCard'

type View = 'sessions' | 'notes' | 'review'

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'this-week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-30', label: '30 days' },
  { value: 'all', label: 'All' }
]

const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }): string =>
  formatDate(key, opts)

export function HistoryTab(): React.JSX.Element {
  const { dayStart, weekStartsOn, quality: thresholds } = useSettings((s) => s.settings)
  const schema = useLogSchema((s) => s.schema)
  const { items, categories } = useLibrary()
  const stage = useSession((s) => s.state.stage)
  const today = useToday()

  const [sittings, setSittings] = useState<HistorySitting[] | null>(null)
  const [view, setView] = useState<View>('sessions')
  const [showCharts, setShowCharts] = useState(false)
  const [notes, setNotes] = useState<StudyNote[]>([]), [notesError, setNotesError] = useState(''), [editingNote, setEditingNote] = useState<StudyNote|null>(null)

  const [quality, setQuality] = useState<Quality | null>(null)
  const [preset, setPreset] = useState<RangePreset>('last-30')
  const [custom, setCustom] = useState<DayRange>({ from: addDays(today, -6), to: today })
  const [itemId, setItemId] = useState<Id | null>(null)
  const [categoryId, setCategoryId] = useState<Id | null>(null)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => { if (view !== 'notes') return; let alive = true; const timer=setTimeout(() => { void window.api.invoke('notes:search', query).then(rows => { if(alive){setNotes(rows);setNotesError('')} }).catch(e => { if(alive)setNotesError(String(e)) }) }, 180);return () => { alive=false;clearTimeout(timer) } }, [view,query,editingNote])
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  // A day picked on a heat map elsewhere (Home, a subject page) opens here.
  const historyDay = useUi((s) => s.historyDay)
  const jumpId=useUi((s)=>s.historySessionId)
  const [highlight,setHighlight]=useState<number|null>(null)
  useEffect(()=>{
    if(jumpId===null||sittings===null)return
    const parts=sittings.flatMap((s)=>s.blocks).filter((b)=>b.sessionId===jumpId)
    if(!parts.length){useUi.getState().clearHistorySession();return}
    setView('sessions');setPreset('all');setItemId(null);setCategoryId(null);setActivityId(null);setQuality(null);setQuery('');setGroupBy('day');setHighlight(jumpId)
    useUi.getState().clearHistorySession()
  },[jumpId,sittings])
  useEffect(()=>{
    if(highlight===null)return
    const timer=setTimeout(()=>{
      const el=document.getElementById(`history-session-${highlight}`)
      if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.setAttribute('tabindex','-1');el.focus({preventScroll:true})}
    },150)
    return()=>clearTimeout(timer)
  },[highlight])
  useEffect(() => {
    if (!historyDay) return
    setSelectedDay(historyDay)
    setPreset('day')
    useUi.getState().clearHistoryDay()
  }, [historyDay])

  const reload = useCallback(async () => {
    setSittings(await window.api.invoke('history:list'))
    void useBlocks.getState().refresh()
  }, [])
  useEffect(() => {
    void reload()
  }, [reload, stage])

  const all = useMemo(() => flattenBlocks(sittings ?? [], dayStart), [sittings, dayStart])
  const categoryOf = useMemo(() => {
    const m = new Map(items.map((i) => [i.id, i.categoryId]))
    return (id: Id): Id | undefined => m.get(id)
  }, [items])
  const range = rangeFor(preset, today, weekStartsOn, preset === 'day' && selectedDay ? { from: selectedDay, to: selectedDay } : custom)
  const categoryIds = categoryId ? categoryAndChildren(categories, categoryId) : null
  const filtered = useMemo(
    () =>
      filterByQuality(filterBlocks(all, { range, itemIds: itemId ? [itemId] : null, categoryIds, activityId, query }, schema, categoryOf), quality, thresholds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, range.from, range.to, itemId, categoryId, activityId, query, schema, categoryOf, categories, quality, thresholds]
  )
  // The calendar and comparisons follow the subject, category and activity filters, not the date range.
  const unranged = useMemo(
    () => filterBlocks(all, { range: { from: null, to: null }, itemIds: itemId ? [itemId] : null, categoryIds, activityId, query: '' }, schema, categoryOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, itemId, categoryId, activityId, schema, categoryOf, categories]
  )
  const timelineDay = selectedDay ?? filtered[0]?.day ?? today
  const summaries = useBlocks((s) => s.blocks)
  const unrangedIds = useMemo(() => new Set(unranged.map((b) => b.id)), [unranged])
  const activityField = fieldByKey(schema, 'activity')
  const activities = activityField ? displayField(activityField).options.filter(o=>!o.archived) : []
  const sum = summarize(filtered)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-7 px-10 py-9">
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="flex-1 text-4xl font-light tracking-tight">{uiText("History")}</h1>
          <input dir="auto" className={`${inputBase} w-80`} aria-label={uiText("Search history")} placeholder={view==='notes'?uiText("Search saved notes…"):uiText("Search recall and session notes…")} value={query} onChange={(e) => setQuery(e.target.value)} />
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'sessions', label: 'Sessions' },
              { value: 'notes', label: 'Saved notes' },
              { value: 'review', label: 'To review' }
            ]}
          />
        </header>

        {view !== 'notes' && <><div className="flex flex-wrap items-center gap-3">
          <Segmented<RangePreset>
            value={preset === 'day' || preset === 'custom' ? ('' as RangePreset) : preset}
            onChange={(p) => {
              setPreset(p)
              setSelectedDay(null)
            }}
            options={PRESETS}
          />
          <span className="flex items-center gap-2 text-base text-muted">
            <input
              type="date"
              aria-label={uiText("From")}
              className={`${inputBase} w-44`}
              value={range.from ?? ''}
              onChange={(e) => {
                setCustom({ from: e.target.value || null, to: range.to })
                setPreset('custom')
              }}
            />{uiText("to")}<input
              type="date"
              aria-label={uiText("To")}
              className={`${inputBase} w-44`}
              value={range.to ?? ''}
              onChange={(e) => {
                setCustom({ from: range.from, to: e.target.value || null })
                setPreset('custom')
              }}
            />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label={uiText("Subject")} className={`${inputBase} w-60`} value={itemId ?? ''} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{uiText("All subjects")}</option>
            {items
              .filter((i) => !i.archived)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
          <select aria-label={uiText("Category")} className={`${inputBase} w-60`} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{uiText("All categories")}</option>
            {categoryTree(categories).map(({ category: c, depth }) => (
              <option key={c.id} value={c.id}>
                {depth ? `    ${c.name}` : c.name}
              </option>
            ))}
          </select>
          <select aria-label={uiText("Activity")} className={`${inputBase} w-72`} value={activityId ?? ''} onChange={(e) => setActivityId(e.target.value || null)}>
            <option value="">{uiText("All activities")}</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <select aria-label={uiText("Session quality")} className={`${inputBase} w-56`} value={quality ?? ''} onChange={(e) => setQuality((e.target.value || null) as Quality | null)}>
            <option value="">{uiText("Any quality")}</option>
            {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
              <option key={q} value={q}>
                {uiText(QUALITY_LABEL[q])}
              </option>
            ))}
          </select>
          {(itemId || categoryId || activityId || query || quality) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setItemId(null)
                setCategoryId(null)
                setActivityId(null)
                setQuery('')
                setQuality(null)
              }}
            >{uiText("Clear filters")}</Button>
          )}
        </div>

        </>}
        {view === 'notes' ? <section className="flex flex-col gap-4"><p className="text-sm text-muted">{uiText("Saved notes · all dates and subjects")}</p>{notesError&&<p role="alert" className="text-status-error">{notesError}</p>}{!notes.length&&!notesError&&<p>{uiText("No saved notes match.")}</p>}{notes.slice(0,100).map(n=><article key={n.id} className="rounded-2xl border border-line bg-surface p-5"><header className="flex flex-wrap items-center gap-3"><h2 className="flex-1 font-semibold" dir="auto">{n.title}</h2><span className="text-sm text-muted">{items.find(i=>i.id===n.itemId)?.name} · {formatDate(new Date(n.updatedAt))}</span><Button onClick={()=>setEditingNote(n)}>{uiText("Open note")}</Button>{n.blockId!==null&&all.some(b=>b.id===n.blockId)&&<Button onClick={()=>useUi.getState().openHistorySession(all.find(b=>b.id===n.blockId)!.sessionId)}>{uiText("Open session")}</Button>}</header><p dir="auto" className="mt-3 line-clamp-2 whitespace-pre-wrap text-muted">{n.text || 'Drawing'}</p></article>)}{notes.length>100&&<p className="text-sm text-muted">{uiText("Showing the 100 latest matches. Refine your search to find an older note.")}</p>}{editingNote&&<NotesEditor itemId={editingNote.itemId} note={editingNote} onClose={()=>setEditingNote(null)}/>}</section> : sittings === null ? null : view === 'review' ? (
          <ReviewList blocks={filtered} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-muted">{formatCount(sum.sessions, 'session')} · {timeOrDash(sum.focusSeconds)}{uiText(" focused")}</p><Button aria-expanded={showCharts} onClick={() => setShowCharts(!showCharts)}>{uiText("Summary, calendar & charts")}</Button></div>
            {showCharts && <div className="flex flex-col gap-6">
            <div className="grid gap-6 2xl:grid-cols-2">
              <Card title={preset === 'day' && selectedDay ? dayLabel(selectedDay) : uiText("Selected range")}>
                <Stats
                  items={[
                    { label: 'focused', value: timeOrDash(sum.focusSeconds) },
                    { label: sum.sessions === 1 ? 'session' : 'sessions', value: String(sum.sessions) },
                    { label: 'average session', value: sum.sessions ? formatDuration(sum.averageSessionSeconds) : '–' },
                    { label: sum.subjects === 1 ? 'subject' : 'subjects', value: String(sum.subjects) }
                  ]}
                />
              </Card>
              <CompareCard blocks={unranged} today={today} />
            </div>

            <HeatMap
              blocks={summaries.filter((b) => unrangedIds.has(b.id))}
              selected={preset === 'day' ? selectedDay : null}
              onPick={(d) => {
                setSelectedDay(d)
                setPreset('day')
              }}
            />
            <Card title={uiText("Day timeline · {value0}", {value0: (dayLabel(timelineDay, { weekday: 'short', day: 'numeric', month: 'short' }))})}>
              <DayTimeline blocks={all.filter((b) => b.day === timelineDay)} day={timelineDay} dayStart={dayStart} />
            </Card>

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card title={uiText("Focused time per day")}>
                <StackedDays blocks={filtered} range={range} today={today} />
              </Card>
              <Card title={uiText("Time per subject")}>
                <HBars
                  rows={Object.values(
                    filtered.reduce<Record<number, { key: number; label: string; color: string; seconds: number }>>((acc, b) => {
                      const e = (acc[b.itemId] ??= { key: b.itemId, label: b.itemName, color: b.itemColor, seconds: 0 })
                      e.seconds += b.focusSeconds ?? 0
                      return acc
                    }, {})
                  ).sort((a, b) => b.seconds - a.seconds)}
                />
              </Card>
            </div>

            </div>}

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">{uiText("Sessions")}</h2>
                <span className="flex items-center gap-3 text-base text-muted">{uiText("Group by")}<Segmented<GroupBy>
                    value={groupBy}
                    onChange={setGroupBy}
                    options={[
                      { value: 'day', label: 'Day' },
                      { value: 'subject', label: 'Subject' },
                      { value: 'category', label: 'Category' }
                    ]}
                  />
                </span>
              </div>
              <SessionGroups blocks={filtered} by={groupBy} categoryOf={categoryOf} reload={reload} highlight={highlight} query={query} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function CompareCard({ blocks, today }: { blocks: DayBlock[]; today: string }): React.JSX.Element {
  const weekStartsOn = useSettings((s) => s.settings.weekStartsOn)
  const rows = compareRanges(blocks, today, weekStartsOn)
  const change = (cur: number, prev: number): React.ReactNode => {
    if (!prev) return cur ? <span className="text-muted">{uiText("new")}</span> : <span className="text-muted">–</span>
    const pct = Math.round(((cur - prev) / prev) * 100)
    return <span className={pct >= 0 ? 'text-rest' : 'text-overtime'}>{pct >= 0 ? `+${pct}%` : `${pct}%`}</span>
  }
  return (
    <Card title={uiText("Compared with before")}>
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-2 rounded-xl bg-surface-2/60 px-5 py-4">
            <span className="text-base font-medium">
              {r.label} <span className="font-normal text-muted">{uiText("vs ")}{r.label === 'This week' ? uiText("last week") : uiText("last month")}</span>
            </span>
            <div className="flex flex-wrap gap-x-10 gap-y-1 text-base">
              <span className="whitespace-nowrap">
                <span className="text-xl font-semibold tabular-nums">{timeOrDash(r.current.focusSeconds)}</span>
                <span className="text-muted">{uiText(" vs ")}{timeOrDash(r.previous.focusSeconds)} </span>
                {change(r.current.focusSeconds, r.previous.focusSeconds)}
              </span>
              <span className="whitespace-nowrap">
                <span className="text-xl font-semibold tabular-nums">{r.current.sessions}</span>
                <span className="text-muted">{uiText(" vs ")}{formatCount(r.previous.sessions, 'session')} </span>
                {change(r.current.sessions, r.previous.sessions)}
              </span>
            </div>
          </div>
        ))}
        <p className="text-sm text-muted">{uiText("Same elapsed weekdays or day-of-month in both periods. Previous months stop at their last available date. Today is still in progress. Recorded effort, not learning improvement.")}</p>
      </div>
    </Card>
  )
}

function DayTimeline({ blocks, day, dayStart }: { blocks: DayBlock[]; day: string; dayStart: string }): React.JSX.Element {
  const spans = dayTimeline(blocks, day, dayStart)
  const byId = new Map(blocks.map((b) => [b.id, b]))
  if (!spans.length) return <p className="text-base text-muted">{uiText("Nothing studied on this day.")}</p>
  // Show the part of the day that was used, with an hour of margin.
  const first = Math.max(0, Math.min(...spans.map((s) => s.start)) - 1 / 24)
  const last = Math.min(1, Math.max(...spans.map((s) => s.end)) + 1 / 24)
  const span = last - first
  const { start } = studyDayRange(day, parseDayStart(dayStart))
  const hours: number[] = []
  for (let h = Math.ceil(first * 24); h <= Math.floor(last * 24); h++) hours.push(h)
  const at = (f: number): string => `${((f - first) / span) * 100}%`
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-16 rounded-xl bg-surface-2/60">
        {spans.map((s, i) => {
          const b = byId.get(s.blockId)!
          const style: React.CSSProperties = { left: at(s.start), width: `max(3px, ${((s.end - s.start) / span) * 100}%)` }
          if (s.kind === 'focus') style.background = b.itemColor
          return (
            <div
              key={i}
              title={`${b.itemName} · ${s.kind === 'focus' ? formatDuration(b.focusSeconds ?? 0) : s.kind}`}
              className={`absolute ${
                s.kind === 'focus'
                  ? 'top-2 bottom-2 rounded-md'
                  : s.kind === 'pause'
                    ? 'top-2 bottom-2 bg-[repeating-linear-gradient(45deg,var(--tf-surface)_0_4px,transparent_4px_8px)]'
                    : 'top-7 bottom-7 rounded-full bg-rest/70'
              }`}
              style={style}
            />
          )
        })}
      </div>
      <div className="relative h-5 text-sm text-muted">
        {hours.map((h) => {
          const t = new Date(start.getTime() + h * 3_600_000)
          return (
            <span key={h} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(h / 24) }}>
              {formatTime(t, { hour: 'numeric' })}
            </span>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-6 rounded bg-stage-focus" />{uiText(" focus, in the subject's colour")}</span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-6 rounded bg-[repeating-linear-gradient(45deg,var(--tf-muted)_0_3px,transparent_3px_6px)]" />{uiText(" pause")}</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-6 rounded-full bg-rest/70" />{uiText(" rest")}</span>
      </div>
    </div>
  )
}

/** Focused minutes per day, stacked by subject. */
function StackedDays({ blocks, range, today }: { blocks: DayBlock[]; range: DayRange; today: string }): React.JSX.Element {
  const from = range.from ?? (blocks.length ? blocks[blocks.length - 1].day : addDays(today, -29))
  const to = range.to && range.to < today ? range.to : today
  const days: string[] = []
  for (let d = from; d <= to && days.length < 120; d = addDays(d, 1)) days.push(d)
  const subjects = new Map<number, { name: string; color: string }>()
  const rows = days.map((d) => {
    const row: Record<string, number | string> = { day: d }
    for (const b of blocks) {
      if (b.day !== d) continue
      subjects.set(b.itemId, { name: b.itemName, color: b.itemColor })
      row[`s${b.itemId}`] = ((row[`s${b.itemId}`] as number) ?? 0) + Math.round((b.focusSeconds ?? 0) / 60)
    }
    return row
  })
  if (!blocks.length) return <p className="text-base text-muted">{uiText("No sessions in this range.")}</p>
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => dayLabel(d, days.length > 14 ? { day: 'numeric', month: 'short' } : { weekday: 'short' })}
            tick={{ fill: 'var(--tf-muted)', fontSize: 13 }}
            axisLine={false}
            tickLine={false}
            minTickGap={12}
          />
          <YAxis tick={{ fill: 'var(--tf-muted)', fontSize: 13 }} axisLine={false} tickLine={false} unit="m" />
          <Tooltip
            cursor={{ fill: 'var(--tf-surface-2)' }}
            contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 10, color: 'var(--tf-text)' }}
            labelFormatter={(d) => dayLabel(String(d))}
            formatter={(v, name) => [`${v} min`, subjects.get(Number(String(name).slice(1)))?.name ?? '']}
          />
          {[...subjects.entries()].map(([id, s]) => (
            <Bar key={id} dataKey={`s${id}`} stackId="a" fill={s.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SessionGroups({
  blocks,
  by,
  categoryOf,
  reload,highlight,query
}: {
  blocks: DayBlock[]
  by: GroupBy
  categoryOf: (id: Id) => Id | undefined
  reload: () => Promise<void>
  highlight: number|null
  query:string
}): React.JSX.Element {
  const { items, categories } = useLibrary()
  const [shown, setShown] = useState(30)
  const groups = useMemo(() => groupSessionsBy(blocks, by, categoryOf), [blocks, by, categoryOf])
  const ordered = groups.flatMap(g => g.sessions)
  const count = Math.max(shown, highlight === null ? 0 : ordered.findIndex(s => s.id === highlight) + 1)
  const visible = new Set(ordered.slice(0, count).map(s => s.id))
  const milestones = useStageMilestones()
  if (!groups.length) return <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-base text-muted">{uiText("No sessions match.")}</p>
  const title = (key: string): string => {
    if (by === 'day') return dayLabel(key)
    if (by === 'subject') return items.find((i) => i.id === Number(key))?.name ?? 'Deleted subject'
    return key ? categoryPathLabel(categories, Number(key)) : 'No category'
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.filter(g => g.sessions.some(s => visible.has(s.id))).map((g) => (
        <section key={g.key} className="flex flex-col gap-3">
          <h3 className="flex items-baseline justify-between text-lg">
            <span className="font-semibold">{title(g.key)}</span>
            <span className="text-base text-muted">
              {formatCount(g.sessions.length,'session')} · {timeOrDash(g.focusSeconds)}
            </span>
          </h3>
          {by === 'day' &&
            (milestones.get(g.key) ?? [])
              .filter((m) => g.sessions.some((sess) => sess.parts.some((p) => p.itemId === m.itemId)))
              .map((m) => (
                <div key={`${m.itemId}-${m.hours}`} className="flex items-center gap-3 rounded-xl border border-focus/30 bg-focus/8 px-5 py-3 text-base">
                  <span aria-hidden="true" className="text-focus">
                    ◆
                  </span>
                  <span dir="auto">
                    <span className="font-semibold">{items.find((i) => i.id === m.itemId)?.name ?? 'A subject'}</span>{uiText(" reached ")}{m.hours}{uiText(" hours: ")}{m.stage}{uiText(" begins")}</span>
                  <span className="ml-auto text-sm text-muted">{formatTime(new Date(m.at), { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
          <div className="flex flex-col gap-3">
            {g.sessions.filter(s => visible.has(s.id)).map((sess) => (
              <div key={sess.id} className={sess.id===highlight?'rounded-2xl ring-2 ring-focus ring-offset-4 ring-offset-bg':''}><SessionCard session={sess} reload={reload} highlighted={sess.id === highlight} query={query}/></div>
            ))}
          </div>
        </section>
      ))}
      {ordered.length > count && (
        <Button variant="quiet" className="self-center" onClick={() => setShown((n) => n + 30)}>{uiText("Show more")}</Button>
      )}
    </div>
  )
}

function ReviewList({ blocks }: { blocks: DayBlock[] }): React.JSX.Element {
  const summaries = useBlocks((s) => s.blocks)
  const setReviewDone = useBlocks((s) => s.setReviewDone)
  const [showDone, setShowDone] = useState(false)
  const ids = new Set(blocks.map((b) => b.id))
  const list = summaries
    .filter((b) => ids.has(b.id) && b.reviewMarked && (showDone || !b.reviewDone))
    .sort((a, b) => Date.parse(b.focusStartedAt) - Date.parse(a.focusStartedAt))
  return (
    <Card
      title={uiText("To review")}
      action={
        <label className="flex items-center gap-2 text-base text-muted">
          <input type="checkbox" className="size-4" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />{uiText("Show done")}</label>
      }
    >
      <ReviewRows blocks={list} onToggle={(b, done) => setReviewDone(b.id, done)} />
    </Card>
  )
}

/** When subjects crossed a learning-stage threshold, by study day (from all sessions, not only the filtered ones). */
function useStageMilestones(): Map<string, StageCrossing[]> {
  const blocks = useBlocks((s) => s.blocks)
  const items = useLibrary((s) => s.items)
  const settings = useSettings((s) => s.settings)
  return useMemo(() => {
    const parts = blocks.map((b) => ({ itemId: b.itemId, start: Date.parse(b.focusStartedAt), end: Date.parse(b.focusStartedAt) + b.focusSeconds * 1000, focusSeconds: b.focusSeconds }))
    const crossings = stageCrossings(parts, new Map(items.map((i) => [i.id, i.hoursBefore])), settings.learningStages)
    const out = new Map<string, StageCrossing[]>()
    const boundary = parseDayStart(settings.dayStart)
    for (const c of crossings) {
      const day = studyDayKey(new Date(c.at), boundary)
      out.set(day, [...(out.get(day) ?? []), c])
    }
    return out
  }, [blocks, items, settings.learningStages, settings.dayStart])
}
