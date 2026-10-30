import { unsafeRuntimeSwitches } from '@core/runtimeSecurity'
declare const __FOCUSRECALL_QA__: boolean
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, globalShortcut, Menu, nativeTheme, Notification, powerMonitor, screen, shell, session as electronSession } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { paletteFor, type Appearance } from '@core/appearance'
import type { Stage } from '@core/session'
import type { AppSettings, SettingKey } from '@core/settings'
import { RestMusic } from './restMusic'
import { formatDuration } from '@core/timer'
import { openDatabase, type Db } from './db/database'
import { installPendingRestore } from './db/backups'
import { BlocksRepo } from './repos/blocks'
import { DistractionRepo } from './repos/distractions'
import { LogRepo } from './repos/logs'
import { LibraryRepo } from './repos/library'
import { SessionRepo } from './repos/sessions'
import { SettingsRepo } from './repos/settings'
import { SessionEngine } from './session'
import { broadcast, registerIpc } from './ipc'
import { windowsMusic } from './music'
import { windowsNotifier,sendStudyReminder } from './notify'
import { translate } from '@core/localization'
import { StudyReminderService } from './studyReminders'
import { PanelController } from './panel'
import { NativeForegroundWatcher } from './foreground'
import { trackingConsented,persistTrackingPreference } from '@core/trackingConsent'
import { Hotkeys } from './hotkeys'
import { ReasonPopup } from './reasons'
import { CaptureBox } from './capture'
import { CaptureRepo } from './repos/captures'
import { Tracker } from './tracking'
import { TrayController } from './tray'
import { StatsRepo } from './repos/stats'
import { databaseFile, readConfig, seedDemo, writeConfig } from './demo'
import { attachTextContextMenu, createMainWindow, type SavedBounds } from './windows'
import { profileDirectory,isolatedDataDirectory,packagedDataDirectory } from './identity'
import { runtimeAppId, PRODUCT_NAME } from '@core/identity'

// This constant is compiled separately; no runtime environment variable unlocks production.
if(app.isPackaged && !__FOCUSRECALL_QA__ && unsafeRuntimeSwitches(app.commandLine)){app.exit(1);process.exit(1)}

let db: Db | null = null
let engine: SessionEngine | null = null
let tray: TrayController | null = null
let panel: PanelController | null = null
let tracker: Tracker | null = null
let reasons: ReasonPopup | null = null
let captureBox: CaptureBox | null = null
let mainWin: BrowserWindow | null = null
let settingsRepo: SettingsRepo | null = null
let quitting = false
let reminders:StudyReminderService|null=null

// A test run with its own data folder also gets its own Chromium profile, so it
// can run beside the real app (the one-instance lock belongs to the profile).
let startupDataDirectory=isolatedDataDirectory()
try{
  if(app.isPackaged)startupDataDirectory=packagedDataDirectory(__FOCUSRECALL_QA__,app.getPath('appData'))
}catch{
  // No fallback, recovery dialog, profile creation or database access on refusal.
  console.error('A14 Pomodoro startup refused: invalid or overlapping data directory.')
  app.exit(1)
  process.exit(1)
}
app.setPath('userData',profileDirectory(app.getPath('appData'),startupDataDirectory))
app.setName(PRODUCT_NAME)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
  app.whenReady().then(start).catch(async (error) => {
    const dataDir=startupDataDirectory || app.getPath('userData')
    const result=await dialog.showMessageBox({type:'error',title:'A14 Pomodoro data recovery',message:'A14 Pomodoro could not safely open your study data.',detail:`${error instanceof Error?error.message:String(error)}\n\nNo data reset was performed. Keep your data folder and backups. If restoration was rolled back, restart to use your previous data.`,buttons:['Open backup folder','Quit'],defaultId:1,cancelId:1})
    if(result.response===0){const folder=join(dataDir,'backups');mkdirSync(folder,{recursive:true});await shell.openPath(folder)}
    quitting=true;app.quit()
  })
}

function showMain(): void {
  if (!mainWin || mainWin.isDestroyed()) {
    openMainWindow()
    return
  }
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.show()
  mainWin.focus()
}

function openMainWindow(): void {
  const s = settingsRepo!
  const appearance = s.getAppearance()
  mainWin = createMainWindow({
    saved: s.readRaw('mainWindowBounds') as SavedBounds | null,
    background: paletteFor(appearance, nativeTheme.shouldUseDarkColors).bg,
    onBoundsChanged: (b) => s.writeRaw('mainWindowBounds', b)
  })

  // The notes editor vetoes unloading while an explicit save is pending or
  // changes remain. Canceling a quit must also restore ordinary close-to-tray
  // behavior, which depends on the global quitting flag.
  let discardNoteChanges = false, askingAboutNote = false
  mainWin.webContents.on('will-prevent-unload', event => {
    if(discardNoteChanges){discardNoteChanges=false;event.preventDefault();return}
    quitting=false
    if(askingAboutNote)return
    askingAboutNote=true
    showMain()
    const language=s.getAll().language
    void dialog.showMessageBox(mainWin!,{
      type:'warning',title:translate(language,'Unsaved note'),
      message:translate(language,'Quit without saving note changes?'),
      buttons:[translate(language,'Keep editing'),translate(language,'Quit and discard')],
      defaultId:0,cancelId:0,noLink:true
    }).then(result=>{if(result.response===1){discardNoteChanges=true;app.quit()}})
      .catch(()=>{quitting=false})
      .finally(()=>{askingAboutNote=false})
  })

  // Active study and explicitly enabled reminders continue in the tray.
  mainWin.on('close', (e) => {
    const all=s.getAll()
    if (!quitting && (engine&&engine.get().stage!=='idle'||all.studyReminderDailyEnabled)) {
      e.preventDefault()
      mainWin?.hide()
    }
  })
  mainWin.on('closed', () => {
    mainWin = null
    // The panel may still exist, so quit explicitly instead of waiting for window-all-closed.
    if (!quitting) app.quit()
  })
}

function start(): void {
  electronApp.setAppUserModelId(runtimeAppId(__FOCUSRECALL_QA__))
  // No application menu: it only carried zoom and reload shortcuts.
  Menu.setApplicationMenu(null)
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    attachTextContextMenu(window.webContents)
  })
  configureSpellCheck()
  electronSession.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false))
  electronSession.defaultSession.setPermissionCheckHandler(()=>false)

  // The override isolates both the database and Chromium profile.
  const dataDir = startupDataDirectory || app.getPath('userData')
  mkdirSync(dataDir, { recursive: true })
  const config = readConfig(dataDir)
  const file=databaseFile(dataDir,config.demo)
  db = installPendingRestore(file,openDatabase) ?? openDatabase(file)
  if (config.demo) seedDemo(db)

  const settings = (settingsRepo = new SettingsRepo(db))
  const library = new LibraryRepo(db)
  const logs = new LogRepo(db)
  const blocks = new BlocksRepo(db, logs)
  const distractions = new DistractionRepo(db)
  const captures = new CaptureRepo(db)
  const sessionRepo = new SessionRepo(db)
  const statsRepo = new StatsRepo(db, logs)
  engine = new SessionEngine(sessionRepo, logs, distractions, captures, settings, () => blocks.summaries())
  const suspendTiming = (): void => { engine?.interruptTiming(); broadcast('clock:changed', null) }
  const resumeTiming = (): void => { engine?.interruptTiming(true); broadcast('clock:changed', null) }
  powerMonitor.on('suspend', suspendTiming)
  powerMonitor.on('lock-screen', suspendTiming)
  powerMonitor.on('resume', resumeTiming)
  powerMonitor.on('unlock-screen', resumeTiming)
  captureBox = new CaptureBox()
  const popupPlace = (): { panelBounds: Electron.Rectangle | null; panelSize: ReturnType<typeof settings.getAppearance>['panelSize'] } => ({
    panelBounds: panel?.bounds() ?? null,
    panelSize: settings.getAppearance().panelSize
  })
  const openCapture = (mode: 'stuck'): void => {
    const c = settings.getAll().captures
    if (!c.stuck) return
    void captureBox?.show(mode, popupPlace())
  }
  const watcher = new NativeForegroundWatcher(undefined,undefined,()=>{engine?.get()})
  reasons = new ReasonPopup()
  tracker = new Tracker(watcher, distractions, (appName) => {
    broadcast('rest:nudge', { app: appName })
    windowsNotifier.quiet('Rest works better away from screens', `${appName} pulls you back into focus mode. Rest works better away from it.`)
  }, () => { engine?.get() })
  engine.on('timingInterrupted', ({ at }) => tracker?.interrupt(at))
  tracker.setEnabled(trackingConsented(settings.getAll()),settings.getAll().foregroundTrackingTitlesEnabled)
  watcher.on('status', (status) => broadcast('tracking:changed', status))

  // The Switch picker opens in the main window; afterwards A14 Pomodoro goes back to where it was.
  let restoreAfterSwitch: 'minimize' | 'hide' | null = null
  const openSwitch = (): void => {
    if (!engine?.get().running) return
    if (mainWin && !mainWin.isDestroyed()) restoreAfterSwitch = mainWin.isMinimized() ? 'minimize' : mainWin.isVisible() ? null : 'hide'
    showMain()
    broadcast('ui:openSwitch', null)
  }
  const switchClosed = (): void => {
    const how = restoreAfterSwitch
    restoreAfterSwitch = null
    if (!how || !engine?.get().running || !mainWin || mainWin.isDestroyed()) return
    if (how === 'minimize') mainWin.minimize()
    else mainWin.hide()
  }
  const hotkeys = new Hotkeys({
    distracted: () => {
      try {
        if (engine?.get().running) engine.toggleDistracted()
      } catch {
        // Nothing running; the key does nothing.
      }
    },
    switch: openSwitch,
    stuck: () => {
      if (!engine?.get().running) return
      engine.mark('stuck', null)
      broadcast('capture:marked', { kind: 'stuck' })
      openCapture('stuck')
    },
    resisted: () => {
      if (!engine?.get().running) return
      engine.mark('resisted', null)
      broadcast('capture:marked', { kind: 'resisted' })
    }
  })
  const keysOf = (a: AppSettings): Record<'distracted' | 'switch' | 'stuck' | 'resisted', string> => ({
    distracted: a.hotkeyDistracted,
    switch: a.hotkeySwitch,
    stuck: a.captures.stuck ? a.hotkeyStuck : '',
    resisted: a.captures.resisted ? a.hotkeyResisted : ''
  })
  hotkeys.configure(keysOf(settings.getAll()))

  /** The single place settings change: persist, apply to the panel, tell every window. */
  function setSetting<K extends SettingKey>(key: K, value: AppSettings[K]): AppSettings {
    if (key === 'foregroundTrackingEnabled' && typeof value !== 'boolean') throw new Error('Choose on or off for automatic tracking.')
    persistTrackingPreference(key,()=>settings.set(key,value),()=>settings.getAll(),(enabled,titles)=>tracker?.setEnabled(enabled,titles))
    if(key.startsWith('studyReminder'))reminders?.invalidate()
    const all = settings.getAll()
    if (key === 'hotkeyDistracted' || key === 'hotkeySwitch' || key === 'hotkeyStuck' || key === 'hotkeyResisted' || key === 'captures') {
      hotkeys.configure(keysOf(all))
      broadcast('hotkeys:changed', hotkeys.status())
    }
    panel?.sync(all, settings.getAppearance())
    tray?.setPanelOpen(all.panelOpen)
    broadcast('settings:changed', all)
    return all
  }
  const togglePanel = (): void => void setSetting('panelOpen', !settings.getAll().panelOpen)
  /** Close the panel from its own close button: the main window comes back. */
  const closePanel = (): void => {
    setSetting('panelOpen', false)
    showMain()
  }

  /** Save the appearance, apply the scale to every window, and tell every window. */
  function setAppearance(a: Appearance): Appearance {
    const saved = settings.setAppearance(a)
    panel?.sync(settings.getAll(), saved)
    broadcast('appearance:changed', saved)
    tray?.update(engine!.get())
    return saved
  }

  panel = new PanelController((pos) => settings.set('panelPosition', pos))
  tray = new TrayController(
    () => settings.getAppearance(),
    { onShow: showMain, onTogglePanel: togglePanel, onQuit: () => ((quitting = true), app.quit()) },
    () => settings.getAll().language
  )

  let lastStage: Stage = engine.get().stage
  engine.on('changed', (state) => {
    reminders?.invalidate()
    broadcast('session:changed', state)
    tray?.update(state)
    tracker?.sync(state)
    if (state.running) hotkeys.activate()
    else hotkeys.deactivate()
    if (!state.running) {
      reasons?.hide()
      captureBox?.hide()
    }
    const all = settings.getAll()
    if (state.stage === 'focus' && lastStage !== 'focus') {
      // A block starts: show the panel and get the main window out of the way (both are settings).
      if ((all.studyExperience==='quick'||all.panelAutoShow) && !all.panelOpen) setSetting('panelOpen', true)
      if (all.minimizeOnStart && all.starterGuideCompleted && mainWin && !mainWin.isDestroyed() && !mainWin.isMinimized()) mainWin.minimize()
    } else if (lastStage === 'focus' && state.stage !== 'focus'&&all.studyExperience!=='quick') {
      // Focus ended (Finish here or on the panel): the panel goes, the main window comes back for recall.
      if (all.panelOpen) setSetting('panelOpen', false)
      showMain()
    }
    lastStage = state.stage
  })
  const music = new RestMusic(windowsMusic, status => broadcast('music:changed', status))
  engine.on('restStarted', () => {
    const st = settings.getAll()
    if (st.studyExperience!=='quick'&&st.restMusic && st.restPlaylist) void music.command('open', st.restPlaylist, st.restMusicAutoPlay)
  })
  engine.on('restEnded', () => { void music.end() })
  app.once('before-quit', () => { void music.end() })
  engine.on('partEnded', ({ blockId, endedAt }) => {
    tracker?.partEnded(blockId, endedAt)
    const sessionId=distractions.sessionOfBlock(blockId)
    if(sessionId!==null)distractions.refreshSessionStats(sessionId)
  })
  engine.on('longAbsence', ({ minutes }) => {
    void reasons?.show({ kind: 'absence', minutes }, popupPlace())
  })
  engine.on('restOver', ({ blockId }) => {
    broadcast('session:restOver', { blockId })
    if(settings.getAll().studyExperience!=='quick')showMain()
  })

  engine.on('targetReached', ({ blockId, itemName }) => {
    broadcast('session:targetReached', { blockId })
    const target = engine?.get().running?.targetSeconds ?? 0
    windowsNotifier.quiet(translate(settings.getAll().language, 'Target reached'), settings.getAll().studyExperience==='quick'?itemName:translate(settings.getAll().language, '{duration} on {subject}. Moving to recall now is a good idea.', { duration: formatDuration(target), subject: itemName }))
  })

  const openFromReminder=():void=>{showMain();if(engine?.get().stage==='idle')broadcast('ui:openHome',null)}
  reminders=new StudyReminderService({
    settings:()=>settings.getAll(),read:()=>settings.readRaw('studyReminderState'),write:state=>settings.writeRaw('studyReminderState',state),
    supported:()=>Notification.isSupported(),send:(title,body)=>sendStudyReminder(translate(settings.getAll().language,title),translate(settings.getAll().language,body),openFromReminder),
    context:()=>{
      const state=engine!.get()
      let active=false
      try{active=powerMonitor.getSystemIdleState(60)==='active'}catch{/* No reminder if Windows activity status is unavailable. */}
      return {active,busy:state.stage!=='idle'||!!state.running||!!state.recovery||!!state.sitting,appFocused:!!mainWin&&!mainWin.isDestroyed()&&mainWin.isFocused()}
    },
    patterns:()=>[] // Retired personal scheduling; no hidden Stats rebuild.
  })
  registerIpc({
    music,
    reminders,
    databaseFile:file,
    restartForRestore:()=>{
      // Prevent new IPC work first; normal will-quit disposes services and closes SQLite.
      quitting=true;app.relaunch();setTimeout(()=>app.quit(),100)
    },
    db,
    stats: statsRepo,
    library,
    blocks,
    logs,
    settings,
    session: engine,
    distractions,
    showMain,
    openSwitch,
    switchClosed,
    hideReasons: () => reasons?.hide(),
    captures,
    sessions: sessionRepo,
    openCapture,
    closeCapture: () => captureBox?.hide(),
    popupReady: (which) => (which === 'reasons' ? reasons?.markReady() : captureBox?.markReady()),
    hotkeyStatus: () => hotkeys.status(),
    trackingStatus: () => watcher.status(),
    togglePanel,
    closePanel,
    preparationPanel: (open) => {panel?.setPreparing(open,open&&mainWin&&!mainWin.isDestroyed()?screen.getDisplayMatching(mainWin.getBounds()).workArea:undefined);panel?.sync(settings.getAll(),settings.getAppearance());if(open&&settings.getAll().minimizeOnStart&&settings.getAll().starterGuideCompleted&&mainWin&&!mainWin.isDestroyed()&&!mainWin.isMinimized())mainWin.minimize()},
    focusPanel: async () => { setSetting('panelOpen',true); await panel?.focusControls() },
    panelHover: (over) => panel?.hover(over),
    demo: {
      active: config.demo,
      // Switching restarts A14 Pomodoro on the other database; the two never mix.
      set: (on) => {
        writeConfig(dataDir, { demo: on })
        quitting = true
        app.relaunch()
        app.exit(0)
      }
    },
    setSetting,
    setAppearance
  })

  openMainWindow()
  Notification.handleActivation(openFromReminder)
  // Load the absence confirmation and stuck-note windows hidden.
  reasons.prepare()
  captureBox.prepare()
  const all = settings.getAll()
  tray.update(engine.get())
  tracker.sync(engine.get())
  tray.setPanelOpen(all.panelOpen)
  if (all.preparationEnabled || all.panelAutoShow || all.panelOpen) panel.prepare(all, settings.getAppearance())
  panel.sync(all, settings.getAppearance())
  reminders.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
}

/**
 * Spell-check in English and, when Windows has it, Arabic. On Windows the
 * system spell checker is used, so only languages installed in Windows are
 * available.
 */
function configureSpellCheck(): void {
  const ses = electronSession.defaultSession
  const available = ses.availableSpellCheckerLanguages
  const pick = (re: RegExp): string[] => {
    const exact = available.filter((l) => re.test(l))
    return exact.length ? [exact[0]] : []
  }
  const english = pick(/^en-US$/i).length ? pick(/^en-US$/i) : pick(/^en/i)
  const langs = [...english, ...pick(/^ar/i)]
  try {
    if (langs.length) ses.setSpellCheckerLanguages(langs)
  } catch {
    // Some platforms ignore explicit languages and follow the OS.
  }
}

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  reminders?.dispose()
  engine?.dispose()
  tracker?.dispose()
  reasons?.destroy()
  captureBox?.destroy()
  globalShortcut.unregisterAll()
  panel?.destroy()
  tray?.destroy()
  db?.close()
  db = null
})
