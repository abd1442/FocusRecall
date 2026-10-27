import { t as uiText, formatDate } from '../i18n'
import { useMemo, useState } from 'react'
import { confirmAction, showMessage } from '../components/appDialogs'
import { StageBar, useFieldStage } from '../components/Stage'
import { HeatMap } from '../components/HeatMap'
import { categoryAndChildren, categoryPath, rollUpTotals } from '@core/library'
import { openReviews, perSubject, perWeek, searchNotes, type BlockSummary } from '@core/stats'

import type { Category, Id, Item } from '@core/types'
import { ItemForm } from '../components/ItemForm'
import { PlusIcon } from '../components/Icons'
import { Card, HBars, NoteCards, ReviewRows, Stats, VBars, timeOrDash } from '../components/overview'
import { Button, Menu, inputClass, relativeDay } from '../components/ui'
import { useBlocks } from '../store/blocks'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/session'
import { useUi, type CategoryView } from '../store/ui'
import { useToday } from './Home'
import { CategoryEditor, MoveEditor, blankItem, toInput, type CategoryDialogState, type MoveDialogState } from './library/editors'
import { CategoryTile, PageHeader, SubjectTile, TileGrid, ViewTabs } from './library/parts'
import { SubjectPage } from './library/SubjectPage'

type ItemDialog = { mode: 'new'; categoryId: Id } | { mode: 'edit'; item: Item } | null

export function LibraryTab(): React.JSX.Element {
  const route = useUi((s) => s.library)
  const categories = useLibrary((s) => s.categories)
  const items = useLibrary((s) => s.items)

  if (route.kind === 'subject' && items.some((i) => i.id === route.id)) return <SubjectPage id={route.id} view={route.view} />
  if (route.kind === 'category' && categories.some((c) => c.id === route.id)) return <CategoryPage id={route.id} view={route.view} />
  return <LibraryRoot />
}

/** Shared dialogs and the option menus for tiles. */
export function useLibraryActions(): {
  dialogs: React.ReactNode
  categoryMenu: (c: Category, siblings: Category[]) => React.ComponentProps<typeof Menu>['items']
  subjectMenu: (i: Item) => React.ComponentProps<typeof Menu>['items']
  newCategory: (parentId: Id | null) => void
  newSubject: (categoryId: Id) => void
} {
  const items = useLibrary((s) => s.items)
  const lib = useLibrary.getState()
  const [itemDialog, setItemDialog] = useState<ItemDialog>(null)
  const [catDialog, setCatDialog] = useState<CategoryDialogState | null>(null)
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null)

  const dialogs = (
    <>
      {itemDialog && (
        <ItemForm
          editing={itemDialog.mode === 'edit' ? itemDialog.item : undefined}
          initial={itemDialog.mode === 'edit' ? toInput(itemDialog.item) : blankItem(itemDialog.categoryId, items)}
          onCancel={() => setItemDialog(null)}
          onSave={async (input) => {
            if (itemDialog.mode === 'edit') await lib.updateItem(itemDialog.item.id, input)
            else await lib.createItem(input)
            setItemDialog(null)
          }}
        />
      )}
      {catDialog && <CategoryEditor dialog={catDialog} onClose={() => setCatDialog(null)} />}
      {moveDialog && <MoveEditor dialog={moveDialog} onClose={() => setMoveDialog(null)} />}
    </>
  )

  return {
    dialogs,
    newCategory: (parentId) => setCatDialog({ mode: 'new', parentId }),
    newSubject: (categoryId) => setItemDialog({ mode: 'new', categoryId }),
    categoryMenu: (c, siblings) => {
      const ids = siblings.map((s) => s.id)
      const i = ids.indexOf(c.id)
      return [
        { label: 'Rename and colour…', onSelect: () => setCatDialog({ mode: 'edit', category: c }) },
        { label: 'Move earlier', disabled: i <= 0, onSelect: () => lib.moveCategoryInOrder(c.id, -1, ids) },
        { label: 'Move later', disabled: i < 0 || i >= ids.length - 1, onSelect: () => lib.moveCategoryInOrder(c.id, 1, ids) },
        { label: 'Move to…', onSelect: () => setMoveDialog({ kind: 'category', category: c }) },
        'separator',
        c.archived
          ? { label: 'Restore', onSelect: () => lib.setCategoryArchived(c.id, false) }
          : { label: 'Archive', danger: true, onSelect: () => lib.setCategoryArchived(c.id, true) },
        { label: 'Delete category', danger: true, onSelect: async () => {
          const destination = uiText(c.parentId === null ? 'Uncategorised' : 'the parent category')
          if (!await confirmAction(uiText('Delete “{name}”? This category cannot be restored.\n\nSubjects move to {destination}; sub-categories move up one level. All subjects, notes and study history are kept.',{name:c.name,destination}), 'Delete category', 'Delete category?', true)) return
          try { await lib.deleteCategory(c.id) } catch (error) { void showMessage(error instanceof Error ? error.message : 'Could not delete this category.') }
        } }
      ]
    },
    subjectMenu: (item) => [
      { label: 'Edit…', onSelect: () => setItemDialog({ mode: 'edit', item }) },
      { label: 'Move to…', onSelect: () => setMoveDialog({ kind: 'item', item }) },
      'separator',
      item.archived
        ? { label: 'Restore', onSelect: () => lib.setItemArchived(item.id, false) }
        : { label: 'Archive', danger: true, onSelect: () => lib.setItemArchived(item.id, true) }
    ]
  }
}

const byOrder = (a: Category, b: Category): number => a.sortOrder - b.sortOrder || a.id - b.id

function useTotals(): ReturnType<typeof rollUpTotals> {
  const { categories, items, stats } = useLibrary()
  return useMemo(() => rollUpTotals(categories, items, [...stats.values()]), [categories, items, stats])
}

// --- Top level ---------------------------------------------------------------

function LibraryRoot(): React.JSX.Element {
  const { categories, loaded } = useLibrary()
  const openLibrary = useUi((s) => s.openLibrary)
  const [showArchived, setShowArchived] = useState(false)
  const totals = useTotals()
  const actions = useLibraryActions()
  const top = categories.filter((c) => c.parentId === null && (showArchived || !c.archived)).sort(byOrder)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-8 px-10 py-9">
        <PageHeader crumbs={[{ label: 'Library' }]}>
          <label className="flex items-center gap-2 text-base text-muted">
            <input type="checkbox" className="size-4" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{uiText("Show archived")}</label>
          <Button variant="primary" onClick={() => actions.newCategory(null)}>
            <PlusIcon />{uiText(" Add category")}</Button>
        </PageHeader>
        {loaded && (
          <TileGrid>
            {top.map((c) => (
              <CategoryTile
                key={c.id}
                category={c}
                totals={totals.get(c.id)}
                subCount={categories.filter((s) => s.parentId === c.id && !s.archived).length}
                onOpen={() => openLibrary({ kind: 'category', id: c.id, view: 'subjects' })}
                menu={actions.categoryMenu(c, top)}
              />
            ))}
          </TileGrid>
        )}
      </div>
      {actions.dialogs}
    </div>
  )
}

// --- Category page -----------------------------------------------------------

function CategoryPage({ id, view }: { id: Id; view: CategoryView }): React.JSX.Element {
  const { categories, items, stats } = useLibrary()
  const blocks = useBlocks((s) => s.blocks)
  const openLibrary = useUi((s) => s.openLibrary)
  const openSubject = useUi((s) => s.openSubject)
  const [showArchived, setShowArchived] = useState(false)
  const totals = useTotals()
  const actions = useLibraryActions()

  const category = categories.find((c) => c.id === id)!
  const path = categoryPath(categories, id)
  const t = totals.get(id) ?? { focusSeconds: 0, blocks: 0, subjects: 0, lastStudiedAt: null }
  const inside = useMemo(() => new Set(categoryAndChildren(categories, id)), [categories, id])
  const insideItems = useMemo(() => new Set(items.filter((i) => inside.has(i.categoryId)).map((i) => i.id)), [items, inside])
  const myBlocks = useMemo(() => blocks.filter((b) => insideItems.has(b.itemId)), [blocks, insideItems])
  const reviewCount = openReviews(myBlocks).length
  const setView = (v: CategoryView): void => openLibrary({ kind: 'category', id, view: v })

  const subs = categories.filter((c) => c.parentId === id && (showArchived || !c.archived)).sort(byOrder)
  const direct = items.filter((i) => i.categoryId === id && (showArchived || !i.archived)).sort((a, b) => a.name.localeCompare(b.name))
  const siblings = categories.filter((c) => c.parentId === category.parentId).sort(byOrder)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-7 px-10 py-9">
        <PageHeader
          crumbs={[
            { label: 'Library', onClick: () => openLibrary({ kind: 'root' }) },
            ...path.map((c) =>
              c.id === id ? { label: c.name } : { label: c.name, onClick: () => openLibrary({ kind: 'category', id: c.id, view: 'subjects' }) }
            )
          ]}
        >
          <Menu label={`Options for ${category.name}`} items={actions.categoryMenu(category, siblings)} />
          <Button variant="primary" onClick={() => actions.newSubject(id)}>
            <PlusIcon />{uiText(" Add subject")}</Button>
        </PageHeader>

        <Stats
          items={[
            { label: 'studied', value: timeOrDash(t.focusSeconds) },
            { label: t.blocks === 1 ? 'session' : 'sessions', value: String(t.blocks) },
            { label: t.subjects === 1 ? 'subject' : 'subjects', value: String(t.subjects) },
            { label: 'last studied', value: relativeDay(t.lastStudiedAt) }
          ]}
        />
        <FieldStage categoryId={id} color={category.color} />

        <ViewTabs<CategoryView>
          value={view}
          onChange={setView}
          tabs={[
            { value: 'subjects', label: 'Subjects' },
            { value: 'notes', label: 'Notes' },
            { value: 'review', label: 'To review', count: reviewCount },
            { value: 'stats', label: 'Stats' }
          ]}
        />

        {view === 'subjects' && (
          <>
            {category.parentId === null && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{uiText("Sub-categories")}</h2>
                  <Button variant="quiet" size="sm" onClick={() => actions.newCategory(id)}>
                    <PlusIcon />{uiText(" Add sub-category")}</Button>
                </div>
                {subs.length ? (
                  <TileGrid>
                    {subs.map((c) => (
                      <CategoryTile
                        key={c.id}
                        category={c}
                        totals={totals.get(c.id)}
                        subCount={0}
                        onOpen={() => openLibrary({ kind: 'category', id: c.id, view: 'subjects' })}
                        menu={actions.categoryMenu(c, subs)}
                      />
                    ))}
                  </TileGrid>
                ) : (
                  <p className="text-base text-muted">{uiText("No groups yet.")}</p>
                )}
              </section>
            )}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">{uiText("Subjects")}</h2>
                <label className="flex items-center gap-2 text-base text-muted">
                  <input type="checkbox" className="size-4" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{uiText("Show archived")}</label>
              </div>
              {direct.length ? (
                <TileGrid>
                  {direct.map((item) => (
                    <SubjectTile key={item.id} item={item} stats={stats.get(item.id)} onOpen={() => openSubject(item.id)} menu={actions.subjectMenu(item)} />
                  ))}
                </TileGrid>
              ) : (
                <button
                  type="button"
                  onClick={() => actions.newSubject(id)}
                  className={`rounded-2xl border-2 border-dashed border-line text-muted hover:border-muted hover:text-ink ${
                    subs.length ? 'px-6 py-5 text-base' : 'px-8 py-12 text-lg'
                  }`}
                >
                  {subs.length ? uiText("Subjects can also sit directly in {value0}, outside the sub-categories.", {value0: (category.name)}) : uiText("Add the first subject here")}
                </button>
              )}
            </section>
          </>
        )}

        {view === 'notes' && <NotesView blocks={myBlocks} onOpen={(b) => useUi.getState().openHistorySession(b.sessionId)} />}
        {view === 'review' && <ReviewView blocks={myBlocks} onOpen={(b) => openSubject(b.itemId, 'review')} />}
        {view === 'stats' && <StatsView blocks={myBlocks} items={items.filter((i) => insideItems.has(i.id))} heatMap={false} />}
      </div>
      {actions.dialogs}
    </div>
  )
}

// --- Shared views ------------------------------------------------------------

export function NotesView({
  blocks,
  showSubject = true,
  onOpen
}: {
  blocks: BlockSummary[]
  showSubject?: boolean
  onOpen?: (b:BlockSummary) => void
}): React.JSX.Element {
  const [q, setQ] = useState('')
  const found = useMemo(() => searchNotes(blocks, q), [blocks, q])
  return (
    <div className="flex flex-col gap-5">
      <input dir="auto" className={`${inputClass} max-w-xl`} placeholder={uiText("Search notes…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <NoteCards blocks={found} showSubject={showSubject} onOpen={onOpen} />
    </div>
  )
}

export function ReviewView({
  blocks,
  showSubject = true,
  onOpen
}: {
  blocks: BlockSummary[]
  showSubject?: boolean
  onOpen?: (b: BlockSummary) => void
}): React.JSX.Element {
  const [showDone, setShowDone] = useState(false)
  const setReviewDone = useBlocks((s) => s.setReviewDone)
  const list = useMemo(
    () =>
      blocks
        .filter((b) => b.reviewMarked && (showDone || !b.reviewDone))
        .sort((a, b) => Date.parse(b.focusStartedAt) - Date.parse(a.focusStartedAt)),
    [blocks, showDone]
  )
  return (
    <Card
      action={
        <label className="flex items-center gap-2 text-base text-muted">
          <input type="checkbox" className="size-4" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />{uiText("Show done")}</label>
      }
    >
      <ReviewRows blocks={list} showSubject={showSubject} onToggle={(b, done) => setReviewDone(b.id, done)} onOpen={onOpen} />
    </Card>
  )
}

/** Charts for a subject or a category. The heat map shows on subject pages only (not on category pages). */
export function StatsView({ blocks, items, heatMap = true }: { blocks: BlockSummary[]; items: Item[]; heatMap?: boolean }): React.JSX.Element {
  const { dayStart, weekStartsOn } = useSettings((s) => s.settings)
  const today = useToday()
  const byItem = new Map(items.map((i) => [i.id, i]))
  const subjects = perSubject(blocks).map((r) => ({
    key: r.itemId,
    label: byItem.get(r.itemId)?.name ?? 'Deleted subject',
    color: byItem.get(r.itemId)?.color,
    seconds: r.focusSeconds
  }))
  const weeks = perWeek(blocks, today, weekStartsOn, dayStart, 12)
  const thisWeek = weeks[weeks.length - 1]?.weekStart
  return (
    <div className={`grid gap-6 ${items.length > 1 ? '2xl:grid-cols-2' : ''}`}>
      {heatMap && (
        <div className={items.length > 1 ? '2xl:col-span-2' : ''}>
          <HeatMap blocks={blocks} />
        </div>
      )}
      {items.length > 1 && (
        <Card title={uiText("Time per subject")}>
          <HBars rows={subjects} />
        </Card>
      )}
      <Card title={uiText("Time per week")} action={<span className="text-base text-muted">{uiText("last 12 weeks")}</span>}>
        <VBars
          label={uiText("Focused time per week")}
          highlight={thisWeek}
          bars={weeks.map((w) => ({
            key: w.weekStart,
            label: formatDate(w.weekStart, { day: 'numeric', month: 'short' }),
            title: uiText('Week of {date}',{date:formatDate(w.weekStart, { day: 'numeric', month: 'long' })}),
            seconds: w.focusSeconds
          }))}
        />
      </Card>
    </div>
  )
}

/** Hours in the whole field (the category and its sub-categories) and its stage. */
function FieldStage({ categoryId, color }: { categoryId: Id; color: string }): React.JSX.Element | null {
  const f = useFieldStage(categoryId)
  if (!f || f.hours <= 0) return null
  return (
    <div className="max-w-xl rounded-2xl border border-line bg-surface px-6 py-4">
      <div className="mb-2 text-sm text-muted">{uiText("Hours in this field")}</div>
      <StageBar hours={f.hours} stage={f.stage} color={color} />
    </div>
  )
}
