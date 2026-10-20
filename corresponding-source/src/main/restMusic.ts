import { spotifyUri, spotifyWebUrl } from '@core/rest'
import type { MusicAction, MusicPort, MusicStatus } from '@core/music'

/** No blind media keys, background polling, track metadata or Spotify credentials. */
export class RestMusic {
  private state: MusicStatus = { phase: 'idle', message: 'idle' }
  private pending = new AbortController()
  private owned: string | undefined
  constructor(private port: MusicPort, private changed: (state: MusicStatus) => void) {}
  get(): MusicStatus { return { ...this.state } }
  private update(state: MusicStatus): void { this.state = state; this.changed(this.get()) }
  async command(action: MusicAction, playlist: string, autoPlay = false): Promise<MusicStatus> {
    if (action === 'cancel') { await this.end(); return this.get() }
    this.pending.abort()
    const job = this.pending = new AbortController()
    const current = (): boolean => !job.signal.aborted
    let opening = action === 'open' || action === 'browser'
    try {
      if (action === 'open' || action === 'browser') {
        const target = action === 'open' ? spotifyUri(playlist) : spotifyWebUrl(playlist)
        if (!target) throw Error('Invalid playlist')
        this.update({ phase: 'opening', message: 'opening' })
        await this.port.open(target)
        if (!current()) return this.get()
        opening = false
        if (action === 'browser' || !autoPlay) {
          this.update({ phase: 'ready', message: action === 'browser' ? 'browser' : 'opened' })
          return this.get()
        }
        this.update({ phase: 'opening', message: 'connecting' })
      }
      const operation = action === 'pause' ? 'pause' : action === 'refresh' ? 'status' : 'play'
      const result = await this.port.control(operation, job.signal, undefined, action === 'open')
      if (!current()) return this.get()
      if (!result) this.update({ phase: 'unavailable', message: 'unavailable' })
      else if (operation !== 'status' && !result.accepted) this.update({ phase: 'error', message: 'control-failed' })
      else {
        if (operation === 'play' && result.accepted && !result.wasPlaying) this.owned = result.id
        if (operation === 'pause') this.owned = undefined
        this.update({ phase: 'ready', message: operation === 'status' ? 'opened' : operation === 'play' ? 'play-requested' : 'pause-requested' })
      }
    } catch {
      if (current()) this.update({ phase: 'error', message: opening ? 'open-failed' : 'control-failed' })
    }
    return this.get()
  }
  /** Cancel startup before it can issue late playback. Pause only our own session. */
  async end(): Promise<void> {
    this.pending.abort()
    const job = this.pending = new AbortController(), id = this.owned
    this.owned = undefined
    if (id) {
      try {
        const result = await this.port.control('pause', job.signal, id)
        if (!job.signal.aborted && result && !result.accepted) { this.owned=id; this.update({ phase: 'error', message: 'control-failed' }); return }
      } catch { if (!job.signal.aborted) { this.owned=id; this.update({ phase: 'error', message: 'control-failed' }); return } }
    }
    if (!job.signal.aborted) this.update({ phase: 'idle', message: 'idle' })
  }
}
