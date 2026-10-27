import { t as uiText , currentLanguage , formatTime } from '../i18n'
import { subjectPanelStyle } from '../components/SubjectPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryPathLabel } from '@core/library'
import { newestFirst } from '@core/stats'
import { BlockRows, Card, Stats, timeOrDash } from '../components/overview'
import { ItemPicker } from '../components/ItemPicker'
import { Button, Dialog } from '../components/ui'
import { useBlocks } from '../store/blocks'
import { useLibrary } from '../store/library'
import { useNextBlockPlan } from '../store/plan'
import { GoalField, LengthForMode, ModeControl, useGoalDraft } from '../components/TimerControls'
import { sessionCommand, useSession } from '../store/session'
import { useUi } from '../store/ui'
import { AdviceCard } from '../components/AdviceCard'

/**
 * Between sessions: a step in the flow, shown after the log and after the
 * rest. Nothing starts until Start is pressed.
 */
export function BetweenBlocksScreen(): React.JSX.Element | null {
  const sitting = useSession((s) => s.state.sitting)
  const [adaptiveOverride, setAdaptiveOverride] = useState<number | null>(null)
  const plan = useNextBlockPlan(adaptiveOverride)
  const [goal, setGoal] = useGoalDraft()
  const categories = useLibrary((s) => s.categories)
  const blocks = useBlocks((s) => s.blocks)
  const exitToHome = useUi((s) => s.exitToHome)
  const [changing, setChanging] = useState<'subject' | null>(null)
  const sittingBlocks = useMemo(() => newestFirst(blocks.filter((b) => b.sittingId === sitting?.id)), [blocks, sitting?.id])
  const subject = plan.subject
  const starting = useRef(false)

  const start = async (force = false): Promise<void> => {
    if (starting.current) return
    if (!subject) {
      setChanging('subject')
      return
    }
    starting.current = true
    try {
      const input = { itemId: subject.id, timerMode: plan.mode, targetSeconds: plan.targetSeconds, goal: goal.trim() || null }
      await sessionCommand(async () => {
        if (force) await window.api.invoke('preparation:begin', input, true)
        else await window.api.invoke('session:start', input)
      })
    } finally { starting.current = false }
  }

  // Enter starts the next session, unless focus is in a field or a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (changing || e.key !== 'Enter' || e.defaultPrevented || e.repeat || e.isComposing || document.querySelector('dialog[open], [role=dialog][aria-modal=true]')) return
      if (e.target instanceof Element && e.target.closest('button, input, textarea, select, a, [contenteditable=true]')) return
      e.preventDefault()
      void start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!sitting) return null
  const since = formatTime(new Date(sitting.startedAt), { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[110rem] flex-col justify-center gap-8 px-10 py-9 sm:pr-44">
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="flex-1 text-4xl font-light tracking-tight">{uiText("Next session")}</h1>
          <Button variant="ghost" onClick={exitToHome}>{uiText("Exit to Home")}</Button>
          <Button variant="ghost" onClick={() => sessionCommand(() => window.api.invoke('session:endSitting'))}>{uiText("Finish studying")}</Button>
        </header>

        <div className="grid content-start gap-8 pb-[10vh] xl:grid-cols-[minmax(0,1fr)_26rem]">
          <section style={subjectPanelStyle(subject?.color??'var(--tf-border)')} className="subject-colour-frame relative self-start overflow-hidden rounded-2xl border bg-surface p-8 pl-10">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="text-base text-muted">{subject ? categoryPathLabel(categories, subject.categoryId) : uiText("No subject chosen")}</div>
                <h2 dir="auto" className="mt-1 text-3xl leading-tight font-semibold">
                  {subject?.name ?? uiText('Choose a subject')}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setChanging('subject')}>{uiText("Change subject")}</Button>
            </div>
            <div className="mt-6 flex max-w-xl flex-col gap-4 border-t border-line pt-5">
              <ModeControl value={plan.mode} onChange={plan.setMode} itemId={plan.subject?.id ?? null} targetSeconds={plan.suggestion?.targetSeconds} />
              <LengthForMode plan={plan} adaptiveOverride={adaptiveOverride} setAdaptiveOverride={setAdaptiveOverride} />
              <GoalField value={goal} onChange={setGoal} />
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" onClick={()=>void start()}>{uiText("Start next session")}</Button>
              <Button onClick={()=>void start(true)}>{uiText("Review preparation")}</Button>
            </div>
          </section>

          <div className="space-y-4"><AdviceCard surface="return"/><Card title={uiText("This sitting so far")} action={<span className="text-base text-muted">{uiText("since ")}{since}</span>}>
            <Stats
              items={[
                { label: uiText(sitting.blockCount === 1 ? 'session' : 'sessions'), value: new Intl.NumberFormat(currentLanguage()).format(sitting.blockCount) },
                { label: uiText('focused'), value: timeOrDash(sitting.focusSeconds) }
              ]}
            />
            <BlockRows blocks={sittingBlocks.slice(0, 6)} />
          </Card></div>
        </div>
      </div>

      {changing === 'subject' && (
        <Dialog title={uiText("Change subject")} onClose={() => setChanging(null)}>
          <ItemPicker autoFocus selectedId={subject?.id ?? null} onSelect={(i) => plan.setSubject(i.id)} onConfirm={() => setChanging(null)} />
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => setChanging(null)}>{uiText("Done")}</Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
