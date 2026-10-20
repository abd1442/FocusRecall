import { t as uiText } from '../i18n'
import { useMemo } from 'react'
import { adaptiveTarget, goodSessionLengths } from '@core/modes'
import { formatClock } from '@core/timer'
import type { TimerMode } from '@core/timer'
import { useBlocks } from '../store/blocks'
import { useSettings } from '../store/session'

/** What each mode does, shown only as a tooltip over its picture. */
export const MODE_EXPLAINED: Record<TimerMode, string> = {
  flow: "Counts up toward the target and keeps going past it if you're in the zone.",
  fixed: 'Counts down from the length you set; after zero it shows the overtime.',
  adaptive: 'Suggests a length from recent sessions on this subject rated highly for focus. This is a planning default, not an optimal learning duration.'
}

const v = (vars: Record<string, string>): React.CSSProperties => vars as React.CSSProperties
const clock = (minutes: number): string => formatClock(minutes*60)

/**
 * A small picture of how the selected mode behaves, with tiny numbers so it
 * reads without text, played once when the mode is chosen. Flow fills from
 * 0:00 to the target and goes on ("+3:00"); Fixed is one bar filling up to the
 * chosen length; Adaptive shows past session
 * lengths with the suggested length marked in minutes. Hovering the picture
 * shows what the mode does.
 */
export function ModeDiagram({ mode, itemId, targetSeconds }: { mode: TimerMode; itemId?: number | null; targetSeconds?: number }): React.JSX.Element {
  const { focusTargetMinutes, fixedMinutes } = useSettings((s) => s.settings)
  return (
    <div className="group/mode relative" tabIndex={0} aria-label={uiText(MODE_EXPLAINED[mode])}>
      {/* The key restarts the animation each time the mode changes. */}
      <div key={mode} className="relative h-14 select-none" role="img" aria-label={uiText(MODE_EXPLAINED[mode])}>
        {mode === 'flow' && <Flow target={focusTargetMinutes} />}
        {mode === 'fixed' && <Fixed length={fixedMinutes} />}
        {mode === 'adaptive' && <Adaptive itemId={itemId ?? null} targetSeconds={targetSeconds} defaultSeconds={focusTargetMinutes*60} />}
      </div>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-30 mt-1 w-max max-w-72 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-sm text-bg opacity-0 shadow-lg transition-opacity duration-150 group-hover/mode:opacity-100 group-focus-visible/mode:opacity-100"
      >
        {MODE_EXPLAINED[mode]}
      </span>
    </div>
  )
}

/** The bar the pictures draw on. */
function Track({ left = '0%', right = '0%', children }: { left?: string; right?: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="absolute top-6 h-4 rounded-full bg-surface-2" style={{ left, right }}>
      {children}
    </div>
  )
}

/** A tiny label above a point on the bar. */
function Tick({ at, children, tone = 'muted', delay }: { at: string; children: React.ReactNode; tone?: 'muted' | 'ink' | 'overtime'; delay?: string }): React.JSX.Element {
  const color = tone === 'overtime' ? 'text-overtime' : tone === 'ink' ? 'text-ink' : 'text-muted'
  return (
    <span
      className={`absolute top-0 -translate-x-1/2 text-xs leading-5 font-medium whitespace-nowrap tabular-nums ${color} ${delay ? 'tf-fade-in' : ''}`}
      style={{ left: at, ...(delay ? v({ '--tf-delay': delay }) : {}) }}
    >
      {children}
    </span>
  )
}

function Flow({ target }: { target: number }): React.JSX.Element {
  const targetAt=target/(target+3)*100
  return (
    <>
      <Track>
        <div className="tf-grow absolute inset-y-0 left-0 rounded-l-full bg-stage-focus" style={{ width: `${targetAt}%`, ...v({ '--tf-dur': '1.6s' }) }} />
        <div className="tf-grow absolute inset-y-0 rounded-r-full bg-overtime" style={{ left: `${targetAt}%`, width: `${100-targetAt}%`, ...v({ '--tf-dur': '0.9s', '--tf-delay': '1.6s' }) }} />
        {/* The target mark. */}
        <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink/70" style={{ left: `${targetAt}%` }} />
      </Track>
      <Tick at="2%">0:00</Tick>
      <Tick at={`${targetAt}%`} tone="ink">
        {clock(target)}
      </Tick>
      <span className="tf-fade-in absolute bottom-0 right-0 text-xs font-medium text-overtime" style={v({'--tf-delay':'2.5s'})}>+3:00</span>
    </>
  )
}

function Fixed({ length }: { length: number }): React.JSX.Element {
  // One bar that fills from empty to the chosen length, then stops.
  return (
    <>
      <Track right="4%">
        <div className="tf-grow absolute inset-y-0 left-0 w-full rounded-full bg-stage-focus" style={v({ '--tf-dur': '1.8s' })} />
      </Track>
      <Tick at="96%" tone="ink">
        {clock(length)}
      </Tick>
    </>
  )
}

function Adaptive({ itemId, targetSeconds, defaultSeconds }: { itemId: number | null; targetSeconds?: number; defaultSeconds:number }): React.JSX.Element {
  const blocks = useBlocks((s) => s.blocks)
  const lengths = useMemo(() => (itemId === null ? [] : goodSessionLengths(blocks, itemId)), [blocks, itemId])
  const suggestion=itemId===null?null:adaptiveTarget(blocks,itemId,defaultSeconds)
  const real = (suggestion?.basedOn??0)>=5
  const mark = targetSeconds ?? suggestion?.targetSeconds ?? defaultSeconds
  // Restore the animated illustration when history is sparse. Grey examples are
  // centred on the actual current target and never enter the suggestion engine.
  const sample = real ? lengths : [.63,.84,.94,1.05,1.15,1.35].map(ratio=>mark*ratio)
  const maxMin = Math.max(60, ...sample.map((s) => s / 60 + 5), mark / 60 + 5)
  const at = (sec: number): string => `${(sec / 60 / maxMin) * 100}%`
  return (
    <>
      <div className="absolute inset-x-0 top-8 h-px bg-line" />
      {sample.map((s, i) => (
        <span
          key={i}
          title={uiText("{value0} min{value1}", {value0: (Math.round(s / 60)), value1: (real?'':uiText(' (example)'))})}
          className={`tf-fade-in absolute top-[1.7rem] size-3 -translate-x-1/2 rounded-full ${real ? 'bg-rest' : 'bg-muted/50'}`}
          style={{ left: at(s), ...v({ '--tf-delay': `${i * 0.12}s` }) }}
        />
      ))}
      <div className="tf-fade-in absolute inset-0" style={v({ '--tf-delay': `${sample.length * 0.12 + 0.2}s` })}>
        <span className="absolute top-5 bottom-2 w-0.5 -translate-x-1/2 rounded-full bg-stage-focus" style={{ left: at(mark) }} />
        <Tick at={at(mark)} tone="ink">
          {Math.round(mark / 60)}{uiText(" min")}{real?'':uiText(" (example)")}
        </Tick>
      </div>
      <Tick at="0%">0</Tick>
      <Tick at="97%">{Math.round(maxMin)}</Tick>
    </>
  )
}
