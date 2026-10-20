import { t as uiText } from '../i18n'
import { useState } from 'react'
import { uniqueOptionId, type FieldOption, type LogField, type LogGroup, type Section } from '@core/logfields'
import { PlusIcon, PencilIcon } from '../components/Icons'
import { Button, Menu, inputBase } from '../components/ui'
import { useLogSchema } from '../store/logSchema'
import { QuestionPreview, QuestionTypeIcon } from '../components/QuestionPreview'
import { SettingIcon } from '../components/SettingsGuide'

const SECTIONS: { id: Section; title: string; hint: string }[] = [
  { id: 'quick', title: 'Asked every time', hint: 'The quick part of the log, per subject.' },
  { id: 'setup', title: 'Study setup', hint: 'Remembered; shown as one line with Change.' },
  { id: 'day', title: 'Once a day', hint: 'The daily check-in on Home. The answers go with every session that study day.' },
  { id: 'detail', title: 'More detail', hint: 'Per session, optional, folded away.' }
]

/** How often a group is asked; the quick groups stay as they are. */
const SCOPES: { id: Exclude<Section, 'quick'>; label: string }[] = [
  { id: 'detail', label: 'Ask per session (More detail)' },
  { id: 'setup', label: 'Remember it (Study setup)' },
  { id: 'day', label: 'Ask once a day (check-in)' }
]

const TYPE_NAMES: Record<LogField['type'], string> = {
  single: 'One choice',
  multi: 'Several choices',
  scale: 'Named scale',
  slider: 'Slider',
  number: 'Number',
  text: 'Text',
  activity: 'Activity',
  progress: 'Progress'
}

/** Settings → Log questions: every group, field and option, editable. */
export function LogQuestions(): React.JSX.Element {
  const schema = useLogSchema((s) => s.schema)
  const [showArchived, setShowArchived] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-2xl border border-recall/25 bg-recall/5 p-5"><div className="flex items-start gap-4"><SettingIcon title={uiText("Log questions")}/><div><h2 className="text-xl font-semibold">{uiText("Build a log that fits your study")}</h2></div></div><nav aria-label={uiText("Question frequency")} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SECTIONS.map((sec,i)=>{const count=schema.fields.filter(f=>!f.archived&&schema.groups.some(g=>g.id===f.groupId&&!g.archived&&g.section===sec.id)).length;return <button key={sec.id} type="button" className="question-frequency-card flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-recall" onClick={()=>document.getElementById('questions-'+sec.id)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><svg aria-hidden="true" viewBox="0 0 80 36" className="h-9 w-20" fill="none"><rect x="2" y="2" width="76" height="32" rx="8" fill="var(--tf-recall)" opacity=".1"/>{i===0?<><circle cx="18" cy="18" r="6" stroke="var(--tf-recall)" strokeWidth="2"/><path d="M30 18h12 M47 18h12 M64 18h8" stroke="var(--tf-recall)" strokeWidth="3"/></>:i===1?<><rect x="12" y="10" width="18" height="16" rx="3" stroke="var(--tf-recall)" strokeWidth="2"/><path d="m39 19 7 7 14-16" stroke="var(--tf-rest)" strokeWidth="3"/></>:i===2?<><rect x="17" y="7" width="45" height="24" rx="4" stroke="var(--tf-recall)" strokeWidth="2"/><path d="M17 14h45 M27 5v7 M51 5v7" stroke="var(--tf-recall)" strokeWidth="2"/><circle cx="40" cy="22" r="4" fill="var(--tf-recall)"/></>:<><path d="M17 12h45 M17 19h30 M17 26h20" stroke="var(--tf-recall)" strokeWidth="3"/><path d="m56 22 5 5 6-6" stroke="var(--tf-recall)" strokeWidth="2"/></>}</svg><strong>{sec.title}</strong><span className="text-sm text-muted">{count}{uiText(" active questions")}</span></button>})}</nav></div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-base text-muted">{uiText("Archive hides future questions; past answers stay.")}</p>
        <label className="flex shrink-0 items-center gap-2 text-base text-muted">
          <input type="checkbox" className="size-4" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{uiText("Show archived")}</label>
      </div>
      {SECTIONS.map((sec) => {
        const groups = schema.groups.filter((g) => g.section === sec.id && (showArchived || !g.archived)).sort((a, b) => a.sortOrder - b.sortOrder)
        return (
          <section key={sec.id} id={'questions-'+sec.id} className="flex scroll-mt-6 flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">{sec.title}</h2>
              <p className="text-base text-muted">{sec.hint}</p>
            </div>
            {groups.map((g, i) => (
              <GroupEditor
                key={g.id}
                group={g}
                siblings={groups}
                index={i}
                fields={schema.fields.filter((f) => f.groupId === g.id && (showArchived || !f.archived)).sort((a, b) => a.sortOrder - b.sortOrder)}
                allGroups={schema.groups.filter((x) => !x.archived)}
              />
            ))}
            {sec.id !== 'quick' && <NewGroup section={sec.id} />}
          </section>
        )
      })}
    </div>
  )
}

function GroupEditor({
  group,
  siblings,
  index,
  fields,
  allGroups
}: {
  group: LogGroup
  siblings: LogGroup[]
  index: number
  fields: LogField[]
  allGroups: LogGroup[]
}): React.JSX.Element {
  const builtIn = group.key === 'did' || group.key === 'went'
  const move = (d: -1 | 1): void => {
    const ids = siblings.map((g) => g.id)
    ;[ids[index], ids[index + d]] = [ids[index + d], ids[index]]
    void window.api.invoke('log:reorder', 'group', ids)
  }
  return (
    <div data-group-id={group.id} className={`rounded-2xl border border-line bg-surface ${group.archived ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4"><SettingIcon title={uiText("Log questions")}/>
        <InlineName value={group.name} onSave={(name) => window.api.invoke('log:saveGroup', { id: group.id, name })} className="text-lg font-semibold" />
        <span className="rounded-full bg-recall/10 px-3 py-1 text-xs text-recall">{fields.length}{uiText(" questions")}</span>
        {group.archived && <span className="text-sm text-muted">{uiText("archived")}</span>}
        <span className="flex-1" />
        <Menu
          label={`Options for ${group.name}`}
          items={[
            { label: 'Move earlier', disabled: index === 0, onSelect: () => move(-1) },
            { label: 'Move later', disabled: index === siblings.length - 1, onSelect: () => move(1) },
            ...(group.section === 'quick'
              ? []
              : [
                  'separator' as const,
                  ...SCOPES.filter((sc) => sc.id !== group.section).map((sc) => ({
                    label: sc.label,
                    onSelect: () => window.api.invoke('log:saveGroup', { id: group.id, name: group.name, section: sc.id })
                  }))
                ]),
            'separator',
            group.archived
              ? { label: 'Restore group', onSelect: () => window.api.invoke('log:setArchived', 'group', group.id, false) }
              : { label: 'Archive group', danger: true, disabled: builtIn, onSelect: () => window.api.invoke('log:setArchived', 'group', group.id, true) }
          ]}
        />
      </div>
      <ul className="divide-y divide-line">
        {fields.map((f, i) => (
          <FieldEditor key={f.id} field={f} siblings={fields} index={i} groups={allGroups} />
        ))}
      </ul>
      <div className="px-6 py-3">
        <NewField groupId={group.id} />
      </div>
    </div>
  )
}

function FieldEditor({ field, siblings, index, groups }: { field: LogField; siblings: LogField[]; index: number; groups: LogGroup[] }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [preview, setPreview] = useState(false)
  const builtIn = field.type === 'activity' || field.type === 'progress' || field.key === 'focus' || field.key === 'difficulty' || field.key === 'understanding'
  const hasOptions = field.type === 'single' || field.type === 'multi' || field.type === 'activity'
  const hasScale = field.type === 'scale' || field.type === 'slider'
  const move = (d: -1 | 1): void => {
    const ids = siblings.map((f) => f.id)
    ;[ids[index], ids[index + d]] = [ids[index + d], ids[index]]
    void window.api.invoke('log:reorder', 'field', ids)
  }
  const count = hasOptions ? field.options.filter((o) => !o.archived).length : null

  return (
    <li id={`log-question-${field.id}`} data-field-id={field.id} className={`px-6 py-3 ${field.archived ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><QuestionTypeIcon type={field.type}/>
        <InlineName value={field.label} onSave={(label) => window.api.invoke('log:saveField', { id: field.id, groupId: field.groupId, label })} className="text-base font-medium" />
        <span className="rounded-md bg-surface-2 px-2 py-1 text-sm text-muted">
          {TYPE_NAMES[field.type]}
          {count !== null ? uiText(" · {value0} options", {value0: (count)}) : ''}
          {field.archived ? uiText(" · archived") : ''}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="quiet" aria-label={uiText("Preview question: {value0}", {value0: (field.label)})} aria-expanded={preview} onClick={()=>setPreview(!preview)}>{preview?uiText("Hide preview"):uiText("Preview")}</Button>
        {(hasOptions || hasScale) && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? uiText("Close") : hasOptions ? uiText("Edit options") : uiText("Edit names")}
          </Button>
        )}
        <Menu
          label={`Options for ${field.label}`}
          items={[
            { label: 'Move earlier', disabled: index === 0, onSelect: () => move(-1) },
            { label: 'Move later', disabled: index === siblings.length - 1, onSelect: () => move(1) },
            { label: 'Move to another group…', disabled: builtIn, onSelect: () => setMoving(true) },
            'separator',
            field.archived
              ? { label: 'Restore question', onSelect: () => window.api.invoke('log:setArchived', 'field', field.id, false) }
              : { label: 'Archive question', danger: true, disabled: builtIn, onSelect: () => window.api.invoke('log:setArchived', 'field', field.id, true) }
          ]}
        />
      </div>
      {preview && <QuestionPreview field={field}/>}
      {moving && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/40 p-3">
          <span className="text-base text-muted">{uiText("Move to")}</span>
          <select
            autoFocus
            aria-label={uiText("Group")}
            className={`${inputBase} min-w-72`}
            defaultValue=""
            onChange={async (e) => {
              const groupId = Number(e.target.value)
              if (!groupId) return
              await window.api.invoke('log:saveField', { id: field.id, groupId, label: field.label })
              setMoving(false)
            }}
          >
            <option value="" disabled>{uiText("Choose a group")}</option>
            {SECTIONS.filter((sec) => sec.id !== 'quick').map((sec) => (
              <optgroup key={sec.id} label={sec.title}>
                {groups
                  .filter((g) => g.section === sec.id && g.id !== field.groupId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <span className="text-sm text-muted">{uiText("The question is then asked the way that group is.")}</span>
          <Button variant="ghost" size="sm" onClick={() => setMoving(false)}>{uiText("Cancel")}</Button>
        </div>
      )}
      {open && hasOptions && <OptionsEditor field={field} />}
      {open && hasScale && <ScaleEditor field={field} />}
    </li>
  )
}

function OptionsEditor({ field }: { field: LogField }): React.JSX.Element {
  const [adding, setAdding] = useState('')
  const save = (options: FieldOption[]): Promise<void> => window.api.invoke('log:saveOptions', field.id, options)
  const opts = field.options
  const move = (i: number, d: -1 | 1): void => {
    const next = [...opts]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    void save(next)
  }
  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-surface-2/40 p-3">
      {opts.map((o, i) => (
        <div key={o.id} className={`flex items-center gap-2 ${o.archived ? 'opacity-55' : ''}`}>
          <InlineName value={o.label} onSave={(label) => save(opts.map((x) => (x.id === o.id ? { ...x, label } : x)))} className="flex-1 text-base" />
          {o.defaultUnit && <span className="text-sm text-muted">{o.defaultUnit}</span>}
          <Button variant="ghost" size="sm" aria-label={uiText("Move up")} disabled={i === 0} onClick={() => move(i, -1)}>
            ↑
          </Button>
          <Button variant="ghost" size="sm" aria-label={uiText("Move down")} disabled={i === opts.length - 1} onClick={() => move(i, 1)}>
            ↓
          </Button>
          <Button variant="ghost" size="sm" onClick={() => save(opts.map((x) => (x.id === o.id ? { ...x, archived: !x.archived } : x)))}>
            {o.archived ? uiText("Restore") : uiText("Archive")}
          </Button>
        </div>
      ))}
      <form
        className="mt-1 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const label = adding.trim()
          if (!label) return
          setAdding('')
          void save([...opts, { id: uniqueOptionId(label, opts), label }])
        }}
      >
        <input dir="auto" className={`${inputBase} flex-1`} placeholder={uiText("New option")} value={adding} onChange={(e) => setAdding(e.target.value)} />
        <Button variant="quiet" size="sm" type="submit">
          <PlusIcon />{uiText(" Add option")}</Button>
      </form>
    </div>
  )
}

/** The names of a scale's stops. The number of names is fixed; their words are yours. */
function ScaleEditor({ field }: { field: LogField }): React.JSX.Element {
  const scale = field.scale ?? { min: 1, max: 5, labels: ['Very low', 'Low', 'Medium', 'High', 'Very high'] }
  return (
    <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-surface-2/40 p-3">
      {scale.labels.map((l, i) => (
        <InlineName
          key={i}
          value={l}
          className="min-w-24 text-base"
          onSave={(label) =>
            window.api.invoke('log:saveField', {
              id: field.id,
              groupId: field.groupId,
              label: field.label,
              scale: { ...scale, labels: scale.labels.map((x, j) => (j === i ? label : x)) }
            })
          }
        />
      ))}
    </div>
  )
}

function NewField({ groupId }: { groupId: number }): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<LogField['type']>('single')
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!label.trim()) return
        await window.api.invoke('log:saveField', { groupId, label, type })
        setLabel('')
      }}
    >
      <input dir="auto" className={`${inputBase} min-w-56 flex-1`} placeholder={uiText("New question")} value={label} onChange={(e) => setLabel(e.target.value)} />
      <select aria-label={uiText("Kind of answer")} className={`${inputBase} w-48`} value={type} onChange={(e) => setType(e.target.value as LogField['type'])}>
        {(['single', 'multi', 'scale', 'slider', 'number', 'text'] as const).map((t) => (
          <option key={t} value={t}>
            {TYPE_NAMES[t]}
          </option>
        ))}
      </select>
      <Button variant="quiet" size="sm" type="submit">
        <PlusIcon />{uiText(" Add question")}</Button>
    </form>
  )
}

function NewGroup({ section }: { section: Section }): React.JSX.Element {
  const [name, setName] = useState('')
  return (
    <form
      className="flex max-w-xl items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await window.api.invoke('log:saveGroup', { name, section })
        setName('')
      }}
    >
      <input dir="auto" className={`${inputBase} flex-1`} placeholder={uiText("New group")} value={name} onChange={(e) => setName(e.target.value)} />
      <Button variant="quiet" type="submit">
        <PlusIcon />{uiText(" Add group")}</Button>
    </form>
  )
}

/** Text that turns into an input on click and saves on Enter or blur. */
function InlineName({ value, onSave, className = '' }: { value: string; onSave: (v: string) => unknown; className?: string }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  if (!editing) {
    return (
      <button type="button" onClick={() => (setText(value), setEditing(true))} className={`inline-flex items-center gap-2 rounded-md px-1 text-left hover:bg-surface-2 ${className}`} title={uiText("Rename")}>
        {value}
        <PencilIcon className="shrink-0 text-muted opacity-60"/>
      </button>
    )
  }
  const commit = (): void => {
    setEditing(false)
    if (text.trim() && text !== value) void onSave(text.trim())
  }
  return (
    <input
      autoFocus
      dir="auto"
      className={`${inputBase} ${className}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}
