import { formatDuration , formatTime } from '../i18n'
import { t as uiText } from '../i18n'
import type { RecoveryPrompt } from '@core/session'

import { Button } from '../components/ui'
import { sessionCommand } from '../store/session'

const time = (iso: string): string =>
  formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit' })

/** Shown on launch when a block was still running when the app closed. */
export function RecoveryScreen({ prompt }: { prompt: RecoveryPrompt }): React.JSX.Element {
  const resolve = (choice: 'continue' | 'end'): Promise<unknown> =>
    sessionCommand(() => window.api.invoke('session:resolveRecovery', choice))

  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="flex max-w-md flex-col gap-5 rounded-xl border border-line bg-surface p-7">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: prompt.itemColor }} />
          <span className="font-medium">{prompt.itemName}</span>
        </div>
        <p className="text-sm leading-relaxed text-muted">{uiText("Tracking was interrupted. This block started at ")}{time(prompt.focusStartedAt)}{uiText(" and was last seen at ")}{time(prompt.lastKnownAt)}{uiText(", with ")}{formatDuration(prompt.focusSecondsAtLastKnown)}{uiText(" of focus.")}</p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" className="justify-center py-2" onClick={() => resolve('end')}>{uiText("End the block at ")}{time(prompt.lastKnownAt)}
          </Button>
          <Button variant="quiet" className="justify-center py-2" onClick={() => resolve('continue')}>{uiText("Continue the block")}</Button>
          <p className="text-sm text-muted">{uiText("Continuing excludes the unobserved time from focus.")} {uiText("Screen locking also interrupts tracking, even if you continue studying on paper. Resume when you return; locked time is not credited as Focus.")}</p>
        </div>
      </div>
    </div>
  )
}
