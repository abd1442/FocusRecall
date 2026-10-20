import { t as uiText, formatTime, count } from '../i18n'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ParkedThoughts } from '../components/ParkedThoughts'
import { HeatMap } from '../components/HeatMap'
import { DayCheckinCard } from '../components/DayCheckin'
import { ItemPicker } from '../components/ItemPicker'
import { SetupCard } from '../components/SetupCard'
import { useGoalDraft } from '../components/TimerControls'
import { useLibrary } from '../store/library'
import { Button } from '../components/ui'
import { useBlocks } from '../store/blocks'
import { useNextBlockPlan } from '../store/plan'
import { sessionCommand, useSession, useSettings } from '../store/session'
import { useStudyDay } from '../store/studyDay'
import { useLocalCalendarDay } from '../hooks/useLocalCalendarDay'
import { showTodayCheck } from '@core/homePreferences'
import type { PickerItem } from '@core/types'

/** Today's study day key, following the day-start setting. */
export function useToday(): string {
  return useStudyDay((s) => s.day)
}

/**
 * Home, in zones: today's numbers and the daily check-in on top, the subjects
 * and compact year map on the left, with session setup on the right.
 */
export function HomeTab(): React.JSX.Element {
  const [adaptiveOverride, setAdaptiveOverride] = useState<number | null>(null)
  const plan = useNextBlockPlan(adaptiveOverride)
  const sitting = useSession((s) => s.state.sitting)
  const [goal, setGoal] = useGoalDraft()
  const today = useToday()
  const calendarDay = useLocalCalendarDay()
  const settings = useSettings(s=>s.settings)
  const checkVisible = showTodayCheck(settings.showTodayCheck,settings.todayCheckSkippedDate,calendarDay)
  const subjects=useLibrary(s=>s.items).filter(i=>!i.archived)
  const [orderedSubjects,setOrderedSubjects]=useState<PickerItem[]>([])
  const [createRequest,setCreateRequest]=useState(0)
  const [timerOptionsOpen,setTimerOptionsOpen]=useState(false)
  const quickStart=useRef<HTMLElement>(null),optionsButton=useRef<HTMLButtonElement>(null)
  useEffect(()=>{
    if(!timerOptionsOpen)return
    const outside=(e:PointerEvent):void=>{if(e.target instanceof Node&&!quickStart.current?.contains(e.target)&&!document.querySelector('dialog[open], [role=dialog][aria-modal=true]'))setTimerOptionsOpen(false)}
    const escape=(e:KeyboardEvent):void=>{if(e.key==='Escape'&&!e.defaultPrevented&&!document.querySelector('dialog[open], [role=dialog][aria-modal=true]')){e.preventDefault();setTimerOptionsOpen(false);optionsButton.current?.focus()}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[timerOptionsOpen])
  const viewport=useRef<HTMLDivElement>(null),workspace=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    const view=viewport.current,grid=workspace.current
    if(!view||!grid)return
    const layout=grid.parentElement!
    const update=():void=>{
      // Measure the available column in layout pixels, including interface zoom.
      // This is a minimum, so subjects can grow and push the calendar down.
      const bounds=view.getBoundingClientRect(),scale=bounds.height/view.clientHeight||1
      const offset=(grid.getBoundingClientRect().top-bounds.top)/scale+view.scrollTop
      const bottom=parseFloat(getComputedStyle(layout).paddingBottom)||0
      const height=Math.max(0,view.clientHeight-offset-bottom).toFixed(2)+'px'
      if(grid.style.getPropertyValue('--home-column-height')!==height)grid.style.setProperty('--home-column-height',height)
    }
    const observer=new ResizeObserver(update)
    observer.observe(view);observer.observe(layout);update()
    return()=>observer.disconnect()
  },[])

  const start = async (): Promise<void> => {
    if (!plan.subject) return
    await sessionCommand(() =>
      window.api.invoke('preparation:begin', { itemId: plan.subject!.id, timerMode: plan.mode, targetSeconds: plan.targetSeconds, goal: goal.trim() || null })
    )
  }

  return (
    <div ref={viewport} className="home-root h-full overflow-y-auto" style={{containerType:'inline-size',containerName:'home'}}>
      <section ref={quickStart} aria-label={uiText("Quick start")} className="home-quick-start sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">{subjects.length?<select aria-label={uiText("Quick start subject")} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3" value={plan.subject?.id??''} onChange={e=>{plan.setSubject(Number(e.target.value));setAdaptiveOverride(null)}}><option value="" disabled>{uiText("Choose a subject")}</option>{(orderedSubjects.length?orderedSubjects:subjects).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>:<Button variant="primary" onClick={()=>setCreateRequest(n=>n+1)}>{uiText("Add your first subject")}</Button>}<Button variant="primary" disabled={!plan.subject} onClick={start}>{sitting?uiText("Start next session"):uiText("Start")}</Button><button ref={optionsButton} type="button" aria-expanded={timerOptionsOpen} aria-controls="home-timer-options" className="min-h-11 rounded-lg px-3 text-sm text-focus" onClick={()=>setTimerOptionsOpen(v=>!v)}>{uiText("Timer options ")}<span aria-hidden="true">{timerOptionsOpen?'▴':'▾'}</span></button>{timerOptionsOpen&&<div id="home-timer-options" role="region" aria-label={uiText("Timer options")} className="absolute top-full right-4 left-4 mt-2 ml-auto w-auto max-w-lg shadow-xl"><SetupCard compact plan={plan} adaptiveOverride={adaptiveOverride} setAdaptiveOverride={setAdaptiveOverride} goal={goal} setGoal={setGoal} onStart={start} startLabel={sitting?'Start next session':'Start'}/></div>}</section>
      <div className="home-layout flex min-h-full flex-col gap-6 px-8 py-6">
        {sitting && (
          <div className="flex shrink-0 items-center gap-3 text-base text-muted">
            <span className="size-2 rounded-full bg-rest" />
            <span className="flex-1">{uiText("Sitting in progress since ")}{formatTime(new Date(sitting.startedAt), { hour: '2-digit', minute: '2-digit' })} ·{' '}
              {count(sitting.blockCount,'session')}{uiText(". Start continues it.")}</span>
            <Button variant="ghost" size="sm" onClick={() => sessionCommand(() => window.api.invoke('session:endSitting'))}>{uiText("End sitting")}</Button>
          </div>
        )}
        {checkVisible&&<div className="shrink-0" data-today-check>{subjects.length?<DayCheckinCard day={today}/>:<details><summary className="cursor-pointer text-sm text-muted">{uiText("Optional daily check-in")}</summary><DayCheckinCard day={today}/></details>}</div>}

        <div ref={workspace} className="home-workspace grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_27rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
          <div className="home-subjects flex min-w-0 flex-col gap-4" style={{minHeight:'var(--home-column-height, 0px)'}}>
            <h1 className="text-4xl font-light tracking-tight">{subjects.length?uiText("What are you studying?"):uiText("Add your first subject")}</h1>{!subjects.length&&<p className="text-muted">{uiText("A course, book, skill or anything you want to learn.")}</p>}
            <ItemPicker
              homeOrdering
              onOrder={setOrderedSubjects}
              createRequest={createRequest}
              layout="tiles"
              autoFocus
              selectedId={plan.subject?.id ?? null}
              onSelect={(i) => {
                setAdaptiveOverride(null)
                plan.setSubject(i.id)
              }}
              onConfirm={start}
            />
            <div className="mt-auto pt-3">
              <YearCard />
            </div>
          </div>

          <aside id="home-launcher" className="home-launcher flex scroll-mt-24 flex-col gap-6">
            <SetupCard
              plan={plan}
              adaptiveOverride={adaptiveOverride}
              setAdaptiveOverride={setAdaptiveOverride}
              goal={goal}
              setGoal={setGoal}
              onStart={start}
              startLabel={sitting ? 'Start next session' : 'Start'}
            />
            <ParkedThoughts />
          </aside>
        </div>

      </div>
    </div>
  )
}

/** Bottom of the visible left column; additional subjects push it down in flow. */
function YearCard(): React.JSX.Element {
  const blocks = useBlocks((s) => s.blocks)
  return <HeatMap blocks={blocks} minimal />
}
