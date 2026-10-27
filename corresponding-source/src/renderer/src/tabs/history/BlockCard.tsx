import { formatDuration , formatTime } from '../../i18n'
import { t as uiText, displayScale } from '../../i18n'
import { confirmAction } from '../../components/appDialogs'
import { useState } from 'react'
import type { HistoryBlock, Rating as RatingValue } from '@core/blocks'
import { SCALES, scaleLabel, sliderMiddle, valueLabel, type GroupNotes, type LogValues } from '@core/logfields'

import type { Id } from '@core/types'
import { PencilIcon } from '../../components/Icons'
import { LogForm } from '../../components/log/LogForm'
import { NamedSlider } from '../../components/NamedSlider'
import { TimeInput } from '../../components/NumberInputs'
import { useSliderForm } from '../../components/log/useSliderForm'
import { Button, Field, inputClass } from '../../components/ui'
import { useLibrary } from '../../store/library'
import { useLogSchema } from '../../store/logSchema'
import { SavedNotes } from '../../components/NotesEditor'

const time = (iso: string): string => formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit' })

const ORIGIN_LABEL: Record<HistoryBlock['origin'], string> = {
  normal: 'start of the session',
  live_switch: 'switched to during the session',
  estimated_split: 'split afterwards (times estimated)'
}

export function BlockCard({ block: b, reload, readOnly = false }: { block: HistoryBlock; reload: () => Promise<void>; readOnly?: boolean }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [linkError, setLinkError] = useState('')
  const openNotes = async (): Promise<void> => {
    if (!b.notesLink) return
    setLinkError('')
    try { await window.api.invoke('shell:open', b.notesLink) }
    catch (error) { setLinkError(uiText('Could not open notes: {value0}', {value0:error instanceof Error ? error.message : String(error)})) }
  }

  const remove = async (): Promise<void> => {
    if (!await confirmAction(uiText('Delete this part of the session ({subject})? This cannot be undone.',{subject:b.itemName}),'Delete part','Delete session part?',true)) return
    await window.api.invoke('history:deleteBlock', b.id)
    await reload()
  }

  return (
    <article className="rounded-md bg-bg/60 p-4">
      <header className="flex items-start gap-3">
        <span className="mt-1 h-4 w-1 shrink-0 rounded-full" style={{ background: b.itemColor }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-medium">{b.itemName}</span>
            <span className="text-sm text-muted">
              {time(b.focusStartedAt)}–{b.focusEndedAt ? time(b.focusEndedAt) : ''} · {formatDuration(b.focusSeconds ?? 0)}{uiText(" focus")}</span>
            {b.logStatus === 'pending' && <span className="text-sm text-overtime">{uiText("not logged")}</span>}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {uiText(b.timerMode==='flow'?'Flow':b.timerMode==='fixed'?'Fixed':'Adaptive')}{uiText(" · target ")}{formatDuration(b.targetSeconds)} · {uiText(ORIGIN_LABEL[b.origin])}
            {b.endedBy === 'switch' ? uiText(" · then switched") : ''}
          </div>
        </div>
        <Button disabled={readOnly} variant="ghost" onClick={() => setEditing(true)} aria-label={uiText("Edit this part")}>
          <PencilIcon /> {b.logStatus === 'pending' ? uiText("Complete") : uiText("Edit")}
        </Button>
        <Button disabled={readOnly} variant="ghost" onClick={remove}>{uiText("Delete")}</Button>
      </header>

      <div className="mt-3 flex flex-col gap-3 pl-4 text-base">
        {b.recallText && (
          <Detail label={uiText("Recall")}>
            {b.recallRating && <p className="mb-1 text-sm text-muted">{b.recallRatingTouched ? uiText("Recalled:") : uiText("Suggested recall (not answered):")} {scaleLabel(displayScale(SCALES.recall), b.recallRating)}</p>}
            <p dir="auto" className="font-writing whitespace-pre-wrap text-writing-ink">
              {b.recallText}
            </p>
          </Detail>
        )}
        {b.reviewMarked && (
          <Detail label={uiText("Review later")}>
            <p dir="auto" className={`font-writing ${b.toReviewDone ? 'text-muted line-through' : ''}`}>
              {b.toReviewText || 'Marked for review'}
              {b.toReviewDone ? uiText(" (done)") : ''}
            </p>
          </Detail>
        )}
        {b.notesLink && (
          <Detail label={uiText("Notes")}>
            <button type="button" onClick={() => void openNotes()} className="text-focus break-all text-start underline-offset-2 hover:underline">
              {b.notesLink}
            </button>
            {linkError && <p role="alert" className="text-status-error">{linkError}</p>}
          </Detail>
        )}
        <LogSummary values={b.values} notes={b.groupNotes} untouched={b.untouched} />
        <SavedNotes itemId={b.itemId} blockId={b.id} recallText={b.recallText}/>
      </div>

      {editing && (
        <BlockEditor
          block={b}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false)
            await reload()
          }}
        />
      )}
    </article>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
      <span className="pt-px text-sm text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function LogSummary({ values, notes, untouched }: { values: LogValues; notes: GroupNotes; untouched: number[] }): React.JSX.Element | null {
  const schema = useLogSchema((st) => st.schema)
  const rows = schema.groups
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => {
      const answers = schema.fields
        .filter((f) => f.groupId === g.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => {
          const v = valueLabel(f, values[f.id])
          return v ? {label:f.label.replace(/\?$/, ''),value:untouched.includes(f.id) ? `${v} (suggested, not answered)` : v} : null
        })
        .filter((a):a is {label:string;value:string}=>a!==null)
      return answers.length || notes[g.id] ? { id:g.id,name:g.name,answers,note:notes[g.id] } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (!rows.length) return null
  return (
    <>
      {rows.map((r) => (
        <section key={r.id} className="rounded-xl border border-line/60 bg-surface/40 p-4">
          <h4 className="mb-3 text-sm font-semibold text-muted">{r.name}</h4>
          <dl className="flex flex-wrap gap-3">{r.answers.map(a=><div key={a.label} className="min-w-28 rounded-lg bg-surface-2/60 px-3 py-2"><dt className="text-xs text-muted">{a.label}</dt><dd dir="auto" className="mt-1 font-medium">{a.value}</dd></div>)}</dl>
          {r.note && <p dir="auto" className="mt-3 font-writing whitespace-pre-wrap text-muted">{r.note}</p>}
        </section>
      ))}
    </>
  )
}

// --- Editing -------------------------------------------------------------------

/** ISO UTC to the value of a datetime-local input (local time, seconds precision). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function BlockEditor({
  block: b,
  onClose,
  onSaved
}: {
  block: HistoryBlock
  onClose: () => void
  onSaved: () => Promise<void>
}): React.JSX.Element {
  const items = useLibrary((s) => s.items)
  const [itemId, setItemId] = useState<Id>(b.itemId)
  const [start, setStart] = useState(toLocalInput(b.focusStartedAt))
  const [end, setEnd] = useState(b.focusEndedAt ? toLocalInput(b.focusEndedAt) : '')
  const [recallText, setRecallText] = useState(b.recallText ?? '')
  const [toReviewText, setToReviewText] = useState(b.toReviewText ?? '')
  // Like every slider: a value is always shown; a default counts as untouched until moved.
  const [recallRating, setRecallRating] = useState<number | null>(b.recallRating ?? sliderMiddle({ scale: SCALES.recall }))
  const [recallTouched, setRecallTouched] = useState(b.recallRating !== null && b.recallRatingTouched)
  const [reviewMarked, setReviewMarked] = useState(b.reviewMarked)
  const { values, untouched, update, confirm } = useSliderForm(b.values, ['quick', 'setup', 'detail'], b.untouched)
  const [notes, setNotes] = useState<GroupNotes>(b.groupNotes)
  const [error, setError] = useState<string | null>(null)

  async function save(): Promise<void> {
    try {
      const startIso = new Date(start).toISOString()
      const endIso = end ? new Date(end).toISOString() : undefined
      await window.api.invoke('history:updateBlock', b.id, {
        itemId,
        focusStartedAt: startIso !== b.focusStartedAt ? startIso : undefined,
        focusEndedAt: endIso && endIso !== b.focusEndedAt ? endIso : undefined,
        recallText,
        toReviewText: reviewMarked ? toReviewText : null,
        reviewMarked,
        recallRating: recallRating as RatingValue | null,
        recallRatingTouched: recallRating === null || recallTouched
      })
      await window.api.invoke('history:saveLog', b.id, values, notes, untouched)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    }
  }

  const choosable = items.filter((i) => !i.archived || i.id === b.itemId)

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/30 p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-medium">{b.logStatus === 'pending' ? uiText("Complete: {value0}", {value0: (b.itemName)}) : uiText("Edit: {value0}", {value0: (b.itemName)})}</h2>

        <div className="grid grid-cols-3 gap-4">
          <Field label={uiText("Item")}>
            <select className={inputClass} value={itemId} onChange={(e) => setItemId(Number(e.target.value))}>
              {choosable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={uiText("Focus started")}>
            <DateTimeField value={start} onChange={setStart} label={uiText("Start")} />
          </Field>
          <Field label={uiText("Focus ended")} hint={uiText("Distracted time inside is still left out.")}>
            <DateTimeField value={end} onChange={setEnd} label={uiText("End")} />
          </Field>
        </div>

        <Field label={uiText("Recall")}>
          <textarea dir="auto" rows={5} className={`${inputClass} font-writing`} value={recallText} onChange={(e) => setRecallText(e.target.value)} />
        </Field>
        <div className="max-w-2xl">
          <NamedSlider label={uiText("How much could you recall?")} scale={displayScale(SCALES.recall)} value={recallRating} suggested={!recallTouched} onConfirm={() => setRecallTouched(true)}
            onChange={(v) => {
              setRecallRating(v)
              setRecallTouched(true)
            }} accent="var(--tf-recall)" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="size-5 accent-[var(--tf-recall)]" checked={reviewMarked} onChange={(e) => setReviewMarked(e.target.checked)} />{uiText("Review later")}</label>
          {reviewMarked && (
            <input
              dir="auto"
              placeholder={uiText("What to look at again (optional)")}
              className={`${inputClass} max-w-xl flex-1 font-writing`}
              value={toReviewText}
              onChange={(e) => setToReviewText(e.target.value)}
            />
          )}
        </div>

        <div className="border-t border-line pt-5">
          <LogForm untouched={untouched} onKeep={confirm} values={values} notes={notes} onValues={(u) => update(u)} onNotes={(u) => setNotes(u)} itemId={b.itemId} itemUnit={b.itemUnit} expanded />
        </div>

        {error && <p role="alert" className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{uiText("Cancel")}</Button>
          <Button variant="primary" onClick={save}>{uiText("Save")}</Button>
        </div>
      </div>
    </div>
  )
}

/**
 * A local date and time ("YYYY-MM-DDTHH:MM:SS"): the date from a calendar, the
 * time typed with the colon added by itself. Seconds are kept unless the time changes.
 */
function DateTimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }): React.JSX.Element {
  const [date, time = '00:00:00'] = value.split('T')
  const [h, m] = time.split(':').map(Number)
  return (
    <div className="flex gap-2">
      <input type="date" aria-label={uiText("{value0} date", {value0: (label)})} className={`${inputClass} min-w-0 flex-1`} value={date} onChange={(e) => e.target.value && onChange(`${e.target.value}T${time}`)} />
      <TimeInput
        label={`${label} time`}
        pad
        min={0}
        max={23 * 60 + 59}
        value={h * 60 + m}
        onChange={(v) => {
          if (v === null) return
          onChange(`${date}T${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}:00`)
        }}
        className="w-24"
      />
    </div>
  )
}

// --- To review -----------------------------------------------------------------

