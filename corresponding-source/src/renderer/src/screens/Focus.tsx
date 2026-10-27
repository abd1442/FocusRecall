import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { clockDisplay } from '@core/modes'
import { distractedSince, sessionFocusSeconds, type RunningBlock } from '@core/session'
import { formatClock } from '@core/timer'
import { SessionBar } from '../components/SessionBar'
import { SwitchDialog } from '../components/SwitchDialog'
import { Button } from '../components/ui'
import { useKey, useNow } from '../hooks'
import { sessionCommand, useSettings } from '../store/session'

const MODE_NAMES = { flow: 'Flow', fixed: 'Fixed', adaptive: 'Adaptive' } as const

/** A button hint with its hotkey, if one is set. */
const hint = (text: string, key: string): string => (key ? `${uiText(text)} (${key})` : uiText(text))

/** The focus stage: the subject, the session clock with its target, and the controls. */
export function FocusScreen({ block }: { block: RunningBlock }): React.JSX.Element {
  const now = useNow()
  const [switching, setSwitching] = useState(false)
  const keys = useSettings((s) => s.settings)
  const since = distractedSince(block)
  const distracted = since !== null
  const c = clockDisplay(block.timerMode, block.targetSeconds, sessionFocusSeconds(block, now))
  const stage = c.overtime ? 'overtime' : 'focus'
  const color = `var(--fr-stage-${stage})`
  const subjects = new Set([...block.parts.map((p) => p.itemId), block.itemId]).size

  const toggle = (): Promise<unknown> => sessionCommand(() => window.api.invoke('session:toggleDistracted'))
  const finish = (): Promise<unknown> => sessionCommand(() => window.api.invoke('session:finish'))

  // The Switch hotkey and the panel's Switch button open the picker here.
  useEffect(() => window.api.on('ui:openSwitch', () => setSwitching(true)), [])

  useKey(
    (e) => {
      if (switching || (e.target instanceof Element && e.target.closest('button, input, textarea, select, a, [contenteditable=true], [role=button]'))) return
      if (e.key === ' ') {
        e.preventDefault()
        void toggle()
      }
    },
    [switching]
  )

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-10 px-8">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: block.itemColor }} />

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-2xl">
          <span className="size-3 rounded-full" style={{ background: block.itemColor }} />
          <h1 dir="auto">{block.itemName}</h1>
        </div>
        {subjects > 1 && <div className="text-base text-muted">{subjects}{uiText(" subjects in this session")}</div>}
      </div>

      <div className="flex w-full max-w-3xl flex-col items-center gap-5">
        <div role="timer" aria-label={uiText('Focus')} className={`flex items-baseline gap-5 transition-opacity duration-700 ${distracted ? 'opacity-35' : ''}`} aria-live="off">
          <span className="font-timer text-[8.5rem] leading-none font-extralight tabular-nums transition-colors duration-700" style={{ color: `var(--fr-stage-${stage}-text)` }}>
            {c.main}
          </span>
          <span className="font-timer text-3xl font-light text-muted tabular-nums">{c.aside}</span>
        </div>
        <SessionBar block={block} now={now} accent={color} className="h-1.5 max-w-xl" />
        <div className="h-8 text-xl">
          {distracted ? (
            <span className="text-overtime">{uiText("Distracted · away ")}<span className="font-timer tabular-nums">{formatClock((now - Date.parse(since)) / 1000)}</span>
            </span>
          ) : (
            <span className="text-muted">{c.overtime ? uiText("Target reached") : uiText(MODE_NAMES[block.timerMode])}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          variant="quiet"
          onClick={toggle}
          className={`min-h-14 min-w-36 text-lg ${distracted ? 'ring-2 ring-overtime' : ''}`}
          title={hint(distracted ? 'Back to studying' : 'Stop the clock while you are pulled away', keys.hotkeyDistracted)}
        >
          {distracted ? uiText("Back") : uiText("Distracted")}
        </Button>
        <Button variant="quiet" onClick={() => setSwitching(true)} className="min-h-14 min-w-32 text-lg" title={hint('Change subject; the session goes on', keys.hotkeySwitch)}>{uiText("Switch")}</Button>
        <Button variant="primary" onClick={finish} className="min-h-14 px-8 text-lg" style={{ background: color, color: `var(--fr-stage-${stage}-on)` }}>{uiText("Finish session")}</Button>
      </div>

      {switching && <SwitchDialog currentId={block.itemId} onClose={() => setSwitching(false)} />}
    </div>
  )
}
