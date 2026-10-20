import { t as uiText, displayField } from '../../i18n'
import { useState } from 'react'
import { likelyActivities } from '@core/logcards'
import { useSettings } from '../../store/session'
import {
  amountFromRange,
  isTimestampUnit,
  unitsFor,
  type FieldOption,
  type FieldValue,
  type LogField,
  type ProgressValue
} from '@core/logfields'
import { PlusIcon } from '../Icons'
import { NamedSlider } from '../NamedSlider'
import { inputBase, inputClass } from '../ui'
import { NumberStepper, TimeInput } from '../NumberInputs'

export interface FieldInputProps {
  field: LogField
  value: FieldValue | undefined
  onChange: (v: FieldValue) => void
  /** For progress: the chosen activity and the subject's own unit. */
  activity?: FieldOption
  itemUnit?: string
  itemId?: number
  /** Newest first; supplying it enables the short activity list. */
  activityHistory?: string[]
  /** Show the field label (off when the group has a single field of the same name). */
  showLabel?: boolean
  /** Larger chips (the daily check-in). */
  suggested?: boolean
  large?: boolean
}

const ACCENTS: Record<string, string> = {
  focus: 'var(--tf-focus)',
  understanding: 'var(--tf-rest)',
  difficulty: 'var(--tf-overtime)',
  energy: 'var(--tf-rest)'
}

export function FieldInput({ field: originalField, value, onChange, activity, itemUnit = 'pages', itemId, activityHistory, showLabel = true, large = false, suggested = false }: FieldInputProps): React.JSX.Element {
  const field = displayField(originalField)
  switch (field.type) {
    case 'scale':
    case 'slider':
      return (
        <NamedSlider
          label={field.label}
          suggested={suggested}
          scale={field.scale ?? { min: 1, max: 5, labels: ['Very low', 'Low', 'Medium', 'High', 'Very high'] }}
          value={typeof value === 'number' ? value : null}
          onChange={onChange}
          accent={ACCENTS[field.key ?? ''] ?? 'var(--tf-focus)'}
          large={large}
          hideLabel={!showLabel}
        />
      )
    case 'single':
    case 'activity':
      return <Choices field={field} history={field.type === 'activity' ? activityHistory : undefined} showLabel={showLabel} large={large} selected={typeof value === 'string' ? [value] : []} onToggle={(id, on) => onChange(on ? id : null)} />
    case 'multi': {
      const list = Array.isArray(value) ? value : []
      return <Choices field={field} showLabel={showLabel} large={large} selected={list} onToggle={(id, on) => onChange(on ? [...list, id] : list.filter((x) => x !== id))} />
    }
    case 'progress':
      return <ProgressInput value={(value as ProgressValue | undefined) ?? null} onChange={onChange} activity={activity} itemUnit={itemUnit} itemId={itemId} showLabel={showLabel} />
    case 'number':
      // A number with a range (hours of sleep) is a slider; other numbers get a stepper.
      if (field.scale && field.scale.max > field.scale.min) {
        return <ValueSlider label={field.label} scale={field.scale} value={typeof value === 'number' ? value : null} onChange={onChange} />
      }
      return (
        <div className="flex flex-col gap-2">
          <span className="text-base font-medium text-muted">{field.label}</span>
          <NumberStepper value={typeof value === 'number' ? value : null} onChange={onChange} label={field.label} />
        </div>
      )
    default:
      return (
        <label className="flex flex-col gap-2">
          {showLabel && <span className="text-base font-medium text-muted">{field.label}</span>}
          <textarea
            dir="auto"
            rows={3}
            className={`${inputClass} font-writing`}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </label>
      )
  }
}

/** "7½ h": a value in half steps, with fractions shown as ½. */
function showValue(v: number, unit = ''): string {
  const whole = Math.floor(v)
  const half = v - whole >= 0.5
  return `${whole || !half ? whole : ''}${half ? '½' : ''}${unit ? ` ${unit}` : ''}`
}

/** A number on a slider (hours of sleep: 0 to 12 in half hours), the value shown large. */
function ValueSlider({ label, scale, value, onChange }: { label: string; scale: { min: number; max: number; step?: number; unit?: string }; value: number | null; onChange: (v: number | null) => void }): React.JSX.Element {
  const step = scale.step ?? 1
  const set = value !== null
  const pct = set ? ((value - scale.min) / (scale.max - scale.min)) * 100 : 0
  const mid = Math.round((scale.min + scale.max) / 2 / step) * step
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-muted">{label}</span>
        <span className="flex items-center gap-2">
          <span className={`text-2xl font-semibold tabular-nums ${set ? 'text-focus' : 'text-muted'}`}>{set ? showValue(value, scale.unit) : uiText("Not answered")}</span>
          {set && (
            <button type="button" aria-label={uiText("Clear {value0}", {value0: (label)})} onClick={() => onChange(null)} className="rounded-md px-1.5 text-base text-muted hover:text-ink">
              ×
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={set ? showValue(value, scale.unit) : uiText('Not answered')}
        min={scale.min}
        max={scale.max}
        step={step}
        value={set ? value : mid}
        onPointerDown={(e) => {
          if (set) return
          const r = (e.target as HTMLInputElement).getBoundingClientRect()
          const thumb=1.5*parseFloat(getComputedStyle(document.documentElement).fontSize)
          const t = Math.min(1, Math.max(0, (e.clientX - r.left-thumb/2) / Math.max(1,r.width-thumb)))
          onChange(Math.round((scale.min + t * (scale.max - scale.min)) / step) * step)
        }}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`named-slider w-full ${set ? '' : 'named-slider-empty'}`}
        style={{ '--fill': `calc(${pct}% + ${.75*(1-2*pct/100)}rem)`, '--accent': 'var(--tf-focus)' } as React.CSSProperties}
      />
      <div className="flex justify-between text-sm text-muted tabular-nums">
        <span>{showValue(scale.min, scale.unit)}</span>
        <span>{showValue(scale.max, scale.unit)}</span>
      </div>
    </div>
  )
}

/** Option chips with "+ Add option". Tapping a selected chip clears it. */
function Choices({
  field,
  selected,
  onToggle,
  showLabel,
  history,
  large = false
}: {
  field: LogField
  selected: string[]
  onToggle: (id: string, on: boolean) => void
  showLabel: boolean
  history?: string[]
  suggested?: boolean
  large?: boolean
}): React.JSX.Element {
  // Archived options stay visible only if this answer uses them.
  const options = field.options.filter((o) => !o.archived || selected.includes(o.id))
  const [expanded, setExpanded] = useState(false)
  const short = history !== undefined
  const shown = short && !expanded ? likelyActivities(options, selected[0] ?? null, history) : options
  return (
    <div className="flex flex-col gap-2.5">
      {showLabel && <span className="text-base font-medium text-muted">{field.label}</span>}
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => {
          const on = selected.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.id, !on)}
              className={`${large ? 'min-h-12 px-5 text-lg' : 'min-h-11 px-4 text-base'} rounded-full border transition-colors ${
                on ? 'border-transparent bg-focus text-on-accent' : 'border-line text-ink hover:border-muted'
              }`}
            >
              {o.label}
            </button>
          )
        })}
        {(!short || expanded) && <AddOption fieldId={field.id} label={field.type === 'activity' ? uiText('+ New activity') : undefined} onAdded={(id) => onToggle(id, true)} />}
        {short && (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-h-12 rounded-full px-5 text-base text-muted hover:bg-surface-2 hover:text-ink">
            {expanded ? uiText("Less") : uiText("More")}
          </button>
        )}
      </div>
    </div>
  )
}

function AddOption({ fieldId, onAdded, label }: { fieldId: number; onAdded: (id: string) => void; label?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open) {
    return (
      <button
        type="button"
        aria-label={label ?? 'Add an option'}
        title={label ?? 'Add an option'}
        onClick={() => setOpen(true)}
        className={`grid min-h-11 place-items-center rounded-full border border-dashed border-line text-muted hover:text-ink ${label ? 'px-4 text-base' : 'size-11'}`}
      >
        {label ?? <PlusIcon className="size-4" />}
      </button>
    )
  }
  const submit = async (): Promise<void> => {
    const t = text.trim()
    setText('')
    setOpen(false)
    if (t) onAdded(await window.api.invoke('log:addOption', fieldId, t))
  }
  return (
    <input
      autoFocus
      dir="auto"
      value={text}
      placeholder={uiText("New option")}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void submit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          void submit()
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          setOpen(false)
        }
      }}
      className="min-h-11 w-48 rounded-full border border-focus bg-bg px-4 text-base text-ink focus:outline-none"
    />
  )
}

/** Amount and unit, with optional from and to. Video units take timestamps (12:30). */
function ProgressInput({
  value,
  onChange,
  activity,
  itemUnit,
  itemId,
  showLabel = true
}: {
  value: ProgressValue | null
  onChange: (v: ProgressValue) => void
  activity?: FieldOption
  itemUnit: string
  itemId?: number
  showLabel?: boolean
}): React.JSX.Element {
  const v = value ?? { amount: null, unit: itemUnit, from: null, to: null }
  const units = unitsFor(activity, itemUnit)
  const unitList = v.unit && !units.includes(v.unit) ? [...units, v.unit] : units
  const timestamps = isTimestampUnit(v.unit)
  const remembered = useSettings((s) => itemId === undefined ? false : s.settings.progressRangeMemory[itemId] ?? false)
  const [rangeOpen, setRangeOpen] = useState(v.from !== null || v.to !== null || remembered)
  const toggleRange = (): void => {
    const next = !rangeOpen
    setRangeOpen(next)
    if (!next) onChange({ ...v, from: null, to: null })
    if (itemId !== undefined) {
      const { settings, set } = useSettings.getState()
      void set('progressRangeMemory', { ...settings.progressRangeMemory, [itemId]: next })
    }
  }

  const setRange = (p: Partial<ProgressValue>): void => {
    const next = { ...v, ...p }
    const amount = amountFromRange(next.unit, next.from, next.to)
    onChange({ ...next, amount })
  }

  return (
    <div className="flex flex-col gap-2.5">
      {showLabel && <span className="text-base font-medium text-muted">{uiText("Progress")}</span>}
      <div className="flex items-center gap-2">
        <NumberStepper label={uiText("Amount")} size="lg" value={v.amount} onChange={(amount) => onChange({ ...v, amount, from: null, to: null })} />
        <select
          aria-label={uiText("Unit")}
          className={`${inputBase} h-13 min-w-0 flex-1 py-0`}
          value={v.unit ?? ''}
          onChange={(e) => onChange({ amount: v.amount, unit: e.target.value, from: null, to: null })}
        >
          {unitList.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-h-26 flex-col items-start gap-1 text-base">
        <button type="button" aria-expanded={rangeOpen} onClick={toggleRange} className="min-h-11 rounded-lg px-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
          {rangeOpen ? uiText("Remove range") : uiText("+ Add range")}
        </button>
        {rangeOpen && (
          <div className="flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-2/40 px-3 py-1">
            {v.unit === 'pages' && <span className="text-sm text-muted">{uiText("p.")}</span>}
            <RangeInput timestamps={timestamps} value={v.from} onChange={(from) => setRange({ from })} label={uiText("From")} />
            <span aria-hidden="true" className="text-muted">→</span>
            <RangeInput timestamps={timestamps} value={v.to} onChange={(to) => setRange({ to })} label={uiText("To")} />
          </div>
        )}
        {rangeOpen && v.from !== null && v.to !== null && v.to < v.from && <p role="alert" className="text-sm text-status-error">{uiText("The end must come after the start.")}</p>}
      </div>
    </div>
  )
}

function RangeInput({
  timestamps,
  value,
  onChange,
  label
}: {
  timestamps: boolean
  value: number | null
  onChange: (v: number | null) => void
  label: string
}): React.JSX.Element {
  // Video timestamps take the colon by themselves; pages and the like are plain numbers.
  if (timestamps) return <TimeInput shape="hms" label={label} placeholder="0:00" value={value} onChange={onChange} className="w-24 min-w-0 border-0 bg-transparent px-1" />
  return <input type="number" min={0} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className={`${inputBase} w-20 min-w-0 border-0 bg-transparent px-1 text-center tabular-nums`} />
}
