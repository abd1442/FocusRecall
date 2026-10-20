import { t as uiText, displayField } from '../i18n'
import { subjectPanelStyle } from './SubjectPanel'
import { useEffect, useMemo, useState } from 'react'
import { FirstHoursBadge, useSubjectStage } from './Stage'
import { stageLine } from '@core/learning'
import { categoryPathLabel } from '@core/library'
import { fieldByKey, fieldsIn, setupDefault, setupSummary, type FieldValue, type LogValues } from '@core/logfields'
import { useBlocks } from '../store/blocks'
import { useLibrary } from '../store/library'
import { useLogSchema } from '../store/logSchema'
import type { NextBlockPlan } from '../store/plan'
import { GoalField, LengthForMode, ModeControl } from './TimerControls'
import { useSettings } from '../store/session'
import { FieldInput } from './log/FieldInput'
import { Button, Dialog, inputBase } from './ui'

/**
 * Home's session setup: subject, timer mode and length, the session goal, and
 * the rest under "More options", then Start (always visible). Every choice is
 * kept as the default for next time.
 */
export function SetupCard({
  plan,
  adaptiveOverride,
  setAdaptiveOverride,
  goal,
  setGoal,
  onStart,
  startLabel,
  compact = false
}: {
  plan: NextBlockPlan
  adaptiveOverride: number | null
  setAdaptiveOverride: (m: number | null) => void
  goal: string
  setGoal: (v: string) => void
  onStart: () => void
  startLabel: string
  compact?: boolean
}): React.JSX.Element {
  const { settings, set } = useSettings()
  const firstSession=useBlocks(s=>s.blocks.length===0)
  const categories = useLibrary((s) => s.categories)
  const schema = useLogSchema((s) => s.schema)
  const activityField = fieldByKey(schema, 'activity')
  const activities = activityField ? displayField(activityField).options.filter(option => !option.archived) : []
  const [editingSetup, setEditingSetup] = useState(false)
  const [more, setMore] = useState(false)
  const setup = useStudySetup()
  const s = plan.subject
  const planned = activities.find((a) => a.id === settings.plannedActivity)

  return (
    <section
      data-session-launch-panel
      className="subject-colour-frame relative flex flex-col overflow-hidden rounded-2xl border bg-surface"
      style={{...subjectPanelStyle(s?.color??'var(--tf-border)'), maxHeight: compact?'min(28rem, calc(100dvh / var(--tf-zoom, 1) - 6rem))':'calc(100vh / var(--tf-zoom, 1) - 4.5rem)' }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {!compact && (s ? (
          <div className="flex items-start gap-4">
            <div className="min-w-0">
              <div dir="auto" className="text-xl leading-snug font-semibold">
                {s.name}
              </div>
              <div className="mt-1 text-base text-muted">{categoryPathLabel(categories, s.categoryId)}</div>
              <SubjectStageLine itemId={s.id} />
            </div>
          </div>
        ) : (
          <p className="text-lg text-muted">{uiText("Pick a subject from the tiles.")}</p>
        ))}

        <div className="flex flex-col gap-3">
          <ModeControl compact={compact} value={plan.mode} onChange={plan.setMode} itemId={plan.subject?.id ?? null} targetSeconds={plan.targetSeconds} />
          <LengthForMode plan={plan} adaptiveOverride={adaptiveOverride} setAdaptiveOverride={setAdaptiveOverride} />
        </div>

        {firstSession&&settings.panelAutoShow&&<div className="rounded-xl bg-focus/10 p-3 text-sm"><p>{uiText("Start opens your floating timer. You can return to FocusRecall at any time.")}</p><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={!settings.minimizeOnStart} onChange={e=>void set('minimizeOnStart',!e.target.checked)}/>{uiText("Keep this window open")}</label></div>}
        {!compact&&<GoalField value={goal} onChange={setGoal} />}

        <div className="border-t border-line pt-3">
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex w-full items-center gap-2 py-1 text-left text-base font-medium">
            <span className="text-muted">{more ? '▾' : '▸'}</span>{uiText("More options")}{!more && (
              <span className="min-w-0 flex-1 truncate text-right text-sm font-normal text-muted">
                {[planned?.label, settings.restMusic ? uiText('rest music') : null, settings.panelAutoShow ? uiText('panel') : null].filter(Boolean).join(' · ')}
              </span>
            )}
          </button>
          {more && (
            <div className="mt-2 flex flex-col divide-y divide-line">
              {compact&&<div className="py-3"><GoalField value={goal} onChange={setGoal}/></div>}
              <OptionRow label={uiText("Planned activity")} hint={uiText("Pre-selects the activity in the log.")}>
                <select className={`${inputBase} w-56`} value={settings.plannedActivity ?? ''} onChange={(e) => set('plannedActivity', e.target.value || null)}>
                  <option value="">{uiText("Not planned")}</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </OptionRow>
              <OptionRow label={uiText("Study setup")} hint={setup.summary || 'Not set yet'}>
                <Button variant="quiet" size="sm" onClick={() => setEditingSetup(true)}>{uiText("Change")}</Button>
              </OptionRow>
              <OptionRow label={uiText("Rest music")} hint={uiText("1 min of rest per 5 min of focus (5 to 15); every fourth rest is long.")}>
                <Toggle checked={settings.restMusic} onChange={(v) => set('restMusic', v)} label={uiText("Play rest music")} />
              </OptionRow>
              <OptionRow label={uiText("Show the floating panel")}>
                <Toggle checked={settings.panelAutoShow} onChange={(v) => set('panelAutoShow', v)} label={uiText("Show the floating panel")} />
              </OptionRow>
              <OptionRow label={uiText("Minimise FocusRecall")}>
                <Toggle checked={settings.minimizeOnStart} onChange={(v) => set('minimizeOnStart', v)} label={uiText("Minimise FocusRecall")} />
              </OptionRow>
            </div>
          )}
        </div>
      </div>
      {!compact&&<div className="border-t border-line p-5">
        <Button variant="primary" size="md" className="min-h-14 w-full text-lg" disabled={!s} onClick={onStart}>
          {uiText(startLabel)}
        </Button>
      </div>}

      {editingSetup && <SetupDialog initial={setup.values} onClose={() => setEditingSetup(false)} />}
    </section>
  )
}

function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-base">{label}</div>
        {hint && <div className="truncate text-sm text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

/** An on/off switch, the same as in Settings. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-focus' : 'bg-surface-2 ring-1 ring-line'}`}
    >
      <span className={`absolute top-1 left-1 size-6 rounded-full shadow transition-transform ${checked ? 'translate-x-6 bg-on-accent' : 'bg-muted'}`} />
    </button>
  )
}

/** The study setup the next log starts from: a setup chosen here, or the default. */
export function useStudySetup(): { values: LogValues; summary: string } {
  const schema = useLogSchema((s) => s.schema)
  const { setupOverride, setupDefaultMode } = useSettings((s) => s.settings)
  const [history, setHistory] = useState<LogValues[]>([])
  useEffect(() => {
    void window.api.invoke('log:setupHistory').then(setHistory)
  }, [])
  return useMemo(() => {
    const values = setupOverride ?? setupDefault(schema, history, setupDefaultMode)
    return { values, summary: setupSummary(schema, values) }
  }, [schema, history, setupOverride, setupDefaultMode])
}

/** Edit the study setup for the next blocks. Saved as the setup to use until a log changes it. */
function SetupDialog({ initial, onClose }: { initial: LogValues; onClose: () => void }): React.JSX.Element {
  const schema = useLogSchema((s) => s.schema)
  const set = useSettings((s) => s.set)
  const [values, setValues] = useState<LogValues>(initial)
  const fields = fieldsIn(schema, 'setup')
  return (
    <Dialog title={uiText("Study setup")} onClose={onClose}>
      <div className="grid gap-6 lg:grid-cols-2">
        {fields.map((f) => (
          <FieldInput key={f.id} field={f} value={values[f.id]} onChange={(v: FieldValue) => setValues((p) => ({ ...p, [f.id]: v }))} />
        ))}
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>{uiText("Cancel")}</Button>
        <Button
          variant="primary"
          onClick={async () => {
            await set('setupOverride', values)
            onClose()
          }}
        >{uiText("Use this setup")}</Button>
      </div>
    </Dialog>
  )
}

/** "7 h 40 of your first 20 hours" with the badge, under the chosen subject. */
function SubjectStageLine({ itemId }: { itemId: number }): React.JSX.Element | null {
  const st = useSubjectStage(itemId)
  if (!st || st.hours <= 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
      <FirstHoursBadge stage={st.stage} />
      <span>{st.stage.first ? stageLine(st.hours, st.stage) : `${st.stage.name} · ${stageLine(st.hours, st.stage)}`}</span>
    </div>
  )
}
