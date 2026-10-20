/** Windows reports only Spotify's playback state, never track metadata. */
export interface SpotifySession { id: string; playing: boolean; accepted?: boolean; wasPlaying?: boolean }
export interface MusicStatus {
  phase: 'idle' | 'opening' | 'ready' | 'unavailable' | 'error'
  message: 'idle' | 'opening' | 'connecting' | 'opened' | 'play-requested' | 'pause-requested' | 'unavailable' | 'open-failed' | 'control-failed' | 'browser'
}
export type MusicAction = 'open' | 'browser' | 'play' | 'pause' | 'refresh' | 'cancel'
export interface MusicPort {
  open(target: string): Promise<void>
  control(action: 'status' | 'play' | 'pause', signal: AbortSignal, id?: string, wait?: boolean): Promise<SpotifySession | null>
}
