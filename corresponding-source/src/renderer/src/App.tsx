import { useAppearance } from './store/appearance'
import { t as uiText, useLanguage } from './i18n'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { distractedSince, sessionFocusSeconds } from '@core/session'
import { clockDisplay } from '@core/modes'
import { formatClock } from '@core/timer'
import './store/appearance'
import './store/blocks'
import { useLibrary } from './store/library'
import { useSession, useSettings } from './store/session'
import { QuickStudy } from './screens/QuickStudy'
import { SwitchDialog } from './components/SwitchDialog'
import { useUi, type Tab } from './store/ui'
import { useNow } from './hooks'
import { playChime } from './sound'
import { HistoryTab } from './tabs/History'
import { HomeTab } from './tabs/Home'
import { StatsTab } from './tabs/Stats'
import { LibraryTab } from './tabs/Library'
import { BetweenBlocksScreen } from './screens/BetweenBlocks'
import { SettingsTab } from './tabs/Settings'
import { FocusScreen } from './screens/Focus'
import { AfterFocusScreen } from './screens/AfterFocus'
import { RecoveryScreen } from './screens/Recovery'
import { RestScreen } from './screens/Rest'
import { WorkflowRecovery } from './components/WorkflowRecovery'
import { AppVersion } from './components/AppVersion'
import { StarterGuide } from './components/StarterGuide'
const LearnTab=lazy(()=>import('./tabs/Learn'))

export function App(): React.JSX.Element {
  useLanguage()
  const { tab, between, showBetween, setTab } = useUi()
  const { state, loaded } = useSession()
  const quick=useSettings(s=>s.settings.studyExperience==='quick')
  const [quickSwitch,setQuickSwitch]=useState(false)
  useEffect(()=>window.api.on('ui:openSwitch',()=>{if(quick)setQuickSwitch(true)}),[quick])
  useEffect(()=>setQuickSwitch(false),[quick,state.running?.sessionId])
  const sittingOpen = state.sitting !== null
  const contentRef = useRef<HTMLDivElement>(null)
  const lastContentFocus = useRef<HTMLElement | null>(null)
  const view = state.recovery ? 'recovery' : quick&&state.stage!=='recall'?`${tab}-${state.stage}`:state.running ? 'focus' : state.stage === 'recall' ? `recall-${state.step}` : state.stage === 'rest' ? `rest-${state.rest?.phase}` : between && sittingOpen ? 'between' : tab
  const previousView = useRef(view)
  useLayoutEffect(() => {
    const changed = previousView.current !== view
    previousView.current = view
    if (!loaded || !contentRef.current) return
    // A removed workflow control otherwise leaves focus on body. Preserve a
    // surviving navigation control, dialog, or deliberate input autofocus.
    const restore = (): boolean => {
      if (document.activeElement !== document.body) return true
      const heading = contentRef.current?.querySelector<HTMLElement>('h1, h2')
      if (!heading) return false
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      return true
    }
    if (changed) restore()
    // Some substeps load asynchronously or replace a prompt without changing
    // the session stage. Only repair focus when its previous node disappeared.
    const observer = new MutationObserver(() => {
      if (lastContentFocus.current && !lastContentFocus.current.isConnected) restore()
    })
    observer.observe(contentRef.current, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [view, loaded])

  useEffect(() => {
    void useLibrary.getState().refresh()
    const offTarget = window.api.on('session:targetReached', () => playChime())
    const offRest = window.api.on('session:restOver', () => playChime())
    const offHome=window.api.on('ui:openHome',()=>useUi.getState().exitToHome())
    return () => {
      offTarget()
      offRest()
      offHome()
    }
  }, [])

  // After a session (recall and log done), show the between-sessions step.
  const lastStage = useRef(state.stage)
  const lastActiveSession = useRef<number|null>(null)
  useEffect(() => {
    const activeId=state.running?.sessionId??state.finished[0]?.sessionId
    if(activeId!==undefined)lastActiveSession.current=activeId
    if (lastStage.current !== 'idle' && state.stage === 'idle') {
      const deferred=state.unfinished.some(work=>work.deferred&&work.sessionId===lastActiveSession.current)
      if (state.sitting&&!quick&&!deferred) showBetween()
      else setTab('home')
    }
    lastStage.current = state.stage
  }, [state.stage, state.sitting, showBetween, setTab,quick])

  if (!loaded) return <div role="status" className="h-viewport p-8">{uiText('Loading…')}</div>

  let content: React.ReactNode
  if (state.recovery) content = <RecoveryScreen prompt={state.recovery} />
  else if (state.running&&!quick) content = <FocusScreen block={state.running} />
  else if (state.stage === 'recall') content = <AfterFocusScreen finished={state.finished} step={state.step} />
  else if (!quick&&state.stage === 'rest' && state.rest) content = <RestScreen rest={state.rest} />
  else if (!quick&&between && sittingOpen) content = <BetweenBlocksScreen />
  else if (tab === 'history') content = <HistoryTab />
  else if (tab === 'stats') content = <StatsTab />
  else if (tab === 'library') content = <LibraryTab />
  else if (tab === 'settings') content = <SettingsTab />
  else if (tab === 'learn') content = <Suspense fallback={<div role="status" className="p-8">{uiText('Loading…')}</div>}><LearnTab/></Suspense>
  else content = quick?<QuickStudy/>:<HomeTab />

  // Stage screens (focus, recall, log, between sessions) take the whole window.
  const inStage = !!(state.recovery || state.stage==='recall'||!quick&&(state.running || state.stage === 'rest' || (between && sittingOpen)))

  return (
    <div className="flex h-viewport">
      <StarterGuide/>
      {quick&&quickSwitch&&state.running&&<SwitchDialog currentId={state.running.itemId} onClose={()=>setQuickSwitch(false)}/>}
      {!inStage && <Sidebar />}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {state.stage === 'idle' && !state.recovery && <WorkflowRecovery entries={state.unfinished} />}
        {inStage && (
          <div className="absolute top-4 right-6 z-30">
            <PanelToggle />
          </div>
        )}
        <div ref={contentRef} onFocusCapture={e => { lastContentFocus.current = e.target as HTMLElement }} className="min-h-0 flex-1">{content}</div>
      </main>
    </div>
  )
}

// --- Sidebar -----------------------------------------------------------------

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z" /> },
  { id: 'learn', label: 'Learn', icon: <><path d="M10 5C7 3 4 3 2 4v12c3-1 5-1 8 1 3-2 5-2 8-1V4c-2-1-5-1-8 1zM10 5v12"/></> },
  { id: 'history', label: 'History', icon: <><rect x="3" y="4" width="14" height="13" rx="1.5" /><path d="M3 8h14M7 2.5v3M13 2.5v3" /></> },
  { id: 'stats', label: 'Stats', icon: <path d="M3.5 16.5h13M5.5 13.5v-4M9 13.5V5M12.5 13.5V8.5M16 13.5V11" /> },
  { id: 'library', label: 'Library', icon: <path d="M4 3.5h3v13H4zM8.5 3.5h3v13h-3zM13 4.2l2.8-.7 2.4 12.6-2.8.7z" /> },
  { id: 'settings', label: 'Settings', icon: <><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></> }
]

function Sidebar(): React.JSX.Element {
  const tab=useUi(s=>s.tab),setTab=useUi(s=>s.setTab),openLibrary=useUi(s=>s.openLibrary)
  const {appearance:a,update}=useAppearance(),collapsed=a.sidebarCollapsed
  return <aside aria-label={uiText("Sidebar")} data-style={a.sidebarStyle} data-collapsed={collapsed} className="focusrecall-sidebar">
    <button type="button" onClick={()=>setTab('home')} aria-label={uiText("FocusRecall, go to Home")} title={uiText("FocusRecall, go to Home")} className="sidebar-brand"><Logo/><span>{uiText("FocusRecall")}</span></button>
    {a.sidebarStyle==='journal'&&<p className="sidebar-edition">{uiText("Your study companion")}</p>}
    <nav className="sidebar-nav" aria-label={uiText("Main")}>{NAV.map(n=><button key={n.id} type="button" title={uiText(n.label)} aria-label={uiText(n.label)} aria-current={tab===n.id?'page':undefined} onClick={()=>n.id==='library'?openLibrary({kind:'root'}):setTab(n.id)} className="sidebar-link"><svg viewBox="0 0 20 20" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{n.icon}</svg><span className="sidebar-label">{uiText(n.label)}</span></button>)}</nav>
    <div className="sidebar-bottom"><DemoBadge/><SittingStatus/><PanelToggle wide/><div className="sidebar-footer"><div className="sidebar-version"><AppVersion/></div><button type="button" title={collapsed?uiText("Expand sidebar"):uiText("Collapse sidebar")} aria-label={collapsed?uiText("Expand sidebar"):uiText("Collapse sidebar")} aria-expanded={!collapsed} onClick={()=>void update({sidebarCollapsed:!collapsed})} className="sidebar-collapse"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={collapsed?'m7 4 6 6-6 6':'m13 4-6 6 6 6'}/></svg><span className="sidebar-label">{uiText("Collapse")}</span></button></div></div>
  </aside>
}

/** A constant reminder when the demo database is open. */
function DemoBadge(): React.JSX.Element | null {
  const [demo, setDemo] = useState(false)
  const setTab = useUi((s) => s.setTab)
  useEffect(() => {
    void window.api.invoke('app:demo').then(setDemo)
  }, [])
  if (!demo) return null
  return (
    <button type="button" onClick={() => setTab('settings')} aria-label={uiText("Demo data. Not your own. Switch back in Settings.")} title={uiText("Demo data. Switch back in Settings.")} className="sidebar-demo rounded-xl border-2 border-dashed border-overtime px-4 py-2.5 text-left">
      <span className="block text-base font-semibold text-overtime">{uiText("Demo data")}</span>
      <span className="block text-sm text-muted">{uiText("Not your own. Switch back in Settings.")}</span>
    </button>
  )
}

/** Subject, state and time of the open sitting. */
function SittingStatus(): React.JSX.Element | null {
  const state = useSession((s) => s.state)
  const items = useLibrary((s) => s.items)
  const lastItemId = useSettings((s) => s.settings.lastItemId)
  const showBetween = useUi((s) => s.showBetween)
  const now = useNow(state.running !== null, 1000)
  if (!state.sitting) return null

  const b = state.running
  const item = items.find((i) => i.id === (b?.itemId ?? lastItemId))
  let line = uiText('Between sessions')
  let color = 'var(--fr-stage-rest-text)'
  if (b) {
    const c = clockDisplay(b.timerMode, b.targetSeconds, sessionFocusSeconds(b, now))
    line = distractedSince(b) ? uiText('Distracted') : `${uiText('Focus')} · ${c.main} · ${uiText('Target: ')}${formatClock(b.targetSeconds)}`
    color = c.overtime ? 'var(--fr-stage-overtime-text)' : 'var(--fr-stage-focus-text)'
  } else if (state.stage === 'recall') {
    line = uiText(state.step === 'log' ? 'logging' : 'Recall')
    color = 'var(--fr-stage-recall-text)'
  }

  return (
    <button type="button" onClick={showBetween} aria-label={uiText("{value0} · {value1}. Back to the sitting", {value0: (item?.name ?? uiText('No subject chosen')), value1: (line)})} title={uiText("{value0} · {value1}. Back to the sitting", {value0: (item?.name ?? uiText('No subject chosen')), value1: (line)})} className="sidebar-sitting flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-muted">
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className="size-2 rounded-full" style={{ background: color }} />{uiText("Sitting open")}</span>
      <span dir="auto" className="truncate text-base font-medium">
        {item?.name ?? uiText('No subject chosen')}
      </span>
      <span className="text-sm tabular-nums" style={{ color }}>
        {line}
      </span>
    </button>
  )
}

/** Owner-approved fused F/R and amber page from the FocusRecall logo system. */
function Logo(): React.JSX.Element {
  return (
    <img src={new URL('../../../resources/focusrecall-icon.png', import.meta.url).href} alt="" width={48} height={48} className="size-12 shrink-0" />
  )
}

/** Opens or closes the floating panel. */
function PanelToggle({ wide = false }: { wide?: boolean }): React.JSX.Element {
  const open = useSettings((s) => s.settings.panelOpen)
  return (
    <div className="flex items-center gap-1"><button
      type="button"
      onClick={() => window.api.invoke('panel:toggle')}
      title={open ? uiText("Close the floating panel") : uiText("Open the floating panel")}
      aria-label={open ? uiText("Close the floating panel") : uiText("Open the floating panel")}
      aria-pressed={open}
      className={`${wide ? 'sidebar-panel' : ''} inline-flex items-center rounded-xl px-4 transition-colors ${wide ? 'min-h-14 w-full gap-4 text-lg' : 'min-h-11 gap-2.5 text-base'} ${
        open ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <svg viewBox="0 0 16 16" width={wide ? 22 : 18} height={wide ? 22 : 18} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
        <rect x="8" y="4.5" width="4.5" height="3.5" rx="0.6" fill={open ? 'currentColor' : 'none'} />
      </svg>
      <span className={wide?'sidebar-label':undefined}>{open ? uiText("Panel open") : uiText("Panel")}</span>
    </button><button type="button" className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" title={uiText('Focus timer controls')} aria-label={uiText('Focus timer controls')} onClick={()=>window.api.invoke('panel:focus')}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h2m2 0h2m2 0h2m2 0h1M6 13h2m2 0h2m2 0h4"/></svg></button></div>
  )
}
