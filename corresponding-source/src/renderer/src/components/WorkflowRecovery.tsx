import { t as uiText, formatDate } from '../i18n'
import type { UnfinishedWorkflow } from '@core/session'
import { Button } from './ui'
import { sessionCommand } from '../store/session'

export function WorkflowRecovery({ entries }: {entries:UnfinishedWorkflow[]}): React.JSX.Element | null {
  if (!entries.length) return null
  const prompted = entries.filter((w) => !w.deferred), later = entries.filter((w) => w.deferred)
  const row = (w: UnfinishedWorkflow): React.JSX.Element => <div key={w.sessionId} className="flex flex-wrap items-center gap-3">
    <span className="min-w-0 flex-1"><span className="font-medium">{w.itemName || 'Study session'}</span><span className="ml-2 text-muted">{w.endedAt ? `${formatDate(new Date(w.endedAt))} · ` : ''}{uiText("unfinished ")}{w.step === 'log' ? uiText("logging") : w.step}{w.step==='rest'?uiText(" — time while closed is excluded"):''}</span></span>
    <Button variant="primary" onClick={() => sessionCommand(() => window.api.invoke('session:resumeWorkflow',w.sessionId))}>{uiText("Resume")}</Button>
    {!w.deferred && <Button variant="quiet" onClick={() => sessionCommand(() => window.api.invoke('session:leaveWorkflow',w.sessionId))}>{uiText("Leave for later")}</Button>}
  </div>
  return <section className="m-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5" aria-label={uiText("Unfinished study work")}>
    {prompted.slice(0,3).map(row)}
    {prompted.length > 3 && <details><summary className="cursor-pointer text-muted">{uiText("More unfinished work (")}{prompted.length-3})</summary><div className="mt-3 flex flex-col gap-3">{prompted.slice(3).map(row)}</div></details>}
    {later.length > 0 && <details><summary className="cursor-pointer text-muted">{uiText("Saved for later (")}{later.length})</summary><div className="mt-3 flex flex-col gap-3">{later.map(row)}</div></details>}
  </section>
}
