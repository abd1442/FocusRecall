import { join } from 'node:path'

export function windowIcon(platform = process.platform): string {
  return join(__dirname, '../../resources', platform === 'win32' ? 'focusrecall.ico' : 'focusrecall-icon.png')
}
export function managedPanel(platform = process.platform, env = process.env): boolean {
  // Wayland compositors own window placement/focus; do not fight them.
  return platform === 'linux' && (env.XDG_SESSION_TYPE === 'wayland' || !!env.WAYLAND_DISPLAY)
}
export const panelCanFocus=(preparing:boolean,platform=process.platform):boolean=>preparing||platform!=='win32'
export const keepDockAlive=(platform=process.platform):boolean=>platform==='darwin'
