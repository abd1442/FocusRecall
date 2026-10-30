import { join } from 'node:path'
import { BrowserWindow, Menu, screen, type Rectangle, type WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { protectRenderer, rendererDevToolsAllowed } from './security'

const preload = join(__dirname, '../preload/index.js')

function load(win: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

/**
 * Keep Chromium's page zoom at 100%. It is shared by every window of the same
 * origin, so scaling is done per window with CSS zoom instead, and Ctrl+wheel
 * or Ctrl+plus must not change it.
 */
export function lockPageZoom(win: BrowserWindow): void {
  const reset = (): void => {
    if (!win.isDestroyed() && win.webContents.getZoomFactor() !== 1) win.webContents.setZoomFactor(1)
  }
  win.webContents.on('did-finish-load', reset)
  win.webContents.on('zoom-changed', reset)
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined)
}

export interface SavedBounds extends Rectangle {
  maximized: boolean
}

/** A generous default: most of the primary screen, centred. */
function defaultBounds(): Rectangle {
  const work = screen.getPrimaryDisplay().workArea
  const width = Math.min(work.width, Math.max(1100, Math.round(work.width * 0.78)))
  const height = Math.min(work.height, Math.max(760, Math.round(work.height * 0.85)))
  return { x: work.x + Math.round((work.width - width) / 2), y: work.y + Math.round((work.height - height) / 2), width, height }
}

/** Saved bounds, if they still fit on a connected screen. */
function restoredBounds(saved: SavedBounds | null): Rectangle | null {
  if (!saved || saved.width < 400 || saved.height < 300) return null
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea
    const overlapW = Math.min(a.x + a.width, saved.x + saved.width) - Math.max(a.x, saved.x)
    const overlapH = Math.min(a.y + a.height, saved.y + saved.height) - Math.max(a.y, saved.y)
    return overlapW > 200 && overlapH > 150
  })
  return visible ? saved : null
}

export function createMainWindow(opts: {
  saved: SavedBounds | null
  background: string
  onBoundsChanged: (b: SavedBounds) => void
}): BrowserWindow {
  const bounds = restoredBounds(opts.saved) ?? defaultBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    title: 'A14 Pomodoro',
    icon: join(__dirname, '../../resources/a14-pomodoro.ico'),
    backgroundColor: opts.background,
    webPreferences: {
        devTools: rendererDevToolsAllowed(),
      preload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      // The chime must play on time even when the window is hidden.
      backgroundThrottling: false
    }
  })

  win.on('ready-to-show', () => {
    if (opts.saved?.maximized) win.maximize()
    win.show()
  })
  lockPageZoom(win)

  // Remember size and position (normal bounds, plus whether it was maximised).
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized()) return
      opts.onBoundsChanged({ ...win.getNormalBounds(), maximized: win.isMaximized() })
    }, 400)
  }
  win.on('resize', save)
  win.on('move', save)
  win.on('maximize', save)
  win.on('unmaximize', save)

  // External links open in the default browser, never inside the app.
  protectRenderer(win,'main')

  load(win)
  return win
}

/**
 * Right-click menu for text: spelling suggestions, "Add to dictionary", then
 * cut, copy, paste and select all. Attached to every window.
 */
export function attachTextContextMenu(contents: WebContents): void {
  contents.on('context-menu', (_e, params) => {
    const items: Electron.MenuItemConstructorOptions[] = []
    if (params.misspelledWord) {
      for (const s of params.dictionarySuggestions.slice(0, 6)) {
        items.push({ label: s, click: () => contents.replaceMisspelling(s) })
      }
      if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false })
      items.push({
        label: 'Add to dictionary',
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
      items.push({ type: 'separator' })
    }
    if (params.isEditable) {
      items.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Select all', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    } else if (params.selectionText.trim()) {
      items.push({ label: 'Copy', role: 'copy' })
    }
    if (items.length) Menu.buildFromTemplate(items).popup()
  })
}
