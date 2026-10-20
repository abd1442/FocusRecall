import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { shell } from 'electron'
import type { MusicPort, SpotifySession } from '@core/music'

// Windows 10 1809+ GSMTC: explicitly address Spotify, never the active media app.
// No titles, track metadata, playlist text or notes are read by this helper.
export const SPOTIFY_CONTROL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation<ARITY>1' } | Select-Object -First 1
function Await($operation, $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
  if (-not $task.Wait(3000)) { throw 'Media control timed out' }
  return $task.Result
}
$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$session = $null
$tries = if ($env:FOCUSRECALL_MEDIA_WAIT -eq '1') { 25 } else { 1 }
for ($i = 0; $i -lt $tries; $i++) {
  $session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match '^(Spotify(\.exe)?|SpotifyAB\.SpotifyMusic_[^!]+!Spotify)$' -and (-not $env:FOCUSRECALL_MEDIA_ID -or $_.SourceAppUserModelId -eq $env:FOCUSRECALL_MEDIA_ID) } | Select-Object -First 1
  if ($session) { break }
  if ($i -lt ($tries - 1)) { Start-Sleep -Milliseconds 300 }
}
if (-not $session) { Write-Output 'null'; exit }
$wasPlaying = $session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'
$accepted = $true
if ($env:FOCUSRECALL_MEDIA_ACTION -eq 'play' -and -not $wasPlaying) { $accepted = Await ($session.TryPlayAsync()) ([bool]) }
elseif ($env:FOCUSRECALL_MEDIA_ACTION -eq 'pause' -and $wasPlaying) { $accepted = Await ($session.TryPauseAsync()) ([bool]) }
@{ id=$session.SourceAppUserModelId; playing=($session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'); wasPlaying=$wasPlaying; accepted=$accepted } | ConvertTo-Json -Compress
`.replace('<ARITY>', String.fromCharCode(96))

export const windowsMusic: MusicPort = {
  open: target => shell.openExternal(target),
  control(action, signal, id, wait = false) {
    if (signal.aborted) return Promise.reject(Error('Cancelled'))
    const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    return new Promise((resolve, reject) => {
      execFile(executable, ['-NoProfile', '-NonInteractive', '-Command', SPOTIFY_CONTROL_SCRIPT], {
        windowsHide: true, timeout: 15000, maxBuffer: 16384, signal,
        env: { ...process.env, FOCUSRECALL_MEDIA_ACTION: action, FOCUSRECALL_MEDIA_ID: id ?? '', FOCUSRECALL_MEDIA_WAIT: wait ? '1' : '0' }
      }, (error, stdout) => {
        if (error) { reject(error); return }
        try {
          const result = JSON.parse(stdout.trim()) as SpotifySession | null
          if (result !== null && (typeof result.id !== 'string' || typeof result.playing !== 'boolean' || typeof result.accepted !== 'boolean' || typeof result.wasPlaying !== 'boolean')) throw Error('Invalid media response')
          resolve(result)
        } catch (err) { reject(err) }
      })
    })
  }
}
