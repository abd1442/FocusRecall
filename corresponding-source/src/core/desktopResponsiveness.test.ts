import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { DEFAULT_APPEARANCE } from './appearance'
import { IDLE_STATE } from './session'

const native=vi.hoisted(()=>({windows:[] as any[],trays:[] as any[],theme:null as any}))
vi.mock('../main/security',()=>({protectRenderer:vi.fn(),rendererDevToolsAllowed:()=>true}))
vi.mock('../main/windows',()=>({lockPageZoom:vi.fn()}))
vi.mock('@electron-toolkit/utils',()=>({is:{dev:false}}))
vi.mock('electron',async()=>{
  const {EventEmitter}=await import('node:events')
  const work={x:0,y:0,width:1920,height:1080}
  native.theme=Object.assign(new EventEmitter(),{shouldUseDarkColors:false})
  class Window extends EventEmitter {
    position:number[];size:number[];visible=false;destroyed=false;options:any
    constructor(options:any){super();this.options=options;this.position=[options.x,options.y];this.size=[options.width,options.height];native.windows.push(this)}
    getSize=()=>this.size;getPosition=()=>this.position
    getBounds=()=>({x:this.position[0],y:this.position[1],width:this.size[0],height:this.size[1]})
    setSize=vi.fn((w:number,h:number)=>{this.size=[w,h]})
    setBounds=vi.fn((b:{x:number;y:number;width:number;height:number})=>{this.position=[b.x,b.y];this.size=[b.width,b.height];this.emit('moved')})
    setPosition=vi.fn((x:number,y:number)=>{this.position=[x,y];this.emit('moved')})
    isDestroyed=()=>this.destroyed;isVisible=()=>this.visible
    setOpacity=vi.fn();setResizable=vi.fn();setFocusable=vi.fn();setAlwaysOnTop=vi.fn();setVisibleOnAllWorkspaces=vi.fn();moveTop=vi.fn();loadFile=vi.fn()
    show=vi.fn(()=>{this.visible=true});showInactive=vi.fn(()=>{this.visible=true});hide=vi.fn(()=>{this.visible=false})
    destroy=vi.fn(()=>{this.destroyed=true;this.emit('closed')})
  }
  class Tray extends EventEmitter {
    constructor(..._args:unknown[]){super();native.trays.push(this)}
    setToolTip=vi.fn();setContextMenu=vi.fn();setImage=vi.fn();destroy=vi.fn()
  }
  return {BrowserWindow:Window,Tray,nativeTheme:native.theme,nativeImage:{createEmpty:()=>({addRepresentation:vi.fn()})},Menu:{buildFromTemplate:(v:unknown)=>v},screen:{getPrimaryDisplay:()=>({workArea:work}),getAllDisplays:()=>[{workArea:work}],getDisplayNearestPoint:()=>({workArea:work}),getDisplayMatching:()=>({workArea:work}),getCursorScreenPoint:()=>({x:0,y:0})}}
})
import { PanelController } from '../main/panel'
import { TrayController } from '../main/tray'

beforeEach(()=>{vi.useFakeTimers();native.windows.length=0;native.trays.length=0})
afterEach(()=>{vi.useRealTimers();native.theme.removeAllListeners()})

describe('Windows transition work',()=>{
  it('keeps repeated timer-style changes on screen using one native bounds operation',()=>{
    const moved=vi.fn(),panel=new PanelController(moved)
    const settings={...DEFAULT_SETTINGS,panelOpen:true,panelExpanded:false,panelPosition:{x:1680,y:930}}
    panel.sync(settings,DEFAULT_APPEARANCE)
    const win=native.windows[0];win.emit('ready-to-show');vi.runOnlyPendingTimers()
    for(let i=0;i<10;i++){
      win.setBounds.mockClear();win.setSize.mockClear();win.setPosition.mockClear()
      const appearance={...DEFAULT_APPEARANCE,panelTimerDisplay:i%2?'digital' as const:'circular' as const}
      panel.sync({...settings,panelExpanded:i%2===0},appearance)
      const bounds=win.getBounds()
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0)
      expect(bounds.x+bounds.width).toBeLessThanOrEqual(1920);expect(bounds.y+bounds.height).toBeLessThanOrEqual(1080)
      expect(win.setBounds.mock.calls.length+win.setSize.mock.calls.length).toBe(1)
      expect(win.setPosition).not.toHaveBeenCalled()
      panel.sync({...settings,panelExpanded:i%2===0},appearance)
      expect(win.setBounds.mock.calls.length+win.setSize.mock.calls.length).toBe(1)
    }
    expect(native.windows).toHaveLength(1);expect(moved).not.toHaveBeenCalled()
    panel.destroy();vi.runOnlyPendingTimers();expect(vi.getTimerCount()).toBe(0)
  })
  it('reuses a ready panel, avoids redundant native calls and restores timer position once',()=>{
    const moved=vi.fn(),panel=new PanelController(moved),settings={...DEFAULT_SETTINGS,panelOpen:true,panelPosition:{x:1500,y:30}}
    panel.sync(settings,DEFAULT_APPEARANCE);const win=native.windows[0];win.emit('ready-to-show');vi.runOnlyPendingTimers()
    win.setPosition.mockClear();win.setSize.mockClear();win.setOpacity.mockClear()
    panel.sync(settings,DEFAULT_APPEARANCE);panel.hover(false)
    expect(win.setPosition).not.toHaveBeenCalled();expect(win.setSize).not.toHaveBeenCalled();expect(win.setOpacity).not.toHaveBeenCalled()
    panel.setPreparing(true);expect(win.setSize).not.toHaveBeenCalled()
    panel.sync(settings,DEFAULT_APPEARANCE);expect(win.setBounds).toHaveBeenCalledTimes(1);expect(win.setPosition).not.toHaveBeenCalled()
    panel.sync(settings,DEFAULT_APPEARANCE);expect(win.setBounds).toHaveBeenCalledTimes(1)
    panel.setPreparing(false);panel.sync(settings,DEFAULT_APPEARANCE)
    expect(win.position).toEqual([1500,30]);expect(win.setBounds).toHaveBeenCalledTimes(2);expect(moved).not.toHaveBeenCalled()
    panel.close();panel.sync(settings,DEFAULT_APPEARANCE);expect(native.windows).toHaveLength(1)
    panel.destroy();vi.runOnlyPendingTimers();expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps preparation focusable, timers non-activating, and handles destroyed-window recreation',()=>{
    const panel=new PanelController(vi.fn()),settings={...DEFAULT_SETTINGS,panelOpen:true}
    panel.setPreparing(true);panel.sync(settings,DEFAULT_APPEARANCE);let win=native.windows[0]
    win.emit('ready-to-show');expect(win.show).toHaveBeenCalledTimes(1)
    panel.setPreparing(false);panel.sync(settings,DEFAULT_APPEARANCE);expect(win.setFocusable).not.toHaveBeenCalled();expect(win.options.focusable).toBe(true)
    panel.close();panel.sync(settings,DEFAULT_APPEARANCE);expect(win.showInactive).toHaveBeenCalled()
    win.destroy();panel.sync(settings,DEFAULT_APPEARANCE);win=native.windows[1];win.emit('ready-to-show');expect(win.showInactive).toHaveBeenCalledTimes(1)
    panel.destroy();vi.runOnlyPendingTimers();expect(vi.getTimerCount()).toBe(0)
  })
  it('creates a timer directly with Get Ready off without disabling native interaction',()=>{
    const panel=new PanelController(vi.fn())
    panel.prepare({...DEFAULT_SETTINGS,preparationEnabled:false},DEFAULT_APPEARANCE)
    const win=native.windows[0]
    expect(win.options.focusable).toBe(true)
    win.emit('ready-to-show')
    expect(win.show).not.toHaveBeenCalled()
    panel.sync({...DEFAULT_SETTINGS,panelOpen:true},DEFAULT_APPEARANCE)
    expect(win.showInactive).toHaveBeenCalledTimes(1)
    expect(win.show).not.toHaveBeenCalled()
    expect(win.setFocusable).not.toHaveBeenCalled()
    panel.destroy()
  })
  it('coalesces cosmetic tray work, applies the latest state, and cancels work/listeners on teardown',()=>{
    const tray=new TrayController(()=>DEFAULT_APPEARANCE,{onShow:vi.fn(),onTogglePanel:vi.fn(),onQuit:vi.fn()}),win=native.trays[0]
    tray.update(IDLE_STATE);tray.setPanelOpen(true);tray.setPanelOpen(false);tray.update({...IDLE_STATE,stage:'recall'})
    expect(win.setImage).not.toHaveBeenCalled();vi.runOnlyPendingTimers()
    expect(win.setImage).toHaveBeenCalledTimes(1);expect(win.setToolTip).toHaveBeenLastCalledWith('Recall');expect(win.setContextMenu.mock.calls[0][0][1].checked).toBe(false)
    tray.update({...IDLE_STATE,stage:'recall'});vi.runOnlyPendingTimers()
    expect(win.setImage).toHaveBeenCalledTimes(1);expect(win.setToolTip).toHaveBeenCalledTimes(2);expect(win.setContextMenu).toHaveBeenCalledTimes(1)
    native.theme.emit('updated');vi.runOnlyPendingTimers();expect(win.setImage).toHaveBeenCalledTimes(2)
    tray.update(IDLE_STATE);tray.destroy();tray.update({...IDLE_STATE,running:{} as NonNullable<typeof IDLE_STATE.running>});tray.destroy();vi.runOnlyPendingTimers();expect(win.setToolTip).toHaveBeenLastCalledWith('Recall');expect(native.theme.listenerCount('updated')).toBe(0);expect(vi.getTimerCount()).toBe(0)
  })
})
