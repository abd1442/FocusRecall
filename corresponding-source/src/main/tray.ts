import { Menu, Tray, nativeImage, nativeTheme, type NativeImage } from 'electron'
import { paletteFor, type Appearance } from '@core/appearance'
import { sessionFocusSeconds, type SessionState } from '@core/session'
import { clockDisplay } from '@core/modes'
import { formatClock } from '@core/timer'
import { translate, type AppLanguage } from '@core/localization'

/** Draw a filled, anti-aliased circle (or a ring when idle) as a BGRA bitmap. */
function circleBitmap(size: number, hex: string, ring: boolean): Buffer {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const buf = Buffer.alloc(size * size * 4)
  const c = size / 2
  const outer = size / 2 - size / 16
  const inner = ring ? outer - size / 6 : -1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c)
      let a = Math.min(1, Math.max(0, outer - d + 0.5))
      if (ring) a *= Math.min(1, Math.max(0, d - inner + 0.5))
      const i = (y * size + x) * 4
      buf[i] = b
      buf[i + 1] = g
      buf[i + 2] = r
      buf[i + 3] = Math.round(a * 255)
    }
  }
  return buf
}

function stageIcon(color: string, ring: boolean): NativeImage {
  const img = nativeImage.createEmpty()
  for (const scale of [1, 1.5, 2]) {
    const size = Math.round(16 * scale)
    img.addRepresentation({ scaleFactor: scale, width: size, height: size, buffer: circleBitmap(size, color, ring) })
  }
  return img
}

/**
 * Tray icon: stage by colour, time in the tooltip. Digits are never drawn into
 * the icon.
 */
export class TrayController {
  private tray: Tray
  private ticker: NodeJS.Timeout | null = null
  private state: SessionState | null = null
  private iconKey = ''
  private tooltip = ''
  private menuKey = ''
  private panelOpen = false
  private pending: NodeJS.Immediate | null = null
  private forceIcon = false
  private disposed = false

  constructor(
    private appearance: () => Appearance,
    private actions: { onShow: () => void; onTogglePanel: () => void; onQuit: () => void },
    private language: () => AppLanguage = () => 'en'
  ) {
    this.tray = new Tray(stageIcon('#888888', true))
    this.tray.setToolTip('FocusRecall')
    this.tray.on('click', actions.onShow)
    this.setPanelOpen(false)
    nativeTheme.on('updated', this.themeChanged)
  }

  /** Rebuild the menu so the panel checkbox matches its state. */
  setPanelOpen(open: boolean): void {
    this.panelOpen=open
    this.schedule()
  }

  private updateMenu():void {
    const key=JSON.stringify([this.panelOpen,this.language()])
    if(key===this.menuKey)return
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: translate(this.language(), 'Show FocusRecall'), click: this.actions.onShow },
        { label: translate(this.language(), 'Floating panel'), type: 'checkbox', checked: this.panelOpen, click: this.actions.onTogglePanel },
        { type: 'separator' },
        { label: translate(this.language(), 'Quit'), click: this.actions.onQuit }
      ])
    )
    this.menuKey=key
  }

  update(state: SessionState): void {
    if(this.disposed)return
    this.state = state
    const ticking=!!state.running||state.rest?.phase==='running'
    if(ticking&&!this.ticker)this.ticker=setInterval(()=>this.schedule(),1000)
    if(!ticking&&this.ticker){clearInterval(this.ticker);this.ticker=null}
    this.schedule()
  }

  private themeChanged=():void=>this.schedule(true)

  /** Cosmetic shell calls can be slow on Windows. Commit/show study UI first,
   * then refresh the latest tray state once, without retaining stale work. */
  private schedule(forceIcon=false):void {
    if(this.disposed)return
    this.forceIcon ||= forceIcon
    if(this.pending)return
    this.pending=setImmediate(()=>{
      this.pending=null
      if(this.disposed)return
      const force=this.forceIcon;this.forceIcon=false
      try{this.updateMenu();this.render(force)}catch{console.error('FocusRecall tray refresh failed.')}
    })
  }

  private render(forceIcon = false): void {
    const s = this.state
    if (!s) return
    const p = paletteFor(this.appearance(), nativeTheme.shouldUseDarkColors)

    let color = p.muted
    let ring = true
    let tip = 'FocusRecall'
    if (s.running) {
      const b = s.running
      const view = clockDisplay(b.timerMode, b.targetSeconds, sessionFocusSeconds(b, Date.now()))
      const paused = b.pauses.some((x) => x.endedAt === null)
      color = view.overtime ? p.overtime : p.focus
      ring = paused
      tip = `Focus · ${b.itemName}
${view.main} ${view.aside}${paused ? ' · distracted' : ''}`
    } else if (s.stage === 'recall') {
      color = p.recall
      ring = false
      tip = 'Recall'
    } else if (s.stage === 'rest') {
      color = p.rest
      ring = s.rest?.phase !== 'running'
      const left = s.rest?.endsAt ? Math.max(0, (Date.parse(s.rest.endsAt) - Date.now()) / 1000) : null
      tip = left !== null && s.rest?.phase === 'running' ? `Rest · ${formatClock(left)} left` : 'Rest'
    }

    const key = `${color}|${ring}`
    if (forceIcon || key !== this.iconKey) {
      this.tray.setImage(stageIcon(color, ring))
      this.iconKey = key
    }
    if(tip!==this.tooltip){this.tray.setToolTip(tip);this.tooltip=tip}
  }

  destroy(): void {
    if(this.disposed)return
    this.disposed=true
    if(this.pending)clearImmediate(this.pending)
    this.pending=null
    nativeTheme.off('updated',this.themeChanged)
    if (this.ticker) clearInterval(this.ticker)
    this.tray.destroy()
  }
}
