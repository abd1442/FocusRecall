import { PreparationPanel } from '../components/PreparationPanel'
import { t as uiText, useLanguage } from '../i18n'
import type { Preparation } from '@core/preparation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { distractedSince } from '@core/session'
import { SessionBar } from '../components/SessionBar'
import { floatingFocusClock } from '@core/floatingTimer'
import { CircularTimer, type RingTone } from '../components/CircularTimer'
import { TimerValue } from '../components/TimerValue'
import { formatClock } from '@core/timer'
import { useAppearance, setPanelPreparationScale } from '../store/appearance'
import type { PickerItem } from '@core/types'
import { useNow } from '../hooks'
import { useSession, useSettings } from '../store/session'
import './floatingPanel.css'

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
/** A button hint with its hotkey, if one is set. */
const hint = (text: string, key: string): string => (key ? `${uiText(text)} (${key})` : uiText(text))
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

/**
 * The floating control panel appears without activating. Explicit clicks can
 * focus its controls. Drag the timer area, outside its buttons, to move it.
 */
export function FloatingPanel(): React.JSX.Element {
  useLanguage()
  const [preparation,setPreparation]=useState<Preparation|null>(null)
  useEffect(()=>{let live=true,changed=false;const off=window.api.on('preparation:changed',p=>{changed=true;if(live)setPreparation(p)});void window.api.invoke('preparation:get').then(p=>{if(live&&!changed)setPreparation(p)});return()=>{live=false;off()}},[])
  useLayoutEffect(()=>{setPanelPreparationScale(preparation!==null);return()=>setPanelPreparationScale(false)},[preparation!==null])
  const state = useSession((s) => s.state)
  const settings = useSettings((s) => s.settings)
  const quick=settings.studyExperience==='quick',inFlight=useRef(false)
  const expanded = settings.panelExpanded
  const now = useNow(state.running !== null || state.rest?.phase === 'running')
  const lastItem = useLastItem(settings.lastItemId, state.stage)
  const appearance = useAppearance((s) => s.appearance)
  const circular = appearance.panelTimerDisplay === 'circular'
  // A stuck or resisted hotkey shows here for a moment, nothing more.
  const [marked, setMarked] = useState<string | null>(null)
  useEffect(
    () =>
      window.api.on('capture:marked', ({ kind }) => {
        setMarked(kind === 'resisted' ? 'Resisted +1' : 'Marked: stuck here')
        setTimeout(() => setMarked(null), 1800)
      }),
    []
  )


  const call = (fn: () => Promise<unknown>) => async () => {
    if(inFlight.current)return
    inFlight.current=true
    try {
      await fn()
    } catch {
      // The panel cannot show dialogs without taking focus; let the main window explain.
      await window.api.invoke('window:showMain')
    }finally{inFlight.current=false}
  }
  const openMain = call(() => window.api.invoke('window:showMain'))

  if(preparation)return <PreparationPanel preparation={preparation}/>

  // One view model for both timer styles. Stage colours belong to the ring and
  // progress line; digits stay in the theme's ink so they read at panel sizes.
  let tone: RingTone = 'idle'
  let value = ''
  let caption = ''
  let progress = 0
  let ringLabel: string | undefined
  let subject = ''
  let subjectColor = 'var(--tf-muted)'
  let dim = false
  let line: React.ReactNode = null
  let buttons: React.ReactNode = null

  if(quick&&state.recovery){
    value=uiText('Paused');ringLabel=value;subject=state.recovery.itemName
    buttons=<PanelButton onClick={openMain}>{uiText('Open A14 Pomodoro')}</PanelButton>
  }else if (state.running) {
    const b = state.running
    const c = floatingFocusClock(b, now, appearance.panelTimerDisplay)
    const since = distractedSince(b)
    const distracted = since !== null
    tone = c.overtime ? 'overtime' : 'focus'
    value = c.main
    progress = c.progress
    dim = distracted
    const target = formatClock(b.targetSeconds)
    caption = distracted
      ? uiText('away {value0}', { value0: formatClock((now - Date.parse(since)) / 1000) })
      : c.overtime ? uiText('over {value0}', { value0: target }) : uiText('of {value0}', { value0: target })
    subject = marked ? uiText(marked) : b.itemName
    subjectColor = b.itemColor
    line = <SessionBar block={b} now={now} accent="" className="fp-line" />
    buttons = (
      <>
        <PanelButton
          onClick={call(() => window.api.invoke('session:toggleDistracted'))}
          title={hint(distracted ? 'Back to studying' : 'Distracted: stop the clock', settings.hotkeyDistracted)}
          active={distracted}
          grow={1.3}
        >
          {distracted ? uiText("Back") : uiText("Distracted")}
        </PanelButton>
        <PanelButton onClick={call(() => window.api.invoke('ui:openSwitch'))} title={hint('Switch subject; the session goes on', settings.hotkeySwitch)}>{uiText("Switch")}</PanelButton>
        <PanelButton
          primary
          accent={`var(--fr-stage-${tone})`}
          ink={`var(--fr-stage-${tone}-on)`}
          title={uiText("Finish the session")}
          onClick={call(async () => {
            if(quick)await window.api.invoke('session:quickAction','finish',b.id)
            else await window.api.invoke('session:finish')
            if(!quick)await window.api.invoke('panel:close')
          })}
        >{uiText("Finish")}</PanelButton>
      </>
    )
    if(quick&&distracted)buttons=<>
      {/* Paused: Resume stays under the cursor and becomes the main action; Break is the optional one. */}
      <PanelButton primary accent="var(--tf-focus)" onClick={call(()=>window.api.invoke('session:toggleDistracted'))}>{uiText('Resume')}</PanelButton>
      <PanelButton title={uiText('Save and take a break')} onClick={call(()=>window.api.invoke('session:quickAction','break',b.id))}>{uiText('Break')}</PanelButton>
      <PanelButton onClick={call(()=>window.api.invoke('session:quickAction','finish',b.id))}>{uiText('Finish')}</PanelButton>
    </>
  } else if (state.stage === 'rest' && state.rest) {
    const r = state.rest
    const left = r.endsAt ? Math.max(0, (Date.parse(r.endsAt) - now) / 1000) : r.plannedSeconds
    const running = r.phase === 'running'
    tone = 'rest'
    value = r.phase === 'over' ? uiText('Rest over') : formatClock(left)
    if (r.phase === 'over') ringLabel = value
    progress = running ? 1 - left / r.plannedSeconds : r.phase === 'over' ? 1 : 0
    caption = running ? uiText('of {value0}', { value0: formatClock(r.plannedSeconds) }) : ''
    subject = uiText(r.phase === 'plan' ? 'Rest is ready to start' : r.long ? 'Long rest' : 'Rest')
    subjectColor = 'var(--fr-stage-rest)'
    if (running) line = <div className="fp-line fp-line-track"><div className="fp-line-fill" style={{ width: `${progress * 100}%`, background: 'var(--fr-stage-rest)' }} /></div>
    buttons = (
      <>
        {running && <PanelButton onClick={call(() => window.api.invoke('rest:endEarly'))}>{uiText("End rest")}</PanelButton>}
        <PanelButton primary accent="var(--tf-focus)" onClick={call(() => window.api.invoke('rest:startNextBlock'))}>{uiText("Start next session")}</PanelButton>
      </>
    )
    if(quick){
      if(r.phase==='over'){value=uiText('Break over');ringLabel=value}
      subject=uiText('Break')
      buttons=<><PanelButton primary accent="var(--tf-focus)" onClick={call(()=>window.api.invoke('rest:startNextBlock'))}>{uiText('Resume')}</PanelButton><PanelButton onClick={call(()=>window.api.invoke('session:finishStudying'))}>{uiText('Finish')}</PanelButton></>
    }
  } else if (state.stage === 'recall') {
    const f = state.finished[state.finished.length - 1]
    tone = 'recall'
    value = uiText('Recall')
    ringLabel = value
    progress = 0
    subject = f ? f.itemName : ''
    subjectColor = f?.itemColor ?? 'var(--fr-stage-recall)'
    buttons = <PanelButton primary accent="var(--fr-stage-recall)" ink="var(--fr-stage-recall-on)" onClick={openMain}>{uiText("Open A14 Pomodoro")}</PanelButton>
  } else {
    value = uiText('Ready')
    ringLabel = value
    subject = lastItem ? lastItem.name : uiText('Pick an item in A14 Pomodoro')
    subjectColor = lastItem?.color ?? 'var(--tf-muted)'
    buttons = (
      <>
        {lastItem && (
          <PanelButton primary accent="var(--tf-focus)" onClick={call(() => window.api.invoke('preparation:begin',null))}>{uiText("Start")}</PanelButton>
        )}
        <PanelButton onClick={openMain}>{uiText("Open A14 Pomodoro")}</PanelButton>
      </>
    )
  }
  const timed = /\d/.test(value)
  const live = state.running !== null || state.rest?.phase === 'running'

  const controls = (
    <div className="fp-controls" style={noDrag}>
      <button
        type="button"
        title={expanded ? uiText("Compact") : uiText("Expand")}
        aria-label={expanded ? uiText("Compact panel") : uiText("Expand panel")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => window.api.invoke('settings:set', 'panelExpanded', !expanded)}
        className="fp-icon"
        style={noDrag}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {expanded ? <path d="M3.5 10l4.5-4.5 4.5 4.5" /> : <path d="M3.5 6l4.5 4.5 4.5-4.5" />}
        </svg>
      </button>
      <button
        type="button"
        title={uiText("Close the panel")}
        aria-label={uiText("Close the panel")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => window.api.invoke('panel:close')}
        className="fp-icon"
        style={noDrag}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </div>
  )
  const subjectLine = (
    <div className="fp-subject" title={subject}>
      <span aria-hidden="true" className="fp-dot" style={{ background: subjectColor }} />
      {quick&&state.running?<button type="button" className="fp-switch" style={noDrag} onMouseDown={e=>e.preventDefault()} onClick={call(()=>window.api.invoke('ui:openSwitch'))} title={uiText('Switch subject; the session goes on')} aria-label={uiText('Switch subject; the session goes on')}><span dir="auto" className="fp-subject-text">{subject}</span><svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5l4 4 4-4"/></svg></button>:<span dir="auto" className={`fp-subject-text ${dim ? 'text-overtime' : marked ? 'text-rest' : ''}`}>{subject}</span>}
    </div>
  )

  return (
    <div
      className={`floating-panel h-viewport rounded-2xl border border-line bg-surface select-none ${circular ? 'fp-circular' : 'fp-digital'}`}
      data-expanded={expanded}
      data-quick={quick||undefined}
      data-tone={tone}
      data-dim={dim || undefined}
      style={noDrag}
      onMouseEnter={() => window.api.invoke('panel:hover', true)}
      onMouseLeave={() => window.api.invoke('panel:hover', false)}
    >
      {circular ? (
        <div className="fp-stage" style={drag}>
          {controls}
          <CircularTimer value={value} caption={caption} progress={progress} tone={tone} dim={dim} size={expanded ? 'panel' : 'compact'} label={ringLabel} />
          {subjectLine}
        </div>
      ) : (
        <div className="fp-stage" style={drag}>
          <div className="fp-head">{subjectLine}{controls}</div>
          <div className="fp-readout" dir="ltr">
            <TimerValue value={value} fit={!timed} className={`fp-digits font-timer tabular-nums ${timed ? '' : 'fp-word'}`} role={live ? 'timer' : undefined} />
            {caption && <span dir="auto" className="fp-aside">{caption}</span>}
          </div>
          {line}
        </div>
      )}
      {expanded && <div className="fp-actions" style={noDrag}>{buttons}</div>}
    </div>
  )
}

function PanelButton({
  children,
  onClick,
  primary,
  accent,
  ink,
  disabled,
  title,
  active,
  grow = 1
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
  accent?: string
  /** Text colour on a stage-coloured button (the accent's own text colour otherwise). */
  ink?: string
  disabled?: boolean
  title?: string
  /** Shown as switched on (Distracted). */
  active?: boolean
  /** Share of the row (Distracted is the longest word). */
  grow?: number
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`fp-btn ${primary ? 'fp-btn-primary' : ''}`}
      data-active={active || undefined}
      style={{ ...noDrag, flex: `${grow} 1 auto`, ...(primary ? { background: accent, ...(ink ? { color: ink } : {}) } : {}) }}
    >
      {children}
    </button>
  )
}

/** The last item studied, for the idle Start button. */
function useLastItem(lastItemId: number | null, stage: string): PickerItem | null {
  const [item, setItem] = useState<PickerItem | null>(null)
  useEffect(() => {
    if (lastItemId === null) {
      setItem(null)
      return
    }
    void window.api
      .invoke('library:listPickerItems')
      .then((items) => setItem(items.find((i) => i.id === lastItemId) ?? null))
  }, [lastItemId, stage])
  return item
}
