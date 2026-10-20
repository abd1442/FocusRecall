import { t as uiText, useLanguage } from '../i18n'
import { DEFAULT_HOME_ORDER, orderHomeSubjects } from '@core/homePreferences'
import { useSettings } from '../store/session'
import { useBlocks } from '../store/blocks'
import { HomeSubjectTools } from './HomeSubjectTools'
const NO_BLOCKS: ReturnType<typeof useBlocks.getState>['blocks'] = []
import { SubjectCardAccent, subjectPanelStyle } from './SubjectPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { orderSubjects } from '@core/library'
import { nextPaletteColor } from '@core/palette'
import type { Id, PickerItem } from '@core/types'
import { useLibrary } from '../store/library'
import { PlusIcon } from './Icons'
import { CategoryChooser } from './CategoryChooser'
import { Button, inputBase, inputClass, relativeDay } from './ui'

interface Props {
  homeOrdering?:boolean
  onOrder?: (items:PickerItem[])=>void
  createRequest?:number
  selectedId: Id | null
  onSelect: (item: PickerItem) => void
  /** Enter or double-click on the selected subject. */
  onConfirm?: () => void
  autoFocus?: boolean
  /** Tiles for Home; a list inside dialogs. */
  layout?: 'tiles' | 'list'
  /** Subjects not to offer (for example the one you are switching away from). */
  excludeIds?: Id[]
}

/**
 * Searchable subjects, most recently studied first, with an inline "+ New"
 * that needs only a name and a category (or sub-category).
 */
export function ItemPicker({ homeOrdering=false, onOrder, createRequest=0, selectedId, onSelect, onConfirm, autoFocus, layout = 'list', excludeIds }: Props): React.JSX.Element {
  const [items, setItems] = useState<PickerItem[]>([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const language=useLanguage()
  const preference=useSettings(s=>homeOrdering?s.settings.homeSubjectOrdering:DEFAULT_HOME_ORDER)
  const blocks=useBlocks(s=>homeOrdering?s.blocks:NO_BLOCKS)
  const seconds=useMemo(()=>{const totals=new Map<number,number>();for(const b of blocks)totals.set(b.itemId,(totals.get(b.itemId)??0)+b.focusSeconds);return totals},[blocks])
  const ordered=useMemo(()=>homeOrdering?orderHomeSubjects(items,preference,seconds,language):items,[items,preference,seconds,language,homeOrdering])
  useEffect(()=>{if(homeOrdering)onOrder?.(ordered)},[homeOrdering,onOrder,ordered])
  useEffect(()=>{if(createRequest)setCreating(true)},[createRequest])
  const libraryItems = useLibrary((s) => s.items)
  const search=useRef<HTMLInputElement>(null)
  useEffect(()=>{if(autoFocus)search.current?.focus({preventScroll:true})},[autoFocus])

  useEffect(() => {
    void window.api.invoke('library:listPickerItems').then((rows) => setItems(orderSubjects(rows)))
  }, [libraryItems])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const offered = excludeIds?.length ? ordered.filter((i) => !excludeIds.includes(i.id)) : ordered
    if (!q) return offered
    return offered.filter((i) => i.name.toLowerCase().includes(q) || i.categoryName.toLowerCase().includes(q))
  }, [ordered, query, excludeIds])

  function onKeyDown(e: React.KeyboardEvent): void {
    if (!filtered.length) return
    const idx = filtered.findIndex((i) => i.id === selectedId)
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    // Left/Right belong to caret movement in the search field, including RTL.
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onSelect(filtered[Math.min(filtered.length - 1, idx + 1)])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onSelect(filtered[Math.max(0, idx - 1)])
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (idx >= 0) onConfirm?.()
      else onSelect(filtered[0])
    }
  }

  const created = async (id: Id): Promise<void> => {
    setCreating(false)
    setQuery('')
    const fresh = await window.api.invoke('library:listPickerItems')
    setItems(fresh)
    const item = fresh.find((i) => i.id === id)
    if (item) onSelect(item)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex min-w-0 items-center gap-3">
      <input
        ref={search}
        dir="auto"
        className={`${inputClass} subject-search min-h-13 min-w-0 flex-1 text-lg`}
        placeholder={uiText("Search subjects…")}
        aria-label={uiText("Search subjects")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {homeOrdering&&<HomeSubjectTools items={ordered}/>}
      </div>

      {layout === 'tiles' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4" role="listbox" aria-label={uiText('Subjects')}>
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selectedId}
              onClick={() => onSelect(item)}
              onDoubleClick={() => {
                onSelect(item)
                onConfirm?.()
              }}
              style={subjectPanelStyle(item.color)}
              className={`subject-colour-card relative flex min-h-32 flex-col overflow-hidden rounded-2xl border border-line p-5 pl-6 text-left transition ${
                item.id === selectedId ? 'bg-surface shadow-lg' : 'bg-surface hover:shadow-md'
              }`}
            >
              <SubjectCardAccent/>
              <span className="flex items-start gap-2">
                <span dir="auto" className="min-w-0 flex-1 text-lg leading-snug font-semibold">
                  {item.name}
                </span>
              </span>
              <span className="mt-1 flex items-center gap-2 text-sm text-muted">{item.categoryName}{item.pinned&&<span className="text-overtime" aria-label={uiText("Pinned")}>★</span>}</span>
              <span className="mt-auto pt-3 text-sm text-muted">{relativeDay(item.lastUsedAt)}</span>
            </button>
          ))}
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-base text-muted hover:border-muted hover:text-ink"
            >
              <PlusIcon className="size-6" />{uiText(" New subject")}</button>
          )}
        </div>
      ) : (
        <ul className="flex max-h-[26rem] flex-col gap-1 overflow-y-auto" role="listbox" aria-label={uiText('Subjects')}>
          {filtered.map((item) => (
            <li key={item.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={item.id === selectedId}
                onClick={() => onSelect(item)}
                onDoubleClick={() => {
                  onSelect(item)
                  onConfirm?.()
                }}
                className={`relative flex min-h-14 w-full items-center gap-4 overflow-hidden rounded-xl px-4 text-left transition-colors ${
                  item.id === selectedId ? 'bg-surface-2 text-ink' : 'hover:bg-surface-2/60'
                }`}
              >
                <span dir="auto" className="min-w-0 flex-1 truncate text-lg">
                  {item.name}
                </span>
                <span className="shrink-0 text-sm text-muted">{item.categoryName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!filtered.length && <p className="px-1 text-base text-muted">{items.length ? uiText("No match.") : uiText("No subjects yet. Add your first one.")}</p>}

      {creating ? (
        <QuickCreate initialName={query} onCancel={() => setCreating(false)} onCreated={created} />
      ) : (
        layout === 'list' && (
          <Button variant="ghost" className="self-start" onClick={() => setCreating(true)}>
            <PlusIcon />{uiText(" New subject")}</Button>
        )
      )}
    </div>
  )
}

function QuickCreate({
  initialName,
  onCancel,
  onCreated
}: {
  initialName: string
  onCancel: () => void
  onCreated: (id: Id) => void
}): React.JSX.Element {
  const { categories, items, createItem } = useLibrary()
  const firstActive = categories.find((c) => !c.archived && c.name === 'General')
  const [name, setName] = useState(initialName)
  const [unit,setUnit]=useState('sessions'),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [categoryId, setCategoryId] = useState<Id>(firstActive?.id ?? 0)

  async function submit(): Promise<void> {
    if (!name.trim() || busy) return
    setBusy(true);setError('')
    try{
    const chosenCategory=categoryId || (await useLibrary.getState().createCategory({name:'General',color:'#4174b7',icon:null,parentId:null})).id
    setCategoryId(chosenCategory)
    const item = await createItem({
      categoryId:chosenCategory,
      name,
      color: nextPaletteColor(items.map((i) => i.color)),
      defaultUnit: unit,
      totalUnits: null,
      notesTargetType: 'none',
      notesTarget: null,
      notesVault: null
    })
    onCreated(item.id)
    }catch(e){setError(String(e))}finally{setBusy(false)}
  }

  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-2xl border border-line bg-surface p-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement) && !e.repeat && !e.nativeEvent.isComposing) {
          e.preventDefault()
          e.stopPropagation()
          void submit()
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <input autoFocus dir="auto" aria-label={uiText('Subject name')} className={`${inputBase} min-w-56 flex-1`} data-subject-name placeholder={uiText("Subject name")} value={name} onChange={(e) => setName(e.target.value)} />
<details className="min-w-0 flex-1"><summary className="cursor-pointer py-3 text-sm text-muted">{uiText("Category & progress unit (optional)")}</summary><CategoryChooser className="min-w-0" value={categoryId} onChange={setCategoryId}/><label className="mt-3 block text-sm">{uiText("Progress unit")}<input aria-label={uiText("New subject progress unit")} className={`${inputBase} mt-1`} value={unit} onChange={e=>setUnit(e.target.value)}/></label></details>{error&&<p role="alert" className="w-full text-status-error">{error}</p>}
      <Button variant="primary" disabled={busy||!name.trim()||!unit.trim()} onClick={submit}>{uiText("Add")}</Button>
      <Button variant="ghost" onClick={onCancel}>{uiText("Cancel")}</Button>
    </div>
  )
}
