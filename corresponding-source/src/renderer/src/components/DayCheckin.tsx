import { t as uiText, formatDate } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DayAnswers } from '@core/api'
import { answerChips, fieldsIn, sectionSummary, type GroupNotes } from '@core/logfields'

import { useLogSchema } from '../store/logSchema'
import { FieldInput } from './log/FieldInput'
import { useSliderForm } from './log/useSliderForm'
import { Button } from './ui'
import { checkinSaveDay } from '@core/dayClock'
import { currentStudyDay, useStudyDay } from '../store/studyDay'
import { localCalendarDay } from '@core/homePreferences'

const isChips = (t: string): boolean => t === 'single' || t === 'multi'

/** A study day's check-in answers, kept fresh. */
function useDay(day: string): { answers: DayAnswers | null; reload: () => Promise<void> } {
  const [answers, setAnswers] = useState<DayAnswers | null>(null)
  const current=useRef(day);current.current=day
  const reload = useCallback(async () => {const result=await window.api.invoke('day:get', day);if(current.current===day)setAnswers(result)}, [day])
  useEffect(() => {
    let alive = true
    setAnswers(null)
    void window.api.invoke('day:get', day).then((a) => { if (alive) setAnswers(a) })
    return () => { alive = false }
  }, [reload])
  return { answers, reload }
}

/** The day's questions as a small form with Save; used on Home and in the log. */
function DayForm({ day, answers, onSaved, onCancel, extra, followToday = false }: { day: string; answers: DayAnswers; onSaved: () => void; onCancel?: () => void; extra?: React.ReactNode; followToday?: boolean }): React.JSX.Element {
  const schema = useLogSchema((s) => s.schema)
  const { values, untouched, update } = useSliderForm(answers.values, ['day'], answers.untouched)
  const notes: GroupNotes = answers.notes
  const current = useStudyDay((s) => s.day)
  const [choice, setChoice] = useState<{current: string; day: string} | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const target = followToday ? checkinSaveDay(day, current, choice) : day
  return (
    <div className="flex flex-col gap-5">
      {followToday && current !== day && <div className="rounded-xl border border-line bg-surface-2 p-4" role="group" aria-label={uiText("Choose the study day for these answers")}>
        <p>{uiText("Your answers are still here. Which study day do they belong to?")}</p>
        <div className="mt-3 flex flex-wrap gap-3">{[day, current].map((d) => <Button key={d} variant={target === d ? 'primary' : 'quiet'} onClick={() => setChoice({current, day: d})}>{formatDate(d, {year:'numeric',month:'short',day:'numeric'})}</Button>)}</div>
      </div>}
      {error && <p role="alert" className="text-status-error">{error}</p>}
      <div className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-2 2xl:grid-cols-3">
        {/* Sliders first in a tidy grid; option chips (no order) across the full width after them. */}
        {[...fieldsIn(schema, 'day')]
          .sort((x, y) => Number(isChips(x.type)) - Number(isChips(y.type)))
          .map((f) => (
            <div key={f.id} className={isChips(f.type) ? 'col-span-full' : ''}>
              <FieldInput suggested={untouched.includes(f.id)} field={f} large value={values[f.id]} onChange={(v) => update((p) => ({ ...p, [f.id]: v }), [f.id])} />
            </div>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={busy || target === null}
          onClick={async () => {
            const latest = followToday ? currentStudyDay() : day
            const saveDay = followToday ? checkinSaveDay(day, latest, choice) : day
            if (!saveDay) return
            setBusy(true); setError('')
            try { await window.api.invoke('day:save', saveDay, values, notes, untouched); onSaved() }
            catch (e) { setError(e instanceof Error ? e.message : String(e)) }
            finally { setBusy(false) }
          }}
        >
          {target && target !== current ? uiText("Save for {value0}", {value0: (formatDate(target))}) : uiText("Save for today")}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>{uiText("Cancel")}</Button>
        )}
        {extra}
      </div>
    </div>
  )
}

/**
 * Home's daily check-in: the questions that are the same all day (sleep,
 * exercise, physical state, pressure, energy and mood today). Shown once per
 * study day until answered or skipped, then one line with Edit.
 */
export function DayCheckinCard({ day }: { day: string }): React.JSX.Element | null {
  const schema = useLogSchema((s) => s.schema)
  const { answers, reload } = useDay(day)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DayAnswers | null>(null)
  const [skipBusy,setSkipBusy]=useState(false),[skipError,setSkipError]=useState('')
  const skip = async ():Promise<void>=>{
    if(skipBusy)return
    setSkipBusy(true);setSkipError('')
    try { await window.api.invoke('settings:set','todayCheckSkippedDate',localCalendarDay()) }
    catch { setSkipError(uiText('Could not hide Today Check. Try again.')) }
    finally { setSkipBusy(false) }
  }
  const skipButton=<><Button variant="ghost" size="sm" disabled={skipBusy} onClick={()=>void skip()}>{uiText('Skip for today')}</Button>{skipError&&<p role="alert" className="text-status-error">{skipError}</p>}</>
  const open = (): void => { if (answers) { setDraft(answers); setEditing(true) } }
  if ((!answers && !draft) || !fieldsIn(schema, 'day').length) return null
  const shown = editing && draft ? draft : answers!
  const weekday = formatDate(shown.day, { weekday: 'long' })

  if (shown.done && !editing) {
    const chips = answerChips(schema, Object.fromEntries(Object.entries(shown.values).filter(([id])=>!shown.untouched.includes(Number(id)))), 'day')
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-6 py-3">
        <span className="text-base font-semibold">{uiText("Today")}</span>
        {chips.length ? (
          <AnswerChips chips={chips} />
        ) : (
          <span className="text-base text-muted">{shown.skipped ? uiText("Skipped for today") : uiText("No answers")}</span>
        )}
        <span className="flex-1" />
        {/* An accent button opens the check-in in both states, so it is easy to find. */}
        <Button variant="primary" onClick={open} className="shadow-sm">
          <CheckInIcon /> {shown.skipped && !chips.length ? uiText("Check in") : uiText("Edit check-in")}
        </Button>
        {skipButton}
      </div>
    )
  }
  if (!shown.done && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-focus/40 bg-focus/8 px-6 py-4">
        <Button variant="primary" onClick={open} className="shadow-sm">
          <CheckInIcon />{uiText(" Check in")}</Button>
        <span className="min-w-0 flex-1 text-lg">{uiText("How are you today? ")}<span className="text-muted">{uiText("Optional")}</span>
        </span>
        {skipButton}
      </div>
    )
  }
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-xl font-semibold">{uiText("How is ")}{weekday}?</h2>
        <p className="text-base text-muted">{uiText("One check-in for today.")}</p>
      </div>
      <DayForm
        day={shown.day}
        answers={shown}
        followToday
        onSaved={async () => {
          setEditing(false)
          setDraft(null)
          await reload()
        }}
        onCancel={() => { setEditing(false); setDraft(null) }}
      />
    </section>
  )
}

/** In the log: the day's answers as one line with Change. Changing them updates the whole day. */
export function DayAnswersLine({ day }: { day: string }): React.JSX.Element | null {
  const schema = useLogSchema((s) => s.schema)
  const { answers, reload } = useDay(day)
  const [open, setOpen] = useState(false)
  if (!answers || !fieldsIn(schema, 'day').length) return null
  const confirmedValues=Object.fromEntries(Object.entries(answers.values).filter(([id])=>!answers.untouched.includes(Number(id))))
  const summary = sectionSummary(schema, confirmedValues, 'day')
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{uiText("Today")}</h3>
          {answerChips(schema, confirmedValues, 'day').length ? (
            <div className="mt-1.5">
              <AnswerChips chips={answerChips(schema, confirmedValues, 'day')} />
            </div>
          ) : (
            <p className="mt-0.5 text-base text-muted">{summary || 'Not answered today.'}</p>
          )}
        </div>
        <Button variant="quiet" onClick={() => setOpen((v) => !v)}>
          {open ? uiText("Close") : uiText("Change")}
        </Button>
      </div>
      {open && (
        <div className="mt-5 border-t border-line pt-5">
          <DayForm
            day={day}
            answers={answers}
            onSaved={async () => {
              setOpen(false)
              await reload()
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </section>
  )
}

/** The day's answers as small chips: "Sleep 7½ h", "Energy Alert". */
function AnswerChips({ chips }: { chips: { label: string; value: string }[] }): React.JSX.Element {
  return (
    <span className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span key={c.label} dir="auto" className="inline-flex items-baseline gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm">
          <span className="text-muted">{c.label}</span>
          <span className="font-medium">{c.value}</span>
        </span>
      ))}
    </span>
  )
}

function CheckInIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.8 10.2 2.2 2.2 4.3-4.6" />
    </svg>
  )
}
