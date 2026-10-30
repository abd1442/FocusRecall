import { protectRenderer, rendererDevToolsAllowed } from './security'
import { preparationBounds } from '@core/preparation'
import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { lockPageZoom } from './windows'
import { DEFAULT_APPEARANCE, PANEL_SIZES, type Appearance } from '@core/appearance'
import type { AppSettings } from '@core/settings'
import { floatingPanelSize } from '@core/floatingTimer'

/** How often the panel re-asserts itself as topmost (other topmost apps can push it down). */
const REASSERT_MS = 3_000

/**
 * The floating control panel: always on top, shown without taking focus,
 * draggable, compact or expanded. Explicit clicks can activate its controls.
 *
 * Windows specifics:
 * - `type: 'toolbar'` makes it a tool window (WS_EX_TOOLWINDOW): no taskbar
 *   button, not in Alt+Tab, and not tied to one virtual desktop.
 * - Keep the window focusable for ordinary Windows mouse/keyboard handling.
 *   showInactive() avoids stealing focus when the timer first appears.
 * - Level 'screen-saver' is the highest always-on-top band Electron offers.
 */
export class PanelController {
  private win: BrowserWindow | null = null
  private reassert: NodeJS.Timeout | null = null
  private preparing = false
  private timerPosition:{x:number;y:number}|null=null
  private preparationWork:Electron.Rectangle|null=null
  private relocating=false
  private expanded = true
  private quick = false
  private hovered = false
  private appearance: Appearance = DEFAULT_APPEARANCE
  private ready = false
  private wanted = false
  private opacity: number | null = null

  constructor(private onMoved: (pos: { x: number; y: number }) => void) {}

  /** Load the panel hidden ahead of Start, without changing the saved open state. */
  prepare(settings: AppSettings, appearance: Appearance): void {
    this.quick=settings.studyExperience==='quick'
    this.appearance = appearance
    this.expanded = settings.panelExpanded
    if (!this.win || this.win.isDestroyed()) this.create(settings.panelPosition)
  }

  setPreparing(value:boolean,work?:Electron.Rectangle):void {
    if(value===this.preparing)return
    if(value&&this.win&&!this.win.isDestroyed()){const [x,y]=this.win.getPosition();this.timerPosition={x,y}}
    if(value)this.preparationWork=work??screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
    // The caller immediately syncs the new settings/appearance. Resize once
    // there, rather than moving the native window twice during one transition.
    this.preparing=value
  }

  async focusControls(): Promise<void> {
    const win=this.win
    if (!win || win.isDestroyed()) return
    if(!this.ready)await new Promise<void>(resolve=>win.once('ready-to-show',()=>resolve()))
    if(win.isDestroyed())return
    win.show();win.focus();win.webContents.focus()
    await win.webContents.executeJavaScript(`new Promise(resolve=>{let attempts=0;const focus=()=>{const button=document.querySelector('.fp-actions button')||document.querySelector('.fp-controls button');if(button){button.focus();resolve(true)}else if(++attempts<60)requestAnimationFrame(focus);else resolve(false)};focus()})`)
  }

  /** Where the panel is on screen, when it is showing. */
  bounds(): Electron.Rectangle | null {
    return this.isOpen ? this.win!.getBounds() : null
  }

  get isOpen(): boolean {
    return !!this.win && !this.win.isDestroyed() && this.win.isVisible()
  }

  /** Apply settings and appearance: open/close, size, opacity. */
  sync(settings: AppSettings, appearance: Appearance): void {
    this.quick=settings.studyExperience==='quick'
    this.wanted = settings.panelOpen || this.preparing
    this.appearance = appearance
    this.expanded = settings.panelExpanded
    if (!this.wanted) {
      this.close()
      return
    }
    if (!this.win || this.win.isDestroyed()) this.create(settings.panelPosition)
    else this.applySize()
    this.applyOpacity()
    if (this.ready && !this.win!.isVisible()) {if(this.preparing)this.win!.show();else this.win!.showInactive()}
    this.startReassert()
  }

  /** Fully opaque while the mouse is over the panel; the chosen opacity otherwise. */
  hover(over: boolean): void {
    this.hovered = over
    this.applyOpacity()
  }

  private applyOpacity(): void {
    const value=this.hovered||this.preparing?1:this.appearance.panelOpacity
    if(this.win&&!this.win.isDestroyed()&&this.opacity!==value){this.win.setOpacity(value);this.opacity=value}
  }

  close(): void {
    this.wanted = false
    this.stopReassert()
    if (this.win && !this.win.isDestroyed()) this.win.hide()
  }

  destroy(): void {
    this.stopReassert()
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private size(): { width: number; height: number } {
    if(this.preparing){const {width,height}=preparationBounds(this.preparationWork??screen.getPrimaryDisplay().workArea,this.appearance.uiScale);return {width,height}}
    const base = floatingPanelSize(this.expanded, this.appearance.panelTimerDisplay,this.quick)
    const k = this.zoom()
    return { width: Math.round(base.width * k), height: Math.round(base.height * k) }
  }

  private create(position: { x: number; y: number } | null): void {
    this.ready = false
    const size = this.size()
    const work = screen.getPrimaryDisplay().workArea
    const pos =
      position && onScreen(position) ? position : { x: work.x + work.width - size.width - 24, y: work.y + 24 }
    if(this.preparing&&!this.timerPosition)this.timerPosition={x:pos.x,y:pos.y}
    const win = new BrowserWindow({
      icon: join(__dirname, '../../resources/a14-pomodoro.ico'),
      ...size,
      ...pos,
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
      focusable: true,
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
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }) // no-op on Windows; kept for other OSes
    // The panel scales its content with CSS zoom (see store/appearance); page zoom stays at 1.
    protectRenderer(win,'panel')
    lockPageZoom(win)
    win.on('moved', () => {
      const [x, y] = win.getPosition()
      if(!this.preparing&&!this.relocating)this.onMoved({ x, y })
    })
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
    win.once('ready-to-show', () => {
      if (this.win !== win || win.isDestroyed()) return
      this.ready = true
      if (this.wanted) {if(this.preparing)win.show();else win.showInactive()}
    })
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#panel')
    else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'panel' })
    this.win = win
    this.opacity = null
    this.applySize()
  }

  private applySize(): void {
    if (!this.win || this.win.isDestroyed()) return
    const { width, height } = this.size()
    const [w,h]=this.win.getSize()
    this.relocating=true
    try {
      let position:{x:number;y:number}|null=null
      if(this.preparing){const b=preparationBounds(this.preparationWork??screen.getPrimaryDisplay().workArea,this.appearance.uiScale);position=b}
      else if(this.timerPosition){const pos=this.timerPosition;this.timerPosition=null;const work=screen.getDisplayNearestPoint(pos).workArea;position={x:Math.max(work.x,Math.min(pos.x,work.x+work.width-width)),y:Math.max(work.y,Math.min(pos.y,work.y+work.height-height))}}
      const [x,y]=this.win.getPosition()
      if(!this.preparing&&!position&&(w!==width||h!==height)){
        const work=screen.getDisplayMatching(this.win.getBounds()).workArea
        position={x:Math.max(work.x,Math.min(x,work.x+work.width-width)),y:Math.max(work.y,Math.min(y,work.y+work.height-height))}
      }
      const move=position&&(x!==position.x||y!==position.y)
      if(w!==width||h!==height){
        this.win.setResizable(true)
        try {
          // One Windows bounds operation instead of separate resize and move.
          if(move)this.win.setBounds({x:position!.x,y:position!.y,width,height})
          else this.win.setSize(width,height)
        }finally{this.win.setResizable(false)}
      }else if(move)this.win.setPosition(position!.x,position!.y)
    } finally {setImmediate(()=>{this.relocating=false})}
  }

  /** The panel's own scale; independent of the main window's interface scale. */
  private zoom(): number {
    return PANEL_SIZES[this.appearance.panelSize]
  }

  private startReassert(): void {
    if (this.reassert) return
    this.reassert = setInterval(() => {
      if (!this.win || this.win.isDestroyed() || !this.win.isVisible()) return
      this.win.setAlwaysOnTop(true, 'screen-saver')
      this.win.moveTop()
    }, REASSERT_MS)
  }

  private stopReassert(): void {
    if (this.reassert) clearInterval(this.reassert)
    this.reassert = null
  }
}

function onScreen(p: { x: number; y: number }): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return p.x >= a.x - 20 && p.y >= a.y - 20 && p.x < a.x + a.width - 40 && p.y < a.y + a.height - 20
  })
}
