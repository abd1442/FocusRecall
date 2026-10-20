import { completedStatsSessions } from '@core/statsEvidenceSummary'
import { RecordedDashboard } from './stats/RecordedDashboard'
import { StatsEmptyContext } from './stats/parts'
import { displayField , formatDate } from '../i18n'
import { t as uiText } from '../i18n'
import { validateView } from '@core/studyTools'
import { showMessage } from '../components/appDialogs'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PersonalInsight } from '@core/personalInsights'
import type { PersonalAnalysisJob } from '@core/statsAnalysis'
import { AnalysisAnnouncement, AnalysisStatus } from './stats/AnalysisStatus'
import { useStatsAnalysis } from './stats/useStatsAnalysis'
import { RetainedPanel } from '../components/RetainedPanel'
import { RestoredOutcomeContext } from './stats/RestoredOutcomeContext'
import type { OutcomeKey } from '@core/statsData'
import { InsightContext } from './stats/InsightContext'
import { PersonalOverview } from './stats/PersonalOverview'
import { reasonLabel as baseReasonLabel } from '@core/distractions'
import { DEFAULT_ANALYSIS, type AnalysisOptions } from '@core/insights'
import { categoryTree } from '@core/library'
import { fieldByKey } from '@core/logfields'
import { buildStatSessions, filterSessions, NO_FILTER, type StatsFilter, type StatsRaw } from '@core/statsData'
import { addDays } from '@core/studyDay'
import { rangeFor } from '@core/history'
import { useBlocks } from '../store/blocks'
import { useLibrary } from '../store/library'
import { useLogSchema } from '../store/logSchema'
import { useSettings } from '../store/session'
import { useToday } from './Home'
import { ReportSection } from './stats/ReportSection'
import { StudyRhythmSection } from './stats/StudyRhythm'
import './stats/statsCompanion.css'
import { StudyTools, WeeklyStats, type StudyToolTab } from '../components/StudyTools'
import {
  BestSetupSection,
  DistractionsSection,
  FactorsSection,
  MethodsSection,
  ModesSection,
  OverviewSection,
  RestSection,
  StageSection,
  StatsContext,
  SubjectsSection,
  TimeSection,
  type StatsContextValue
} from './stats/sections'

const SECTIONS = [
  { id:'insights',label:'Your insights' },
  { id:'weekly',label:'Your week' },
  { id: 'overview', label: 'Overview' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'factors', label: 'Recorded comparisons' },
  { id: 'setup', label: 'Setup comparisons' },
  { id: 'time', label: 'Time patterns' },
  { id: 'rhythm', label: 'Study rhythm' },
  { id: 'distractions', label: 'Distractions' },
  { id: 'rest', label: 'Rest' },
  { id: 'methods', label: 'Methods' },
  { id: 'stage', label: 'Study-time milestones' },
  { id: 'modes', label: 'Timer modes' },
  { id: 'report', label: 'Report' }
]

type Range = 'this-week' | 'last-30' | 'last-90' | 'this-month' | 'last-month' | 'this-year' | 'all' | 'custom'
const RANGES: { id: Range; label: string }[] = [
  { id: 'this-week', label: 'This week' },
  { id: 'last-30', label: 'Last 30 days' },
  { id: 'last-90', label: 'Last 3 months' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom dates' }
]

const selectClass = 'min-h-11 rounded-lg border border-line bg-surface-2/60 px-3 text-base text-ink outline-none focus:border-focus'

/**
 * Stats: what the data says about how you study, like a short research report
 * about yourself. Everything follows the filters (dates, subject, category,
 * activity), the "within the same subject" switch and the untouched-default rule.
 */
export function StatsTab(): React.JSX.Element {
  const [raw, setRaw] = useState<StatsRaw | null>(null)
  const settings = useSettings((s) => s.settings)
  const schema = useLogSchema((s) => s.schema)
  const items = useLibrary((s) => s.items)
  const categories = useLibrary((s) => s.categories)
  const itemStats = useLibrary((s) => s.stats)
  const blocks = useBlocks((s) => s.blocks)
  const today = useToday()
  const [range, setRange] = useState<Range>('last-90')
  const [filter, setFilter] = useState<Omit<StatsFilter, 'from' | 'to'>>({ itemId: null, categoryId: null, activity: null })
  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_ANALYSIS)
  const [active, setActive] = useState('insights')
  const [restoredOutcome,setRestoredOutcome]=useState<{outcome:OutcomeKey;revision:number}|null>(null)
  const [toolsOpen,setToolsOpen]=useState(false)
  const [toolTab,setToolTab]=useState<StudyToolTab>('experiments')
  const openTool=(tab:StudyToolTab):void=>{setToolTab(tab);setToolsOpen(true)}
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today })
  const [error, setError] = useState<string | null>(null)

  const request=useRef(0)
  const load = useCallback(async () => {const id=++request.current; try { const result=await window.api.invoke('stats:raw');if(id===request.current){setRaw(result);setError(null)} } catch (err) { if(id===request.current)setError(err instanceof Error ? err.message : String(err)) } }, [])
  useEffect(() => {
    void load()
    const off = [window.api.on('study:changed',()=>void load()),window.api.on('log:schemaChanged',()=>void load()),window.api.on('distractions:changed', () => void load()), window.api.on('session:changed', (s) => s.stage === 'idle' && void load())]
    return () => off.forEach((f) => f())
  }, [load])

  const built = useMemo(
    () => (raw ? buildStatSessions(raw, { dayStart: settings.dayStart, stages: settings.learningStages, quality: settings.quality }) : null),
    [raw, settings.dayStart, settings.learningStages, settings.quality]
  )
  const dates = useMemo((): { from: string | null; to: string | null } => {
    if (range === 'custom') return custom
    if (range === 'last-90') return { from: addDays(today, -89), to: today }
    if (range === 'this-year') return { from: `${today.slice(0, 4)}-01-01`, to: today }
    if (range === 'all') return { from: null, to: null }
    return rangeFor(range, today, settings.weekStartsOn)
  }, [range, today, settings.weekStartsOn, custom])
  const anyDate = useMemo(() => (built ? filterSessions(completedStatsSessions(built.sessions,today,Date.now()), { ...NO_FILTER, ...filter }) : []), [built, filter,today])
  const sessions = useMemo(() => filterSessions(anyDate, { ...NO_FILTER, ...filter, ...dates }), [anyDate, filter, dates])
  const sleepHours=useMemo(()=>{
    const field=raw?.schema.fields.find(f=>f.key==='sleep-hours')
    const result=new Map<string,{value:number;touched:boolean}>()
    if(field)for(const d of raw!.dayValues){const v=d.values.find(v=>v.fieldId===field.id);if(v && typeof v.value==='number')result.set(d.day,{value:v.value,touched:v.touched})}
    return result
  },[raw])
  const sleepFieldId=raw?.schema.fields.find(f=>f.key==='sleep-hours')?.id
  const analysisJob=useMemo(():PersonalAnalysisJob|null=>built?{
    kind:'personal',sessions,factors:built.factors,options,
    input:{today,all:built.sessions,sleepHours,sleepFieldKey:sleepFieldId===undefined?undefined:`field:${sleepFieldId}`},
    activities:new Map((schema.fields.find(f=>f.key==='activity')?.options??[]).map(o=>[o.id,o.label])),
    reasons:new Map(built.sessions.flatMap(s=>s.distractions.map(d=>[d.kind,baseReasonLabel(d.kind,settings.distractionReasons)] as [string,string])))
  }:null,[sessions,built,options,today,sleepHours,sleepFieldId,schema,settings.distractionReasons])
  const {result:personal,failed:analysisFailed,retry:retryAnalysis}=useStatsAnalysis(analysisJob)
  const [exploring,setExploring]=useState<PersonalInsight|null>(null)
  useEffect(()=>setExploring(null),[sessions,options])
  const returnPosition=useRef(0),returnFocus=useRef<HTMLElement|null>(null)
  const backToInsights=():void=>{setActive('insights');setExploring(null);requestAnimationFrame(()=>requestAnimationFrame(()=>{const root=document.getElementById('stats-scroll');if(root)root.scrollTop=returnPosition.current;returnFocus.current?.focus({preventScroll:true})}))}
  const jump=(id:string,c?:PersonalInsight):void=>{setActive(id);if(!c)setExploring(null);if(c){if(!exploring){returnPosition.current=document.getElementById('stats-scroll')?.scrollTop??0;returnFocus.current=document.activeElement as HTMLElement}setExploring(c);window.dispatchEvent(new CustomEvent('tf-explore-insight',{detail:c}))}requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=document.getElementById('stats-'+id);document.getElementById('stats-scroll')?.scrollTo({top:0,behavior:'instant'});if(c&&target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true})}}))}
  const restoreDiscoveryScope=(scope:string):void=>{
    try {
      const stored=JSON.parse(scope)
      const view=validateView({id:'playbook',name:'Saved finding',range:stored.range,custom:stored.custom??{from:addDays(today,-29),to:today},filter:stored.filter,options:stored.options,outcome:'focus'})
      setActive('insights');setRange(view.range);setCustom(view.custom);setFilter(view.filter);setOptions(view.options)
      requestAnimationFrame(()=>document.getElementById('stats-insights')?.scrollIntoView({block:'start'}))
    }catch{void showMessage('This saved view could not be restored. Its evidence snapshot is still available in your playbook.')}
  }
  const experiment=(c:PersonalInsight):void=>{
    openTool('experiments')
    window.dispatchEvent(new CustomEvent('tf-experiment-suggestion',{detail:{change:c.action,outcome:c.outcome,origin:c.trial}}))
  }

  const storedActivity = fieldByKey(schema, 'activity')
  const activityField = useMemo(()=>storedActivity&&displayField(storedActivity),[storedActivity,settings.language])
  const ctx = useMemo((): StatsContextValue | null => {
    if (!built) return null
    const itemById = new Map(items.map((i) => [i.id, i]))
    const catById = new Map(categories.map((c) => [c.id, c]))
    const sessionIds = new Set(sessions.map((s) => s.id))
    return {
        subjectFilter:filter,
      sessions,
      factors: built.factors,
      options,
      stages: settings.learningStages,
      weekStartsOn: settings.weekStartsOn,
      blocks: blocks.filter((b) => sessionIds.has(b.sessionId)),
      itemName: (id) => itemById.get(id)?.name ?? 'Deleted subject',
      itemColor: (id) => itemById.get(id)?.color ?? 'var(--tf-muted)',
      categoryName: (id) => catById.get(id)?.name ?? 'Other',
      categoryColor: (id) => catById.get(id)?.color ?? 'var(--tf-muted)',
      activityLabel: (id) => activityField?.options.find((o) => o.id === id)?.label ?? id,
      reasonLabel: (k) => k==='timer-pause'?uiText('Timer pause'):baseReasonLabel(k, settings.distractionReasons),
      progressOf: (id) => {
        const it = itemById.get(id)
        const st = itemStats.get(id)
        return it?.totalUnits && st ? { done: st.progress, total: it.totalUnits, unit: it.defaultUnit } : null
      }
    }
  }, [built, sessions, options, filter, settings, items, categories, itemStats, blocks, activityField])

  useEffect(() => {
    const bar = document.getElementById('stats-bar'), root = document.getElementById('stats-scroll')
    if (!bar || !root) return
    const observer = new ResizeObserver(() => root.style.setProperty('--stats-bar-height', `${bar.getBoundingClientRect().height / settingsZoom() + 20}px`))
    const settingsZoom = (): number => Number(document.documentElement.style.zoom) || 1
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  const tree = categoryTree(categories.filter((c) => !c.archived))
  const filtering = filter.itemId !== null || filter.categoryId !== null || filter.activity !== null

  const chips: { label: string; clear: () => void }[] = [
    ...(range !== 'all' ? [{ label: range === 'custom' ? formatDate(custom.from) + ' – ' + formatDate(custom.to) : uiText(RANGES.find((r) => r.id === range)!.label), clear: () => setRange('all') }] : []),
    ...(filter.itemId !== null ? [{ label: items.find((i) => i.id === filter.itemId)?.name ?? 'Subject', clear: () => setFilter((f) => ({ ...f, itemId: null })) }] : []),
    ...(filter.categoryId !== null ? [{ label: categories.find((c) => c.id === filter.categoryId)?.name ?? 'Category', clear: () => setFilter((f) => ({ ...f, categoryId: null })) }] : []),
    ...(filter.activity ? [{ label: activityField?.options.find((o) => o.id === filter.activity)?.label ?? filter.activity, clear: () => setFilter((f) => ({ ...f, activity: null })) }] : []),
    ...(options.includeUntouched ? [{ label: 'Untouched included', clear: () => setOptions((o) => ({ ...o, includeUntouched: false })) }] : [])
  ]
  const groups=[{label:'Your insights',ids:['insights']},{label:'Activity',ids:['weekly','overview','subjects','rhythm','stage']},{label:'Comparisons',ids:['factors','setup','time','distractions','rest','methods','modes']},{label:'Report',ids:['report']}]
  return (
    <div style={{containerType:'inline-size',containerName:'stats'}} className={`stats-workspace h-full ${toolsOpen?'stats-workspace-open':''}`}><div id="stats-scroll" className="h-full overflow-y-auto">
      <div id="stats-bar" className="sticky top-0 z-10 border-b border-line bg-bg/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-3xl font-semibold tracking-tight">{uiText("Stats ")}<span className="text-base font-normal text-muted">/ {uiText(SECTIONS.find((s) => s.id === active)?.label ?? '')}</span></h1>
          {exploring && <button type="button" onClick={backToInsights} className="min-h-11 rounded-xl border border-focus/40 bg-surface px-4 text-focus">{uiText("← Back to your insights")}</button>}
          {(['experiments','views'] as const).map((tab,i)=><button key={tab} type="button" aria-controls="stats-tools" aria-expanded={toolsOpen&&toolTab===tab} onClick={()=>openTool(tab)} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">{uiText(['Experiments','Saved views'][i])}</button>)}
          <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)} aria-label={filtersOpen?uiText("Close filters"):uiText("Adjust filters")} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-medium"><svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5H18M2 15H18"/><circle cx="7" cy="5" r="2" fill="var(--tf-surface)"/><circle cx="13" cy="15" r="2" fill="var(--tf-surface)"/></svg>{filtersOpen?uiText("Close filters"):uiText("Adjust filters")}</button>
        </div>
        <div aria-label={uiText("Current Stats filters")} className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{uiText("Showing")}</span>
          {!chips.length&&<span className="text-sm">{uiText("All dates · all subjects · all activities")}</span>}
          {chips.map((chip) => <button key={chip.label} type="button" title={chip.label} aria-label={uiText('Remove filter: {filter}',{filter:chip.label})} onClick={chip.clear} className="flex max-w-72 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm"><span className="truncate">{chip.label}</span><span aria-hidden="true">×</span></button>)}
          {filtering && <button type="button" onClick={() => setFilter({ itemId: null, categoryId: null, activity: null })} className="px-3 text-sm text-muted">{uiText("Clear subject filters")}</button>}
        </div>
        {filtersOpen && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <select aria-label={uiText("Dates")} className={selectClass} value={range} onChange={(e) => setRange(e.target.value as Range)}>{RANGES.map((r) => <option key={r.id} value={r.id}>{uiText(r.label)}</option>)}</select>
          {range === 'custom' && <><input aria-label={uiText("From date")} type="date" className={selectClass} value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((v) => ({ ...v, from: e.target.value > v.to ? v.to : e.target.value }))} /><input aria-label={uiText("To date")} type="date" className={selectClass} value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((v) => ({ ...v, to: e.target.value < v.from ? v.from : e.target.value }))} /></>}
          <select aria-label={uiText("Subject")} className={selectClass + ' max-w-72'} value={filter.itemId ?? ''} onChange={(e) => setFilter((f) => ({ ...f, itemId: e.target.value ? Number(e.target.value) : null }))}><option value="">{uiText("All subjects")}</option>{filter.itemId!==null&&!items.some(i=>i.id===filter.itemId)&&<option value={filter.itemId}>{uiText("Unavailable subject #")}{filter.itemId}</option>}{items.filter((i) => !i.archived || i.id === filter.itemId).map((i) => <option key={i.id} value={i.id}>{i.name}{i.archived ? uiText(" (archived)") : ''}</option>)}</select>
          <select aria-label={uiText("Category")} className={selectClass + ' max-w-60'} value={filter.categoryId ?? ''} onChange={(e) => setFilter((f) => ({ ...f, categoryId: e.target.value ? Number(e.target.value) : null }))}><option value="">{uiText("All categories")}</option>{filter.categoryId!==null&&!tree.some(n=>n.category.id===filter.categoryId)&&<option value={filter.categoryId}>{categories.find(c=>c.id===filter.categoryId)?.name??'Unavailable category'}{uiText(" (saved filter)")}</option>}{tree.map((n) => <option key={n.category.id} value={n.category.id}>{n.depth ? '  ' : ''}{n.category.name}</option>)}</select>
          <select aria-label={uiText("Activity")} className={selectClass + ' max-w-60'} value={filter.activity ?? ''} onChange={(e) => setFilter((f) => ({ ...f, activity: e.target.value || null }))}><option value="">{uiText("All activities")}</option>{filter.activity&&!activityField?.options.some(o=>o.id===filter.activity)&&<option value={filter.activity}>{filter.activity}{uiText(" (saved filter)")}</option>}{activityField?.options.filter((o) => !o.archived || o.id === filter.activity).map((o) => <option key={o.id} value={o.id}>{o.label}{o.archived ? uiText(" (archived)") : ''}</option>)}</select>
          <Switch label={uiText("Include untouched sliders")} hint={uiText("Include ratings left at their default.")} on={options.includeUntouched} onChange={(v) => setOptions((o) => ({ ...o, includeUntouched: v }))} />
        </div>}

        <nav aria-label={uiText("Stats sections")} className="stats-primary-nav">{groups.map(group=><button key={group.label} type="button" aria-current={group.ids.includes(active)?'page':undefined} onClick={()=>jump(group.ids[0])}>{uiText(group.label)}</button>)}</nav>
        {active!=='insights'&&active!=='report'&&<nav className="stats-secondary-nav" aria-label={uiText('Go to Stats section')}>{SECTIONS.filter(s=>groups.find(g=>g.ids.includes(active))?.ids.includes(s.id)).map(s=><button key={s.id} type="button" aria-current={active===s.id?'page':undefined} onClick={()=>jump(s.id)}>{uiText(s.label)}</button>)}</nav>}

      </div>
      <div className="stats-content flex flex-col gap-6 px-6 pt-3 pb-16">
        {error ? <div role="alert" className="rounded-2xl border border-line bg-surface p-6"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 text-focus">{uiText("Try again")}</button></div> : !ctx ? <p className="text-lg text-muted">{uiText("Reading your sessions…")}</p> : <><StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='insights'}><RecordedDashboard ctx={ctx} today={today} hasHistory={!!built?.sessions.length} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}}/><AnalysisAnnouncement pending={!personal&&!analysisFailed} failed={analysisFailed}/><div className="mt-6" data-stats-analysis aria-busy={!personal&&!analysisFailed}>{personal?<PersonalOverview onRestoreScope={restoreDiscoveryScope} scope={JSON.stringify({range,custom:range==='custom'?custom:null,filter,options})} scopeLabel={range+' · '+(items.find(i=>i.id===filter.itemId)?.name??'All selected subjects')+' · '+(filter.activity??'All selected activities')+(filter.categoryId?' · category '+filter.categoryId:'')+(options.includeUntouched?' · includes suggested answers':' · confirmed answers')} today={today} result={personal} onJump={jump} onExperiment={experiment}/>:<AnalysisStatus failed={analysisFailed} retry={retryAnalysis}/>}</div></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='weekly'}><WeeklyStats reviewSessions={anyDate} scope="Current subject/category/activity filters" all={built!.sessions} factors={built!.factors} today={today} weekStartsOn={settings.weekStartsOn} onExperiments={()=>openTool('experiments')}/></StatsPanel>
        <div className="flex flex-col gap-4" data-stats-sections>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='overview'}><OverviewSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='subjects'}><SubjectsSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='factors'}><FactorsSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='setup'}><BestSetupSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='time'}><TimeSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='rhythm'}><StudyRhythmSection raw={raw!} today={today} /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='distractions'}><DistractionsSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='rest'}><RestSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='methods'}><MethodsSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='stage'}><StageSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='modes'}><ModesSection /></StatsPanel>
          <StatsPanel ctx={ctx} exploring={exploring} restoredOutcome={restoredOutcome} onFilters={()=>{setFiltersOpen(true);document.getElementById("stats-scroll")?.scrollTo({top:0})}} active={active==='report'}><ReportSection all={anyDate} factors={built!.factors} options={options} itemName={ctx.itemName} sleepHours={sleepHours} sleepFieldKey={sleepFieldId===undefined?undefined:`field:${sleepFieldId}`} activityLabel={ctx.activityLabel} reasonLabel={ctx.reasonLabel}/></StatsPanel>
        </div></>}
      </div>
    </div>{ctx&&<StudyTools open={toolsOpen} tab={toolTab} onTab={setToolTab} onClose={()=>setToolsOpen(false)} all={built?.sessions??[]} filtered={sessions} factors={built?.factors??[]} today={today} weekStartsOn={settings.weekStartsOn} view={{range,custom,filter,options}} onApply={(v)=>{setRange(v.range);setCustom(v.custom);setFilter(v.filter);setOptions(v.options);setRestoredOutcome(previous=>({outcome:v.outcome,revision:(previous?.revision??0)+1}))}}/>}</div>
  )
}

/** Freeze the complete local context along with an inactive section's props. */
function StatsPanel({active,ctx,exploring,restoredOutcome,onFilters,children}:{active:boolean;ctx:StatsContextValue;exploring:PersonalInsight|null;restoredOutcome:{outcome:OutcomeKey;revision:number}|null;onFilters:()=>void;children:ReactNode}):React.JSX.Element {
  return <RetainedPanel active={active}>
    <RestoredOutcomeContext.Provider value={restoredOutcome}>
      <InsightContext.Provider value={exploring}>
        <StatsContext.Provider value={ctx}>
          <StatsEmptyContext.Provider value={{empty:!ctx.sessions.length,onFilters}}>{children}</StatsEmptyContext.Provider>
        </StatsContext.Provider>
      </InsightContext.Provider>
    </RestoredOutcomeContext.Provider>
  </RetainedPanel>
}

function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button type="button" role="switch" aria-checked={on} title={hint} onClick={() => onChange(!on)} className="flex items-center gap-3 text-base">
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-focus' : 'bg-surface-2 ring-1 ring-line'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-surface shadow transition-[left] ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
      <span className={on ? 'text-ink' : 'text-muted'}>{label}</span>
    </button>
  )
}
