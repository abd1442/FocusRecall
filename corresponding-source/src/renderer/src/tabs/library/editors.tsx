import { t as uiText } from '../../i18n'
import { useState } from 'react'
import { categoryMoveError, categoryTree } from '@core/library'
import { nextPaletteColor } from '@core/palette'
import type { Category, Id, Item, ItemInput } from '@core/types'
import { ColorField } from '../../components/ColorField'
import { CategoryChooser } from '../../components/CategoryChooser'
import { Button, Dialog, Field, inputClass } from '../../components/ui'
import { useLibrary } from '../../store/library'

export function blankItem(categoryId: Id, items: Item[]): ItemInput {
  return {
    categoryId,
    name: '',
    color: nextPaletteColor(items.map((i) => i.color)),
    defaultUnit: 'pages',
    totalUnits: null,
    notesTargetType: 'none',
    notesTarget: null,
    notesVault: null,
    priorKnowledge: null,
    buildsOn: [],
    hoursBefore: 0,
    newField: null
  }
}

export function toInput(i: Item): ItemInput {
  return {
    categoryId: i.categoryId,
    name: i.name,
    color: i.color,
    defaultUnit: i.defaultUnit,
    totalUnits: i.totalUnits,
    notesTargetType: i.notesTargetType,
    notesTarget: i.notesTarget,
    notesVault: i.notesVault,
    priorKnowledge: i.priorKnowledge,
    buildsOn: i.buildsOn,
    hoursBefore: i.hoursBefore,
    newField: i.newField
  }
}

export type CategoryDialogState = { mode: 'new'; parentId: Id | null } | { mode: 'edit'; category: Category }

/** Name and colour for a category or sub-category. */
export function CategoryEditor({
  dialog,
  onClose,
  onCreated
}: {
  dialog: CategoryDialogState
  onClose: () => void
  onCreated?: (c: Category) => void
}): React.JSX.Element {
  const categories = useLibrary((s) => s.categories)
  const editing = dialog.mode === 'edit' ? dialog.category : null
  const parentId = editing ? editing.parentId : dialog.mode === 'new' ? dialog.parentId : null
  const [name, setName] = useState(editing?.name ?? '')
  const [color, setColor] = useState(editing?.color ?? nextPaletteColor(categories.map((c) => c.color)))
  const [error, setError] = useState<string | null>(null)
  const lib = useLibrary.getState()
  const parent = categories.find((c) => c.id === parentId)

  async function save(): Promise<void> {
    if (!name.trim()) {
      setError('Give it a name.')
      return
    }
    const input = { name: name.trim(), color, icon: null, parentId }
    try {
      if (editing) await lib.updateCategory(editing.id, input)
      else {
        // Creation must happen even when the caller does not need the new category.
        const category = await lib.createCategory(input)
        onCreated?.(category)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    }
  }

  const title = editing ? `Edit ${editing.parentId ? 'sub-category' : 'category'}` : parent ? `New sub-category in ${parent.name}` : 'New category'

  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          <Field label={uiText("Name")}>
            <input autoFocus dir="auto" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={uiText("Colour")}>
            <ColorField value={color} onChange={setColor} />
          </Field>
        </div>
        {error && <p role="alert" className="text-base text-status-error">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>{uiText("Cancel")}</Button>
          <Button variant="primary" type="submit">
            {editing ? uiText("Save") : uiText("Add")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export type MoveDialogState = { kind: 'category'; category: Category } | { kind: 'item'; item: Item }

export function MoveEditor({ dialog, onClose }: { dialog: MoveDialogState; onClose: () => void }): React.JSX.Element {
  const categories = useLibrary((s) => s.categories)
  const lib = useLibrary.getState()
  const [error, setError] = useState<string | null>(null)

  if (dialog.kind === 'item') {
    return (
      <Dialog title={uiText("Move {value0}", {value0: (dialog.item.name)})} onClose={onClose}>
        <MoveItemForm
          initial={dialog.item.categoryId}
          onCancel={onClose}
          onMove={async (categoryId) => {
            await lib.moveItem(dialog.item.id, categoryId)
            onClose()
          }}
        />
      </Dialog>
    )
  }

  const c = dialog.category
  const options = [
    { id: null as Id | null, label: 'Top level (a category of its own)' },
    ...categoryTree(categories)
      .filter((n) => n.depth === 0 && n.category.id !== c.id)
      .map((n) => ({
        id: n.category.id as Id | null,
        label: `Inside ${n.category.name}`
      }))
  ]
  return (
    <Dialog title={uiText("Move {value0}", {value0: (c.name)})} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const err = categoryMoveError(categories, c.id, o.id)
          const here = o.id === c.parentId
          return (
            <button
              key={String(o.id)}
              type="button"
              disabled={!!err || here}
              title={err ?? undefined}
              onClick={async () => {
                try {
                  await lib.moveCategory(c.id, o.id)
                  onClose()
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e))
                }
              }}
              className="flex min-h-12 items-center justify-between rounded-lg px-4 text-left text-base hover:bg-surface-2 disabled:opacity-40"
            >
              {o.label}
              {here && <span className="text-sm text-muted">{uiText("current")}</span>}
            </button>
          )
        })}
        {error && <p role="alert" className="mt-2 text-base text-status-error">{error}</p>}
        {categories.some((x) => x.parentId === c.id) && (
          <p className="mt-2 text-sm text-muted">{uiText("This category has sub-categories, so it can only stay at the top level.")}</p>
        )}
      </div>
    </Dialog>
  )
}

function MoveItemForm({ initial, onCancel, onMove }: { initial: Id; onCancel: () => void; onMove: (categoryId: Id) => Promise<void> }): React.JSX.Element {
  const [target, setTarget] = useState<Id>(initial)
  return (
    <div className="flex flex-col gap-6">
      <Field label={uiText("Move to")}>
        <CategoryChooser value={target} onChange={setTarget} />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>{uiText("Cancel")}</Button>
        <Button variant="primary" disabled={target === initial} onClick={() => onMove(target)}>{uiText("Move")}</Button>
      </div>
    </div>
  )
}
