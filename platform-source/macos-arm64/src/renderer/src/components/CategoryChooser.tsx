import { t as uiText } from '../i18n'
import { useState } from 'react'
import { categoryTree } from '@core/library'
import { ITEM_PALETTE, nextPaletteColor } from '@core/palette'
import type { Category, Id } from '@core/types'
import { useLibrary } from '../store/library'
import { Button, inputBase } from './ui'

/** Options for a category select: top-level categories with their sub-categories indented. */
export function CategoryOptions({ categories, keepId }: { categories: Category[]; keepId?: number }): React.JSX.Element {
  return (
    <>
      {categoryTree(categories, true)
        .filter((n) => !n.category.archived || n.category.id === keepId)
        .map(({ category: c, depth }) => (
          <option key={c.id} value={c.id}>
            {depth ? `    ${c.name}` : c.name}
          </option>
        ))}
    </>
  )
}

/**
 * A category select with "+ New category" beside it. A new category (or
 * sub-category) is named and coloured right there and selected at once.
 */
export function CategoryChooser({
  value,
  onChange,
  className = 'w-full'
}: {
  value: Id
  onChange: (id: Id) => void
  className?: string
}): React.JSX.Element {
  const categories = useLibrary((s) => s.categories)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextPaletteColor(categories.map((c) => c.color)))
  const [parentId, setParentId] = useState<Id | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tops = categoryTree(categories).filter((n) => n.depth === 0)

  async function create(): Promise<void> {
    if (!name.trim()) {
      setError('Give it a name.')
      return
    }
    try {
      const c = await useLibrary.getState().createCategory({ name, color, icon: null, parentId })
      onChange(c.id)
      setCreating(false)
      setName('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex gap-2">
        <select aria-label={uiText("Category")} className={`${inputBase} min-w-0 flex-1`} value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {value===0&&<option value={0}>{uiText("General (created when saved)")}</option>}
          <CategoryOptions categories={categories} keepId={value} />
        </select>
        {!creating && (
          <Button variant="quiet" onClick={() => setCreating(true)}>{uiText("+ New category")}</Button>
        )}
      </div>
      {creating && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/40 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              void create()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setCreating(false)
            }
          }}
        >
          <div className="flex flex-wrap gap-2">
            <input autoFocus dir="auto" className={`${inputBase} min-w-48 flex-1`} placeholder={uiText("New category name")} value={name} onChange={(e) => setName(e.target.value)} />
            <select
              aria-label={uiText("Where")}
              className={`${inputBase} w-56`}
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">{uiText("Top level")}</option>
              {tops.map(({ category: c }) => (
                <option key={c.id} value={c.id}>{uiText("Inside ")}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ITEM_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={uiText("Colour {value0}", {value0: (c)})}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`size-7 rounded-full ${c === color ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c }}
              />
            ))}
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>{uiText("Cancel")}</Button>
            <Button variant="primary" size="sm" onClick={create}>{uiText("Add and select")}</Button>
          </div>
          {error && <p role="alert" className="text-base text-status-error">{error}</p>}
        </div>
      )}
    </div>
  )
}
