import { formatDuration , formatTime } from '../../i18n'
import { t as uiText } from '../../i18n'
import { useEffect, useState } from 'react'
import { confirmAction } from '../../components/appDialogs'
import { QUALITY_LABEL, qualityOf, type Quality } from '@core/distractions'
import { blockWrittenText, type DaySession } from '@core/history'
import { useLogSchema } from '../../store/logSchema'

import { SessionReview } from '../../components/SessionReview'
import { needsLook } from '../../components/SessionTimeline'
import { Button } from '../../components/ui'
import { useSettings } from '../../store/session'
import { BlockCard } from './BlockCard'

const time = (iso: string): string => formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit' })

const QUALITY_STYLE: Record<Quality, string> = {
  clean: 'border-rest/60 text-rest',
  some: 'border-overtime/60 text-overtime',
  distracted: 'border-overtime bg-overtime/15 text-overtime'
}

/** One session in History: its numbers, its timeline, and each subject's part. */
export function SessionCard({ session: s, reload, highlighted = false, query = '' }: { session: DaySession; reload: () => Promise<void>; highlighted?: boolean; query?: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(highlighted)
  useEffect(() => { if (highlighted) setExpanded(true) }, [highlighted])
  const schema=useLogSchema(s=>s.schema)
  const written=s.parts.map(p=>blockWrittenText(p,schema)).filter(Boolean)
  const text=written.find(t=>t.toLowerCase().includes(query.trim().toLowerCase()))??written[0]??''
  const match=text.toLowerCase().indexOf(query.trim().toLowerCase()),start=Math.max(0,match-50)
  const excerpt=(start?'…':'')+text.slice(start,start+180)+(text.length>start+180?'…':'')
  const thresholds = useSettings((st) => st.settings.quality)
  const quality = qualityOf(s.stats, thresholds)
  const distractions = s.parts.flatMap((p) => p.distractions)
  const look = distractions.filter(needsLook).length
  const names = [...new Map(s.parts.map((p) => [p.itemId, p])).values()]

  const remove = async (): Promise<void> => {
    const message = s.parts.length > 1 ? uiText('Delete this session and its {count} parts? This cannot be undone.',{count:s.parts.length}) : uiText('Delete this session? This cannot be undone.')
    if (!await confirmAction(message,'Delete session','Delete session?',true)) return
    await window.api.invoke('history:deleteSession', s.id)
    await reload()
  }

  return (
    <article id={`history-session-${s.id}`} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-lg font-semibold tabular-nums">
          {time(s.startedAt)}–{s.endedAt ? time(s.endedAt) : ''}
        </span>
        <span className="text-base text-muted">{formatDuration(s.focusSeconds)}{uiText(" focus")}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {names.map((p) => (
            <span key={p.itemId} className="flex items-center gap-1.5 text-base">
              <span className="size-2.5 rounded-full" style={{ background: p.itemColor }} />
              <span dir="auto">{p.itemName}</span>
            </span>
          ))}
        </span>
        {s.mixed && <span className="rounded-full border border-line px-2.5 py-0.5 text-sm text-muted">{uiText("Mixed")}</span>}
        <span
          className={`rounded-full border px-2.5 py-0.5 text-sm ${QUALITY_STYLE[quality]}`}
          title={uiText("Distractions: {value0}, {value2} lost ({value3}%), longest stretch {value4}", {value0: (s.stats.distractionCount), value2: (formatDuration(s.stats.distractedSeconds)), value3: (Math.round(s.stats.lostShare * 100)), value4: (formatDuration(s.stats.longestStretchSeconds))})}
        >
          {uiText(QUALITY_LABEL[quality])}
        </span>
        <span className="flex-1" />
        <Button size="sm" aria-expanded={expanded} aria-controls={`history-details-${s.id}`} onClick={() => setExpanded(!expanded)}>{expanded ? uiText("Close details") : uiText("View session")}</Button>
        {expanded && <Button variant="ghost" size="sm" onClick={remove}>{uiText("Delete session")}</Button>}
      </header>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>{uiText("longest uninterrupted stretch ")}{formatDuration(s.stats.longestStretchSeconds)}</span>
        {look > 0 && <span className="text-overtime">{look}{uiText(" to label or confirm")}</span>}
      </div>

      {!expanded&&excerpt&&<p dir="auto" className="line-clamp-2 text-sm text-muted">{excerpt}</p>}
      {expanded && <div id={`history-details-${s.id}`} className="flex flex-col gap-4"><SessionReview
        sessionId={s.id}
        parts={s.parts.map((p) => ({
          id: p.id,
          itemId: p.itemId,
          itemName: p.itemName,
          itemColor: p.itemColor,
          start: Date.parse(p.focusStartedAt),
          end: Date.parse(p.focusEndedAt ?? p.focusStartedAt)
        }))}
        onChanged={() => void reload()}
      />

      <div className="flex flex-col gap-2">
        {s.parts.map((p) => (
          <div key={p.id} className="rounded-xl border border-line/70">
            <BlockCard block={p} reload={reload} />
          </div>
        ))}
      </div></div>}
    </article>
  )
}
