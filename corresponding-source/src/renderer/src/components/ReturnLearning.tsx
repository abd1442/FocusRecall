import { t as uiText, formatDate } from '../i18n'
import { useMemo } from 'react'
import { learningReturns } from '@core/discoveries'
import { useBlocks } from '../store/blocks'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { Button } from './ui'

export function ReturnLearning({itemId=null}:{itemId?:number|null}):React.JSX.Element|null {
  const blocks=useBlocks(s=>s.blocks),items=useLibrary(s=>s.items),open=useUi(s=>s.openHistorySession)
  const returns=useMemo(()=>learningReturns(blocks,itemId),[blocks,itemId])
  if(!returns.length)return null
  return <details className="rounded-2xl border border-line bg-surface p-5"><summary className="cursor-pointer font-medium">{uiText("Revisit your learning ")}<span className="ml-2 text-sm text-muted">{uiText("Optional")}</span></summary><div className="mt-4 flex flex-col gap-3">{returns.map(b=><article key={b.id} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{items.find(i=>i.id===b.itemId)?.name??'Previous subject'}</h3><span className="text-xs text-muted">{formatDate(new Date(b.focusStartedAt))}</span></div><p className="mt-2 text-xs text-recall">{b.reviewMarked?uiText("You marked this for review"):uiText("From your recall notes")}</p><p dir="auto" className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm">{b.reviewNote||b.recallText||'Open this session to revisit its notes or drawing.'}</p><Button size="sm" variant="ghost" className="mt-2" onClick={()=>open(b.sessionId)}>{uiText("Open session and notes")}</Button></article>)}</div></details>
}
