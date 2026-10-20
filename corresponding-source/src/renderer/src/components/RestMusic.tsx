import { useEffect, useState } from 'react'
import type { MusicAction, MusicStatus } from '@core/music'
import { spotifyUri } from '@core/rest'
import { useSettings } from '../store/session'
import { t as uiText } from '../i18n'
import { Button } from './ui'

const messages: Record<MusicStatus['message'], string> = {
  idle: 'Open your playlist before resting. Spotify may need you to press Play once.',
  opening: 'Opening Spotify…',
  connecting: 'Waiting for Spotify playback controls…',
  opened: 'Playlist opened. Choose Play in Spotify if it has not started.',
  'play-requested': 'Play requested in Spotify. Check the selected playlist there.',
  'pause-requested': 'Pause requested in Spotify.',
  unavailable: 'Spotify has no available Windows playback session. Press Play in Spotify once, then try again, or use the browser.',
  'open-failed': 'Could not open Spotify. Check that it is installed, or open the playlist in your browser.',
  'control-failed': 'Spotify did not accept the playback request. Use its own controls, or try again.',
  browser: 'Playlist opened in your browser. Use the player controls there.'
}

/** On-demand control only. No account, embed, credentials or recurring polling. */
export function RestMusicControls(): React.JSX.Element | null {
  const playlist = useSettings(s => s.settings.restPlaylist)
  const [status, setStatus] = useState<MusicStatus>({phase: 'idle', message: 'idle'})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true, changed = false
    const off = window.api.on('music:changed', next => { changed = true; if (active) setStatus(next) })
    void window.api.invoke('music:status').then(next => { if (active && !changed) setStatus(next) }).catch(() => {})
    return () => { active = false; off() }
  }, [])
  if (!spotifyUri(playlist)) return null
  const command = async (action: MusicAction): Promise<void> => {
    setBusy(true)
    try { setStatus(await window.api.invoke('music:command', action)) }
    catch { setStatus({phase: 'error', message: 'control-failed'}) }
    finally { setBusy(false) }
  }
  return <section aria-label={uiText('Rest music')} className="rounded-2xl border border-line bg-surface p-5">
    <div className="flex flex-wrap items-center gap-2">
      <span className="me-auto font-medium">Spotify</span>
      <Button size="sm" disabled={busy || status.phase === 'opening'} onClick={() => void command('open')}>{uiText('Open playlist')}</Button>
      <Button size="sm" disabled={busy || status.phase === 'opening'} onClick={() => void command('play')}>{uiText('Play')}</Button>
      <Button size="sm" disabled={busy} onClick={() => void command('pause')}>{uiText('Pause')}</Button>
      <Button size="sm" variant="ghost" onClick={() => void command(busy || status.phase === 'opening' ? 'cancel' : 'browser')}>{busy || status.phase === 'opening' ? uiText('Cancel playback request') : uiText('Open in browser')}</Button>
    </div>
    <p role="status" aria-live="polite" className={`mt-3 text-sm ${status.phase === 'error' ? 'text-status-error' : 'text-muted'}`}>{uiText(messages[status.message])}</p>
  </section>
}
