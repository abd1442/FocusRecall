import { formatDuration } from '../i18n'
import { t as uiText } from '../i18n'
import { useState } from 'react'
import { DISCARD_THRESHOLD_SECONDS, type AfterStep, type FinishedBlock } from '@core/session'

import { Button } from '../components/ui'
import { sessionCommand } from '../store/session'
import { LogPanel } from './LogPanel'
import { RecallScreen } from './Recall'

/**
 * Between focus and rest: "Discard this session?" for sessions under a
 * minute, then recall, then the log.
 */
export function AfterFocusScreen({ finished, step }: { finished: FinishedBlock[]; step: AfterStep | null }): React.JSX.Element {
  const sessionId = finished[0]?.sessionId ?? null
  const [keptId, setKeptId] = useState<number | null>(null)
  const focus = finished.reduce((s, b) => s + b.focusSeconds, 0)
  if (step === 'recall' && sessionId !== null && focus < DISCARD_THRESHOLD_SECONDS && keptId !== sessionId) {
    return <DiscardPrompt focusSeconds={focus} names={[...new Set(finished.map((b) => b.itemName))]} onKeep={() => setKeptId(sessionId)} />
  }
  if (step === 'log') return <LogPanel blocks={finished} />
  return <RecallScreen blocks={finished} />
}

function DiscardPrompt({ focusSeconds, names, onKeep }: { focusSeconds: number; names: string[]; onKeep: () => void }): React.JSX.Element {
  const discard = (): Promise<unknown> => sessionCommand(() => window.api.invoke('session:discardFinished'))

  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <h2 className="text-2xl font-light">{uiText("Discard this session?")}</h2>
        <p className="text-base text-muted">{uiText("It ran for ")}{formatDuration(focusSeconds)}{uiText(" on ")}{names.join(' and ')}.
        </p>
        <div className="flex gap-3">
          <Button autoFocus variant="primary" onClick={onKeep}>{uiText("Keep it")}</Button>
          <Button variant="quiet" onClick={discard}>{uiText("Discard")}</Button>
        </div>
      </div>
    </div>
  )
}
