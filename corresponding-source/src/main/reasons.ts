import { protectRenderer, rendererDevToolsAllowed } from './security'
import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { PANEL_SIZES, type PanelSize } from '@core/appearance'
import { lockPageZoom } from './windows'

// Design size; the window is this times the panel size factor, like the panel.
const SIZE = { width: 380, height: 170 }

/** Confirmation after a long absence; ordinary Resume never opens a popup. */
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

  async show(what: { kind: 'absence'; minutes: number }, opts: { panelBounds: Electron.Rectangle | null; panelSize: PanelSize }): Promise<void> {
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
  }

  hide(): void {
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
