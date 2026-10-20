import { protectRenderer, rendererDevToolsAllowed } from './security'
import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { PANEL_SIZES, type PanelSize } from '@core/appearance'
import type { Id } from '@core/types'
import { lockPageZoom } from './windows'

// Design size; the window is this times the panel size factor, like the panel.
const SIZE = { width: 380, height: 170 }
/** Safety net: the popup closes itself after its countdown, this only catches a stuck one. */
const MAX_OPEN_MS = 20_000

/**
 * The small one-tap reason picker after "Back". Like the floating panel it
 * never takes keyboard focus: tapping a reason leaves you typing where you
 * were. It sits under the panel when the panel is open, otherwise in the
 * bottom-right corner, and closes itself after about 4 seconds.
 */
export class ReasonPopup {
  private win: BrowserWindow | null = null
  private listening = false
  private waiters: (() => void)[] = []

  /** The page has loaded and listens (it calls 'popup:ready'). */
  markReady(): void {
    this.listening = true
    for (const w of this.waiters.splice(0)) w()
  }

  /** Resolves once the page listens, so a message sent then is never lost. */
  private whenListening(): Promise<void> {
    return this.listening ? Promise.resolve() : new Promise((resolve) => this.waiters.push(resolve))
  }

  /** Create the window hidden at startup, so the first use is instant. */
  prepare(): void {
    this.ensure(10, 10)
  }
  private safety: NodeJS.Timeout | null = null

  async show(what: { kind: 'reason'; distractionId: Id } | { kind: 'absence'; minutes: number }, opts: { panelBounds: Electron.Rectangle | null; panelSize: PanelSize }): Promise<void> {
    const k = PANEL_SIZES[opts.panelSize]
    const width = Math.round(SIZE.width * k)
    const height = Math.round(SIZE.height * k)
    const win = this.ensure(width, height)
    const work = (opts.panelBounds ? screen.getDisplayMatching(opts.panelBounds) : screen.getPrimaryDisplay()).workArea
    let x = work.x + work.width - width - 24
    let y = work.y + work.height - height - 24
    if (opts.panelBounds) {
      x = Math.min(work.x + work.width - width, Math.max(work.x, opts.panelBounds.x + opts.panelBounds.width - width))
      const below = opts.panelBounds.y + opts.panelBounds.height + 8
      y = below + height <= work.y + work.height ? below : Math.max(work.y, opts.panelBounds.y - height - 8)
    }
    win.setResizable(true)
    win.setBounds({ x, y, width, height })
    win.setResizable(false)
    await this.whenListening()
    if (win.isDestroyed()) return
    win.webContents.send('reasons:show', what)
    win.showInactive()
    win.setAlwaysOnTop(true, 'screen-saver')
    if (this.safety) clearTimeout(this.safety)
    // The long-absence question waits for an answer; the reason picker closes by itself.
    if (what.kind === 'reason') this.safety = setTimeout(() => this.hide(), MAX_OPEN_MS)
  }

  hide(): void {
    if (this.safety) clearTimeout(this.safety)
    this.safety = null
    if (this.win && !this.win.isDestroyed()) this.win.hide()
  }

  destroy(): void {
    this.hide()
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private ensure(width: number, height: number): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win
    const win = new BrowserWindow({
      icon: join(__dirname, '../../resources/focusrecall.ico'),
      width,
      height,
      type: 'toolbar',
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      webPreferences: {
        devTools: rendererDevToolsAllowed(),
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    protectRenderer(win,'reasons')
    lockPageZoom(win)
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
    // Ready only once the page says it listens: the first message must not get lost.
    this.listening = false
    win.webContents.on('did-start-loading', () => (this.listening = false))
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#reasons')
    else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'reasons' })
    this.win = win
    return win
  }
}
