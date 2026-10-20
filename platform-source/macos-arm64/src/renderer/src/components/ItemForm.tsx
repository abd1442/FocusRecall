import { t as uiText } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { UNIT_PRESETS, type Item, type ItemInput, type NotesTargetType } from '@core/types'
import { CategoryChooser } from './CategoryChooser'
import { ColorField } from './ColorField'
import { Button, Dialog, Field, Segmented, inputClass } from './ui'
import { categoryAndChildren } from '@core/library'
import { PRIOR_KNOWLEDGE, suggestNewField, type PriorKnowledge } from '@core/learning'
import { NumberStepper } from './NumberInputs'
import { useLibrary } from '../store/library'

interface Props {
  initial: ItemInput
  editing?: Item
  onSave: (input: ItemInput) => Promise<void>
  onCancel: () => void
}

const CUSTOM = '__custom__'

export { CategoryOptions } from './CategoryChooser'

export function ItemForm({ initial, editing, onSave, onCancel }: Props): React.JSX.Element {
  const [form, setForm] = useState<ItemInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const isPreset = (UNIT_PRESETS as readonly string[]).includes(form.defaultUnit)
  const [customUnit, setCustomUnit] = useState(!isPreset)
  const nameRef = useRef<HTMLInputElement>(null)
  const items = useLibrary((s) => s.items)
  const categories = useLibrary((s) => s.categories)
  const stats = useLibrary((s) => s.stats)
  // "New field for me" is suggested from the category until it is answered by hand.
  const [newFieldTouched, setNewFieldTouched] = useState(!!editing)

  useEffect(() => nameRef.current?.focus(), [])
  useEffect(() => {
    if (newFieldTouched) return
    const ids = new Set(categoryAndChildren(categories, form.categoryId))
    const seconds = items.filter((i) => ids.has(i.categoryId) && i.id !== editing?.id).reduce((s, i) => s + (stats.get(i.id)?.focusSeconds ?? 0), 0)
    setForm((f) => ({ ...f, newField: suggestNewField(seconds) }))
  }, [form.categoryId, newFieldTouched]) // eslint-disable-line react-hooks/exhaustive-deps
  const others = items.filter((i) => !i.archived && i.id !== editing?.id)

  const patch = (p: Partial<ItemInput>): void => setForm((f) => ({ ...f, ...p }))

  async function submit(e?: React.FormEvent): Promise<void> {
    e?.preventDefault()
    if (!form.name.trim()) {
      setError('Give the subject a name.')
      return
    }
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    }
  }

  return (
    <Dialog title={editing ? uiText("Edit subject") : uiText("New subject")} onClose={onCancel}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        {/* Two columns: what it is on the left, how it is measured and where its notes live on the right. */}
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Field label={uiText("Name")}>
              <input
                ref={nameRef}
                dir="auto"
                className={inputClass}
                value={form.name}
                placeholder={uiText("e.g. Structures, Atomic Habits")}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label={uiText("Category")}>
              <CategoryChooser value={form.categoryId} onChange={(categoryId) => patch({ categoryId })} />
            </Field>
            <Field label={uiText("Colour")}>
              <ColorField value={form.color} onChange={(color) => patch({ color })} />
            </Field>
          </div>

          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-5">
              <Field label={uiText("Progress unit")}>
                <select
                  className={inputClass}
                  value={customUnit ? CUSTOM : form.defaultUnit}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM) {
                      setCustomUnit(true)
                      patch({ defaultUnit: '' })
                    } else {
                      setCustomUnit(false)
                      patch({ defaultUnit: e.target.value })
                    }
                  }}
                >
                  {UNIT_PRESETS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value={CUSTOM}>{uiText("custom…")}</option>
                </select>
              </Field>
              <Field label={uiText("Total (optional)")} hint={uiText("For example 420 pages. Shows progress on the tile.")}>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.totalUnits ?? ''}
                  onChange={(e) =>
                    patch({
                      totalUnits: e.target.value === '' ? null : Number(e.target.value)
                    })
                  }
                />
              </Field>
            </div>
            {customUnit && (
              <Field label={uiText("Custom unit")}>
                <input
                  className={inputClass}
                  value={form.defaultUnit}
                  placeholder={uiText("e.g. exercises, modules")}
                  onChange={(e) => patch({ defaultUnit: e.target.value })}
                />
              </Field>
            )}

            <Field label={uiText("Notes page")}>
              <div>
                <Segmented<NotesTargetType>
                  value={form.notesTargetType==='notion'?'none':form.notesTargetType}
                  onChange={(notesTargetType) => patch({ notesTargetType })}
                  options={[
                    { value: 'none', label: 'None' },

                    { value: 'obsidian', label: 'Obsidian' }
                  ]}
                />
              </div>
            </Field>
            {form.notesTargetType === 'obsidian' && (
              <div className="grid grid-cols-2 gap-5">
                <Field label={uiText("Vault name")}>
                  <input className={inputClass} value={form.notesVault ?? ''} placeholder={uiText("My Vault")} onChange={(e) => patch({ notesVault: e.target.value })} />
                </Field>
                <Field label={uiText("File in vault")}>
                  <input
                    className={inputClass}
                    value={form.notesTarget ?? ''}
                    placeholder={uiText("Courses/Structures.md")}
                    onChange={(e) => patch({ notesTarget: e.target.value })}
                  />
                </Field>
              </div>
            )}

            <Field label={uiText("Prior knowledge")} hint={uiText("What you knew before starting. Stats compares new subjects with ones you knew.")}>
              <div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={uiText("Prior knowledge")}>
              {[...PRIOR_KNOWLEDGE.map((p) => ({ value: p.id as PriorKnowledge | null, label: p.label })), { value: null, label: 'Not said' }].map((o) => {
                const on = (form.priorKnowledge ?? null) === o.value
                return (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ priorKnowledge: o.value })}
                    className={`min-h-10 rounded-full border px-4 text-base transition-colors ${on ? 'border-transparent bg-focus text-on-accent' : 'border-line hover:border-muted'}`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-5">
              <Field label={uiText("Hours before FocusRecall")} hint={uiText("So the learning stage starts from the right place.")}>
                <NumberStepper value={form.hoursBefore ?? 0} onChange={(v) => patch({ hoursBefore: v ?? 0 })} label={uiText("Hours before FocusRecall")} />
              </Field>
              <Field label={uiText("New field for me")} hint={newFieldTouched ? undefined : uiText("Suggested from the category.")}>
                <div>
                  <Segmented<'yes' | 'no'>
                    value={form.newField ? 'yes' : 'no'}
                    onChange={(v) => {
                      setNewFieldTouched(true)
                      patch({ newField: v === 'yes' })
                    }}
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' }
                    ]}
                  />
                </div>
              </Field>
            </div>
            {others.length > 0 && (
              <Field label={uiText("Builds on")} hint={uiText("Optional. For example History 2 builds on History 1.")}>
                <div className="flex flex-wrap gap-2">
                  {others.map((o) => {
                    const on = (form.buildsOn ?? []).includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patch({ buildsOn: on ? (form.buildsOn ?? []).filter((x) => x !== o.id) : [...(form.buildsOn ?? []), o.id] })}
                        className={`flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-base transition-colors ${on ? 'border-transparent bg-focus text-on-accent' : 'border-line hover:border-muted'}`}
                      >
                        <span className="size-2.5 rounded-full" style={{ background: o.color }} />
                        <span dir="auto">{o.name}</span>
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}
          </div>
        </div>

        {error && <p role="alert" className="text-base text-status-error">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>{uiText("Cancel")}</Button>
          <Button variant="primary" type="submit">
            {editing ? uiText("Save") : uiText("Add subject")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
