import { formatDuration } from '../i18n'
import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { nextSuggestion, spotifyUri, DEFAULT_REST_SUGGESTIONS } from '@core/rest'
import type { RestState } from '@core/session'
import { formatClock} from '@core/timer'
import { Button } from '../components/ui'
import { useKey, useNow } from '../hooks'
import { sessionCommand, useSettings } from '../store/session'
import { useUi } from '../store/ui'
import { RestMusicControls } from '../components/RestMusic'
import { AdviceCard } from '../components/AdviceCard'

/** The rest stage: a real break away from screens. */
export function RestScreen({ rest }: { rest: RestState }): React.JSX.Element {
  return (
    <div className="relative flex h-full flex-col overflow-y-auto">
      <div className="h-1 shrink-0 bg-rest/70" />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-10 py-12 pb-[12vh]">
        {rest.phase === 'plan' && <Plan rest={rest} />}
        {rest.phase === 'running' && <Running rest={rest} />}
        {rest.phase === 'over' && <Over rest={rest} />}
        <RestMusicControls />
      </div>
      <footer className="sticky bottom-0 flex justify-end border-t border-line bg-bg/95 px-6 py-3"><Button onClick={()=>sessionCommand(()=>window.api.invoke('session:finishStudying'))}>{uiText("Finish studying")}</Button></footer>
    </div>
  )
}

function useSuggestion(): [string | null, () => void] {
  const stored = useSettings((s) => s.settings.restSuggestions)
  // Personal suggestions are not educational claims and remain exactly as
  // authored. Default activity labels are retained for recording/history only.
  const list=stored.filter(s=>!DEFAULT_REST_SUGGESTIONS.includes(s))
  const [current, setCurrent] = useState<string | null>(() => nextSuggestion(list, null))
  return [current, () => setCurrent((c) => nextSuggestion(list, c))]
}

function Suggestion(): React.JSX.Element {
  const [suggestion, another] = useSuggestion()
  if (!suggestion) return <></>
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-line bg-surface px-7 py-6">
      <div className="flex-1">
        <div className="text-sm text-muted">{uiText("Away from screens")}</div>
        <div className="mt-1 text-2xl font-light">{DEFAULT_REST_SUGGESTIONS.includes(suggestion) ? uiText(suggestion) : suggestion}</div>
      </div>
      <Button variant="ghost" onClick={another}>{uiText("Another one")}</Button>
    </div>
  )
}

function Plan({ rest }: { rest: RestState }): React.JSX.Element {
  const { settings, set } = useSettings()
  const [minutes, setMinutes] = useState(Math.round(rest.plannedSeconds / 60))
  const chooseMinutes=(next:number):void=>{setMinutes(next);void sessionCommand(()=>window.api.invoke('rest:updatePlan',next*60))}
  const hasPlaylist = !!spotifyUri(settings.restPlaylist)
  const start = (): Promise<unknown> => sessionCommand(() => window.api.invoke('rest:start', minutes * 60))
  useKey((e) => e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('button, input, textarea, select, a, [contenteditable=true]')) && void start(), [minutes])

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">{rest.long ? uiText("Time for a long rest") : uiText("Time to rest")}</h1>
        <p className="text-lg text-muted">
          {rest.long
            ? uiText("Take a longer break.")
            : uiText('Choose a comfortable break. You can adjust the suggested duration.')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <Button variant="quiet" size="lg" aria-label={uiText("One minute less")} onClick={() => chooseMinutes(Math.max(1, minutes - 1))}>
            −
          </Button>
          <div className="w-44 text-center">
            <div className="font-timer text-7xl leading-none font-extralight text-rest tabular-nums">{minutes}</div>
            <div className="mt-1 text-base text-muted">{uiText("minutes")}</div>
          </div>
          <Button variant="quiet" size="lg" aria-label={uiText("One minute more")} onClick={() => chooseMinutes(Math.min(60, minutes + 1))}>
            +
          </Button>
        </div>
        <p className="max-w-xs text-base text-muted">
          {rest.long ? uiText("Long rest.") : uiText("Suggested from your study time.")}
        </p>
      </div>

      <Suggestion />
      <AdviceCard surface="rest"/>

      <label className="flex items-center gap-3 text-base">
        <input type="checkbox" className="size-5 accent-[var(--tf-rest)]" checked={settings.restMusic} disabled={!hasPlaylist} onChange={(e) => set('restMusic', e.target.checked)} />{uiText("Play my rest playlist")}{!hasPlaylist && <span className="text-muted">{uiText("(add a Spotify playlist link in Settings first)")}</span>}
      </label>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={start}
          className="min-h-16 rounded-lg bg-rest px-10 text-xl font-semibold text-on-accent transition hover:brightness-110"
        >{uiText("Start rest")}</button>
        <Button variant="ghost" onClick={() => sessionCommand(() => window.api.invoke('rest:skip'))}>{uiText("Skip rest")}</Button>
      </div>
    </>
  )
}

function Running({ rest }: { rest: RestState }): React.JSX.Element {
  const now = useNow(true, 500)
  const [nudge, setNudge] = useState<string | null>(null)
  // A distraction app held the front for a while: one gentle line, no alarm.
  useEffect(() => window.api.on('rest:nudge', ({ app }) => setNudge(app)), [])
  const left = Math.max(0, (Date.parse(rest.endsAt!) - now) / 1000)
  const progress = 1 - left / rest.plannedSeconds
  return (
    <>
      <div className="flex flex-col items-center gap-5">
        <h1 className="text-lg text-muted">{uiText("Resting")}</h1>
        <div role="timer" aria-label={uiText("Resting")} className="font-timer text-[8.5rem] leading-none font-extralight text-rest tabular-nums">{formatClock(left)}</div>
        <div className="h-1.5 w-full max-w-xl overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-rest transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="text-base text-muted">{uiText("of ")}{formatDuration(rest.plannedSeconds)}</div>
      </div>
      {nudge && (
        <p className="rounded-2xl border border-rest/50 bg-rest/10 px-6 py-4 text-lg">
          <bdi>{nudge}</bdi>{uiText(' is in use. If this is not restful for you, choose a different break activity.')}</p>
      )}
      <Suggestion />
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => sessionCommand(() => window.api.invoke('rest:endEarly'))}>{uiText("End rest early")}</Button>
      </div>
    </>
  )
}

/** Time is up: one tap for what the rest was, then the between-sessions step. */
function Over({ rest }: { rest: RestState }): React.JSX.Element {
  const suggestions = useSettings((s) => s.settings.restSuggestions)
  const showBetween = useUi((s) => s.showBetween)
  const finish = async (activity: string | null): Promise<void> => {
    const saved = await sessionCommand(async () => { await window.api.invoke('rest:finish', activity); return true })
    if (saved) showBetween()
  }
  const short = (rest.actualSeconds ?? 0) < rest.plannedSeconds
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">{short ? uiText("Rest ended early") : uiText("Rest is over")}</h1>
        <p className="text-lg text-muted">
          {formatDuration(rest.actualSeconds ?? 0)}{uiText(" of rest. What did you do? One tap is enough.")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {[...suggestions, 'Screens', 'Something else'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => finish(s)}
            className={`min-h-12 rounded-full border px-5 text-lg transition-colors hover:border-rest ${s === 'Screens' ? 'border-overtime/60 text-overtime' : 'border-line'}`}
          >
            {DEFAULT_REST_SUGGESTIONS.includes(s) || s === 'Screens' || s === 'Something else' ? uiText(s) : s}
          </button>
        ))}
      </div>
      <div>
        <Button variant="primary" onClick={() => finish(null)}>{uiText("Continue to next session")}</Button>
      </div>
    </>
  )
}
