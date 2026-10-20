import chimeUrl from './assets/chime.wav'
import { useSettings } from './store/session'

let audio: HTMLAudioElement | null = null

/** One soft chime, respecting the sound settings. */
export function playChime(): void {
  const { soundsEnabled, soundVolume } = useSettings.getState().settings
  if (!soundsEnabled) return
  audio ??= new Audio(chimeUrl)
  audio.volume = Math.min(1, Math.max(0, soundVolume))
  audio.currentTime = 0
  void audio.play().catch(() => undefined)
}
