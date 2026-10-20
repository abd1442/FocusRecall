import { t as uiText, displayField, displayGroup } from '../../i18n'
import { useMemo, useState } from 'react'
import {
  fieldByKey,
  resolveUnit,
  setupSummary,
  type FieldOption,
  type FieldType,
  type FieldValue,
  type GroupNotes,
  type LogField,
  type LogGroup,
  type LogValues,
  type ProgressValue,
  type Section
} from '@core/logfields'
import { useLogSchema } from '../../store/logSchema'
import { useSettings } from '../../store/session'
import { PlusIcon } from '../Icons'
import { Button, Menu, inputBase } from '../ui'
import { FieldInput } from './FieldInput'

type Update<T> = (update: (prev: T) => T) => void

interface Props {
  values: LogValues
  notes: GroupNotes
  onValues: Update<LogValues>
  onNotes: Update<GroupNotes>
  itemId: number
  itemUnit: string
  /** Start with the setup and "More detail" open (editing in History). */
  expanded?: boolean
  /** Render setup and extra groups together inside the parent details panel. */
  unified?: boolean
  /**
   * 'quick': only the per-subject questions. 'shared': only the study setup
   * and "More detail" (asked once per session). 'day': the questions asked
   * once per study day. 'all': quick, setup and detail.
   */
  part?: 'all' | 'quick' | 'shared' | 'day'
  /**
   * The after-session log: groups as large cards like the question cards
   * (big titles, large controls, an answered mark). Sliders still at their
   * default (`untouched`) count as answered once kept (`onKeep`) or moved.
   */
  cards?: boolean
  untouched?: number[]
  onKeep?: (fieldIds: number[]) => void
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'single', label: 'One choice' },
  { value: 'multi', label: 'Several choices' },
  { value: 'scale', label: 'Named scale' },
  { value: 'slider', label: 'Slider' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' }
]

/**
 * The after-block questions, built from the log schema. The quick part comes
 * first, then the study setup as one line, then "More detail" as cards.
 */
export function LogForm({ values, notes, onValues, onNotes, itemId, itemUnit, expanded = false, unified = false, part = 'all', cards = false, untouched = [], onKeep }: Props): React.JSX.Element {
  const schema = useLogSchema((s) => s.schema)
  const { settings, set } = useSettings()
  const [setupOpen, setSetupOpen] = useState(expanded)
  const [detailOpen, setDetailOpen] = useState(expanded || settings.logOpenGroups.length > 0)

  const groups = (section: Section): LogGroup[] =>
    schema.groups.filter((g) => g.section === section && !g.archived).sort((a, b) => a.sortOrder - b.sortOrder)
  const fieldsOf = (g: LogGroup): LogField[] =>
    schema.fields.filter((f) => f.groupId === g.id && !f.archived).sort((a, b) => a.sortOrder - b.sortOrder)

  const activityField = fieldByKey(schema, 'activity')
  const progressField = fieldByKey(schema, 'progress')
  const activity = activityField?.options.find((o) => o.id === values[activityField.id])

  const setValue = (field: LogField, v: FieldValue): void => {
    onKeep?.([field.id])
    onValues((prev) => {
      const next = { ...prev, [field.id]: v }
      // A different activity switches the progress unit (and clears the range).
      if (field.key === 'activity' && progressField) {
        const act = field.options.find((o) => o.id === v)
        const old = prev[progressField.id] as ProgressValue | undefined
        const unit = resolveUnit(act, itemId, itemUnit, settings.unitMemory)
        if (!old || old.unit !== unit) next[progressField.id] = { amount: old?.amount ?? null, unit, from: null, to: null }
      }
      return next
    })
  }
  const setNote = (groupId: number, text: string): void => onNotes((prev) => ({ ...prev, [groupId]: text }))

  const summary = useMemo(() => setupSummary(schema, values), [schema, values])
  const setupGroups = groups('setup')
  // In the log, the session note sits alone at the bottom of the screen (LogPanel), not among the groups.
  const detailGroups = groups('detail').filter((g) => !(cards && g.key === 'note'))
  const openGroups = new Set(settings.logOpenGroups)
  const toggleGroup = (id: number): void => {
    const next = openGroups.has(id) ? [...openGroups].filter((x) => x !== id) : [...openGroups, id]
    void set('logOpenGroups', next)
  }

  const card = (g: LogGroup, collapsible = false): React.JSX.Element => (
    <GroupCard
      key={g.id}
      group={g}
      fields={fieldsOf(g)}
      siblings={schema.groups.filter((x) => x.section === g.section && !x.archived).sort((a, b) => a.sortOrder - b.sortOrder)}
      values={values}
      note={notes[g.id] ?? ''}
      onValue={setValue}
      onNote={(t) => setNote(g.id, t)}
      activity={activity}
      itemUnit={itemUnit}
      itemId={itemId}
      collapsible={collapsible}
      open={!collapsible || openGroups.has(g.id) || expanded || cards}
      onToggle={() => toggleGroup(g.id)}
      large={cards}
      untouched={untouched}
      onKeep={onKeep}
    />
  )

  const quick = <div className="grid items-start gap-6 xl:grid-cols-2">{groups('quick').map((g) => card(g))}</div>
  if (part === 'quick') return quick
  if (part === 'day') return <div className="grid items-start gap-6 xl:grid-cols-2">{groups('day').map((g) => card(g))}</div>
  if (unified) return <div className="grid items-start gap-5">{[...setupGroups,...detailGroups].map(g=>card(g))}<AddGroup /></div>


  return (
    <div className="flex flex-col gap-6">
      {part === 'all' && quick}

      {setupGroups.length > 0 && (
        <section className={`rounded-2xl border border-line bg-surface ${cards ? 'py-6 pr-8 pl-9' : 'p-6'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <h3 className={cards ? 'text-2xl font-medium tracking-tight' : 'text-lg font-semibold'}>{uiText("Study setup")}</h3>
              <p className="mt-0.5 truncate text-base text-muted">{untouched.some(id => schema.fields.some(f => f.id === id && schema.groups.some(g => g.id === f.groupId && g.section === 'setup'))) && <span>{uiText("Suggested · not answered: ")}</span>}{summary || 'Not set yet. Change it once; it is remembered.'}</p>
            </div>
            <Button variant="quiet" onClick={() => setSetupOpen((v) => !v)}>
              {setupOpen ? uiText("Done") : uiText("Change")}
            </Button>
          </div>
          {setupOpen && <div className="mt-5 grid gap-6 border-t border-line pt-5">{setupGroups.map((g) => card(g))}</div>}
        </section>
      )}

      {cards ? (
        <button
          type="button"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((v) => !v)}
          className="flex items-center gap-4 rounded-2xl border border-dashed border-line px-8 py-5 text-left transition-colors hover:border-muted"
        >
          <span className="text-2xl font-medium tracking-tight">{detailOpen ? uiText("Less detail") : uiText("More detail")}</span>
          <span className="flex-1 text-base text-muted">{uiText("Optional: food, methods, how you felt. Only what you want to note this time.")}</span>
          <span className="text-2xl text-muted" aria-hidden="true">
            {detailOpen ? '−' : '+'}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setDetailOpen((v) => !v)}>
            {detailOpen ? uiText("− Less detail") : uiText("+ More detail")}
          </Button>
          <span className="text-sm text-muted">{uiText("Optional. Only what you want to note this time.")}</span>
        </div>
      )}
      {detailOpen && (
        <>
          <div className={`grid items-start ${cards ? 'gap-5' : 'gap-6 xl:grid-cols-2 2xl:grid-cols-3'}`}>{detailGroups.map((g) => card(g, !cards))}</div>
          <AddGroup />
        </>
      )}
    </div>
  )
}

function GroupCard({
  group,
  fields,
  siblings,
  values,
  note,
  onValue,
  onNote,
  activity,
  itemUnit,
  itemId,
  collapsible,
  open,
  onToggle,
  large = false,
  untouched = [],
  onKeep
}: {
  large?: boolean
  untouched?: number[]
  onKeep?: (fieldIds: number[]) => void
  group: LogGroup
  fields: LogField[]
  siblings: LogGroup[]
  values: LogValues
  note: string
  onValue: (f: LogField, v: FieldValue) => void
  onNote: (t: string) => void
  activity: FieldOption | undefined
  itemUnit: string
  itemId: number
  collapsible: boolean
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(group.name)
  const [adding, setAdding] = useState(false)
  const ids = siblings.map((g) => g.id)
  const i = ids.indexOf(group.id)
  const move = (d: -1 | 1): void => {
    const next = [...ids]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    void window.api.invoke('log:reorder', 'group', next)
  }
  const answered = fields.filter((f) => values[f.id] !== undefined && values[f.id] !== null).length
  // A group whose only field has the group's name does not repeat the label.
  const single = fields.length === 1 && fields[0].label === group.name
  // Sliders filled in for you, not yet confirmed or moved.
  const pending = fields.filter((f) => untouched.includes(f.id) && values[f.id] !== undefined && values[f.id] !== null).map((f) => f.id)
  const done = answered > 0 && pending.length === 0

  return (
    <section className={`relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-line bg-surface ${large ? 'py-7 pr-8 pl-9' : 'p-6'}`}>
      {large && <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 transition-colors ${done ? 'bg-focus' : 'bg-transparent'}`} />}
      <div className="flex items-center gap-2">
        {renaming ? (
          <input
            autoFocus
            dir="auto"
            className={`${inputBase} flex-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              setRenaming(false)
              if (name.trim() && name !== group.name) await window.api.invoke('log:saveGroup', { id: group.id, name })
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : collapsible ? (
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left">
            <span className="text-muted">{open ? '▾' : '▸'}</span>
            <h3 className="text-lg font-semibold">{displayGroup(group)}</h3>
            {!open && answered > 0 && <span className="text-sm text-muted">{answered}{uiText(" answered")}</span>}
          </button>
        ) : (
          <h3 className={`flex-1 ${large ? 'text-2xl font-medium tracking-tight' : 'text-lg font-semibold'}`}>{displayGroup(group)}</h3>
        )}
        {pending.length > 0 && onKeep && (
          <Button variant="quiet" size="sm" onClick={() => onKeep(pending)}>{uiText("Confirm suggestions")}</Button>
        )}
        {large && (
          <span
            role="img"
            aria-label={done ? uiText("Answered") : uiText("Not answered yet")}
            className={`grid size-8 shrink-0 place-items-center rounded-full text-base transition-colors ${
              done ? 'bg-focus/15 text-focus' : 'border border-dashed border-line text-transparent'
            }`}
          >
            ✓
          </span>
        )}
        <Menu
          label={`Options for ${group.name}`}
          items={[
            { label: 'Rename…', onSelect: () => setRenaming(true) },
            { label: 'Move earlier', disabled: i <= 0, onSelect: () => move(-1) },
            { label: 'Move later', disabled: i < 0 || i >= ids.length - 1, onSelect: () => move(1) },
            'separator',
            {
              label: 'Archive group',
              danger: true,
              disabled: group.key === 'did' || group.key === 'went',
              onSelect: () => window.api.invoke('log:setArchived', 'group', group.id, true)
            }
          ]}
        />
      </div>

      {pending.length > 0 && <p className="text-xs text-muted">{uiText("Suggested values are excluded until confirmed.")}</p>}
      {open && (
        <>
          {fields.map((f) =>
            large ? (
              <div key={f.id} className="flex flex-col gap-2.5">
                {!single && <span className="text-lg">{displayField(f).label}</span>}
                <FieldInput suggested={untouched.includes(f.id)} field={f} value={values[f.id]} onChange={(v) => onValue(f, v)} activity={activity} itemUnit={itemUnit} itemId={itemId} showLabel={false} large />
              </div>
            ) : (
              <FieldInput suggested={untouched.includes(f.id)} key={f.id} field={f} value={values[f.id]} onChange={(v) => onValue(f, v)} activity={activity} itemUnit={itemUnit} itemId={itemId} showLabel={!single} />
            )
          )}
          {adding ? (
            <AddField groupId={group.id} onDone={() => setAdding(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <input
                dir="auto"
                aria-label={uiText("Note for {value0}", {value0: (group.name)})}
                placeholder={uiText("Note (optional)")}
                className={`${inputBase} min-w-48 flex-1 text-base`}
                value={note}
                onChange={(e) => onNote(e.target.value)}
              />
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <PlusIcon />{uiText(" Add field")}</Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function AddField({ groupId, onDone }: { groupId: number; onDone: () => void }): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('single')
  const save = async (): Promise<void> => {
    if (label.trim()) await window.api.invoke('log:saveField', { groupId, label, type })
    onDone()
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void save()
        }
        if (e.key === 'Escape') onDone()
      }}
    >
      <input autoFocus dir="auto" className={`${inputBase} min-w-40 flex-1`} placeholder={uiText("Field name")} value={label} onChange={(e) => setLabel(e.target.value)} />
      <select aria-label={uiText("Kind of answer")} className={`${inputBase} w-44`} value={type} onChange={(e) => setType(e.target.value as FieldType)}>
        {FIELD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <Button variant="primary" size="sm" onClick={save}>{uiText("Add")}</Button>
      <Button variant="ghost" size="sm" onClick={onDone}>{uiText("Cancel")}</Button>
    </div>
  )
}

function AddGroup(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!open) {
    return (
      <Button variant="quiet" className="self-start" onClick={() => setOpen(true)}>
        <PlusIcon />{uiText(" Add group")}</Button>
    )
  }
  const save = async (): Promise<void> => {
    if (name.trim()) await window.api.invoke('log:saveGroup', { name, section: 'detail' })
    setOpen(false)
    setName('')
  }
  return (
    <div className="flex max-w-xl items-center gap-2">
      <input
        autoFocus
        dir="auto"
        className={`${inputBase} flex-1`}
        placeholder={uiText("Group name, e.g. Environment")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <Button variant="primary" onClick={save}>{uiText("Add group")}</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>{uiText("Cancel")}</Button>
    </div>
  )
}
