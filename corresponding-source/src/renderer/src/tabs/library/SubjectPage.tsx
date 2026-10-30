import { t as uiText } from '../../i18n'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StageBar, useSubjectStage } from '../../components/Stage'
import { priorLabel } from '@core/learning'
import { useLibrary as useLibraryStore } from '../../store/library'
import { LinkStatus } from '../../components/LinkStatus'
import { categoryPath } from '@core/library'
import { FOCUS_WORDS, wordFor } from '@core/scales'
import { newestFirst, openReviews, stoppedAtLabel, subjectOverview } from '@core/stats'
import type { Id, Item, ItemResource } from '@core/types'
import { BlockRows, Card, Stats, timeOrDash } from '../../components/overview'
import { Button, Menu, inputBase, relativeDay } from '../../components/ui'
import { useBlocks } from '../../store/blocks'
import { useLibrary } from '../../store/library'
import { useUi, type SubjectView } from '../../store/ui'
import { NotesView, ReviewView, StatsView, useLibraryActions } from '../Library'
import { PageHeader, PinButton, ViewTabs, useStartSession } from './parts'
import { SavedNotes } from '../../components/NotesEditor'

/** Link to the subject's notes page, if one is set in the Library. */
export function notesLinkFor(item: Item): string | null {
  if (item.notesTargetType === 'obsidian' && item.notesTarget && item.notesVault) {
    return `obsidian://open?vault=${encodeURIComponent(item.notesVault)}&file=${encodeURIComponent(item.notesTarget)}`
  }
  return null
}

export function SubjectPage({ id, view }: { id: Id; view: SubjectView }): React.JSX.Element {
  const { items, categories, stats } = useLibrary()
  const blocks = useBlocks((s) => s.blocks)
  const { openLibrary, openSubject } = useUi()
  const startSession = useStartSession()
  const actions = useLibraryActions()

  const item = items.find((i) => i.id === id)!
  const mine = useMemo(() => blocks.filter((b) => b.itemId === id), [blocks, id])
  const o = useMemo(() => subjectOverview(blocks, id), [blocks, id])
  const progress = stats.get(id)?.progress ?? 0
  const notesLink = notesLinkFor(item)
  const path = categoryPath(categories, item.categoryId)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-7 px-10 py-9">
        <PageHeader
          crumbs={[
            { label: 'Library', onClick: () => openLibrary({ kind: 'root' }) },
            ...path.map((c) => ({ label: c.name, onClick: () => openLibrary({ kind: 'category', id: c.id, view: 'subjects' }) })),
            { label: item.name }
          ]}
        >
          <PinButton item={item} />
          <Menu label={`Options for ${item.name}`} items={actions.subjectMenu(item)} />
          {!item.archived && (
            <Button variant="primary" onClick={() => startSession(item)}>{uiText("Start session")}</Button>
          )}
        </PageHeader>

        <ViewTabs<SubjectView>
          value={view}
          onChange={(v) => openSubject(id, v)}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'notes', label: 'Notes' },
            { value: 'review', label: 'To review', count: openReviews(mine).length },
            { value: 'resources', label: 'Resources' },
            { value: 'sessions', label: 'Sessions', count: mine.length }
          ]}
        />

        {view === 'overview' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <Stats
                items={[
                  { label: 'studied', value: timeOrDash(o.focusSeconds) },
                  { label: o.sessions === 1 ? 'session' : 'sessions', value: String(o.sessions) },
                  { label: 'average focus', value: wordFor(FOCUS_WORDS, o.averageFocus) ?? '–' },
                  { label: 'last studied', value: relativeDay(o.lastStudiedAt) }
                ]}
              />
              <Card title={uiText("Progress")}>
                {item.totalUnits ? (
                  <div>
                    <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (progress / item.totalUnits) * 100)}%`, background: item.color }} />
                    </div>
                    <div className="mt-2 text-base text-muted">
                      {Math.round(progress)}{uiText(" of ")}{item.totalUnits} {item.defaultUnit} ({Math.round(Math.min(100, (progress / item.totalUnits) * 100))}%)
                    </div>
                  </div>
                ) : (
                  <p className="text-base text-muted">{uiText("Set a total in Edit to track progress.")}</p>
                )}
                <p className="text-lg">
                  {o.stoppedAt ? (
                    <>{uiText("You stopped at ")}<span className="font-semibold">{stoppedAtLabel(o.stoppedAt)}</span>.
                    </>
                  ) : (
                    <span className="text-muted">{uiText("No stopping point logged yet.")}</span>
                  )}
                </p>
              </Card>
              <LearningCard itemId={item.id} color={item.color} />
              <StatsView blocks={mine} items={[item]} />
            </div>
            <div className="flex flex-col gap-6">
              <Card
                title={uiText("Last recall")}
                action={
                  notesLink && (
                    <Button variant="ghost" size="sm" onClick={() => window.api.invoke('shell:open', notesLink)}>{uiText("Notes page")}</Button>
                  )
                }
              >
                {o.lastRecall ? (
                  <p dir="auto" className="line-clamp-[10] font-writing leading-[1.65] whitespace-pre-wrap text-writing-ink" style={{ fontSize: 'var(--tf-writing-size)' }}>
                    {o.lastRecall.recallText}
                  </p>
                ) : (
                  <p className="text-base text-muted">{uiText("Nothing recalled yet.")}</p>
                )}
              </Card>
              <Card title={uiText("Resources")} action={<Button variant="ghost" size="sm" onClick={() => openSubject(id, 'resources')}>{uiText("Manage")}</Button>}>
                <ResourceList itemId={id} compact />
              </Card>
            </div>
          </div>
        )}

        {view === 'notes' && (
          <>
            <SavedNotes itemId={id}/>
            {notesLink && (
              <div>
                <Button variant="quiet" onClick={() => window.api.invoke('shell:open', notesLink)}>{uiText("Open notes page (Obsidian)")}</Button>
              </div>
            )}
            <NotesView blocks={mine} showSubject={false} onOpen={(b) => useUi.getState().openHistorySession(b.sessionId)} />
          </>
        )}
        {view === 'review' && <ReviewView blocks={mine} showSubject={false} />}
        {view === 'resources' && (
          <Card>
            <ResourceList itemId={id} />
          </Card>
        )}
        {view === 'sessions' && (
          <Card>
            <BlockRows blocks={newestFirst(mine)} showSubject={false} onOpen={(b) => useUi.getState().openHistorySession(b.sessionId)} />
          </Card>
        )}
      </div>
      {actions.dialogs}
    </div>
  )
}

/** Bookmarks for a subject: a title plus a link or a file path. */
function ResourceList({ itemId, compact = false }: { itemId: Id; compact?: boolean }): React.JSX.Element {
  const [list, setList] = useState<ItemResource[]>([])
  const [editing, setEditing] = useState<{ id?: Id; title: string; target: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => setList(await window.api.invoke('resources:list', itemId)), [itemId])
  useEffect(() => {
    void load()
  }, [load])

  const open = async (target: string): Promise<void> => {
    try {
      setError(null)
      await window.api.invoke('shell:open', target)
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }
  const save = async (): Promise<void> => {
    if (!editing) return
    try {
      await window.api.invoke('resources:save', { ...editing, itemId })
      setEditing(null)
      setError(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }
  const move = async (i: number, d: -1 | 1): Promise<void> => {
    const ids = list.map((r) => r.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await window.api.invoke('resources:reorder', ids)
    await load()
  }

  return (
    <div className="flex flex-col gap-3">
      {!list.length && !editing && <p className="text-base text-muted">{uiText("Add a link or file for this subject.")}</p>}
      <ul className="flex flex-col gap-1">
        {list.map((r, i) => (
          <li key={r.id} className="group flex min-h-12 items-center gap-3 rounded-xl px-3 hover:bg-surface-2/70">
            <button type="button" onClick={() => open(r.target)} className="min-w-0 flex-1 text-left">
              <span dir="auto" className="block truncate text-base font-medium text-focus">
                {r.title}
              </span>
              {!compact && <span className="block truncate text-sm text-muted">{r.target}</span>}
            </button>
            {!compact && (
              <Menu
                label={`Options for ${r.title}`}
                items={[
                  { label: 'Edit…', onSelect: () => setEditing({ id: r.id, title: r.title, target: r.target }) },
                  { label: 'Move up', disabled: i === 0, onSelect: () => move(i, -1) },
                  { label: 'Move down', disabled: i === list.length - 1, onSelect: () => move(i, 1) },
                  'separator',
                  {
                    label: 'Remove',
                    danger: true,
                    onSelect: async () => {
                      await window.api.invoke('resources:delete', r.id)
                      await load()
                    }
                  }
                ]}
              />
            )}
          </li>
        ))}
      </ul>

      {!compact &&
        (editing ? (
          <form
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <input autoFocus dir="auto" className={`${inputBase} w-56`} placeholder={uiText("Title")} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <input
              className={`${inputBase} min-w-72 flex-1`}
              placeholder={uiText("https://… or a file path")}
              value={editing.target}
              onChange={(e) => setEditing({ ...editing, target: e.target.value })}
            />
            <LinkStatus value={editing.target} kind="resource" />
            <Button
              variant="quiet"
              onClick={async () => {
                const path = await window.api.invoke('shell:pickFile')
                if (path) setEditing({ ...editing, target: path, title: editing.title || path.split(/[\\/]/).pop() || '' })
              }}
            >{uiText("Choose file…")}</Button>
            <Button variant="primary" type="submit">{uiText("Save")}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>{uiText("Cancel")}</Button>
          </form>
        ) : (
          <Button variant="quiet" className="self-start" onClick={() => setEditing({ title: '', target: '' })}>{uiText("+ Add resource")}</Button>
        ))}
      {error && <p role="alert" className="text-base text-status-error">{error}</p>}
    </div>
  )
}

/** The subject's learning stage, what was known before, and what it builds on. */
function LearningCard({ itemId, color }: { itemId: number; color: string }): React.JSX.Element | null {
  const stage = useSubjectStage(itemId)
  const items = useLibraryStore((s) => s.items)
  const item = items.find((i) => i.id === itemId)
  if (!stage || !item) return null
  const builds = item.buildsOn.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean)
  return (
    <Card title={uiText("Learning stage")}>
      <StageBar hours={stage.hours} stage={stage.stage} color={color} />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-muted">
        {item.hoursBefore > 0 && <span>{uiText("Includes ")}{item.hoursBefore}{uiText(" h before A14 Pomodoro")}</span>}
        {priorLabel(item.priorKnowledge) && <span>{uiText("Before starting: ")}{priorLabel(item.priorKnowledge)}</span>}
        {item.newField && <span>{uiText("A new field for you")}</span>}
        {builds.length > 0 && <span dir="auto">{uiText("Builds on ")}{builds.join(', ')}</span>}
      </div>
    </Card>
  )
}
