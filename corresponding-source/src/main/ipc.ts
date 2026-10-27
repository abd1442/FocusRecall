import { translate } from '@core/localization'
import { normalizeLearn, updateLearn } from '@core/learn'
import { selectAdvice, lessAdvice, normalizeAdviceHistory } from '@core/advice'
import { localizedError } from '@core/localizedError'
import type { AppLanguage } from '@core/localization'
import { PreparationGate } from '@core/preparation'
import { DATA_IDENTITY } from '@core/identity'
import { parseDayStart, studyDayKey } from '@core/studyDay'
import { assertCaller } from './security'
import { safeReportHtml, targetKind } from '@core/desktopSecurity'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { ArgsOf, Channel, EventContract, EventName, ResultOf } from '@core/api'
import { normalizeAppearance, type Appearance } from '@core/appearance'
import type { AppSettings, SettingKey } from '@core/settings'
import type { HotkeyStatus, TrackingStatus } from '@core/api'
import type { BlocksRepo } from './repos/blocks'
import type { CaptureRepo } from './repos/captures'
import type { DistractionRepo } from './repos/distractions'
import type { SessionRepo } from './repos/sessions'
import type { LibraryRepo } from './repos/library'
import type { LogRepo } from './repos/logs'
import type { SettingsRepo } from './repos/settings'
import type { StatsRepo } from './repos/stats'
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { backupFolder, prepareRestore, snapshot, validateBackup } from './db/backups'
import { renderReportPng } from './reportImage'
import { NotesService } from './notes'
import { StudyToolsRepo } from './repos/studyTools'
import { relative, resolve, isAbsolute, join, dirname } from 'node:path'
import type { Db } from './db/database'
import type { SessionEngine } from './session'
import type { StudyReminderService } from './studyReminders'
import type { RestMusic } from './restMusic'

let restoring = false
let ipcLanguage:()=>AppLanguage=()=>'en'
function handle<C extends Channel>(
  channel: C,
  fn: (...args: ArgsOf<C>) => ResultOf<C> | Promise<ResultOf<C>>
): void {
  const changesStudy=['history:updateBlock','history:saveLog','history:deleteBlock','history:deleteSession','notes:delete','day:save','day:skip']
  ipcMain.handle(channel, async (event, ...args) => {
    try {
    assertCaller(event,channel,args)
    if (restoring) throw new Error('FocusRecall is restarting to restore your data. Please wait.')
    const result=fn(...(args as ArgsOf<C>))
    if(changesStudy.includes(channel))return await Promise.resolve(result).then((value)=>{broadcast('study:changed',null);return value})
    return await result
    } catch(error) { throw new Error(localizedError(ipcLanguage(),error)) }
  })
}

/**
 * Open a resource the user added: web links in the default browser, app
 * links (notion://, obsidian://, spotify:) through Windows, anything else as
 * a file or folder path.
 */
async function openTarget(target: string): Promise<void> {
  const t = target.trim()
  if (targetKind(t)==='url') {
    await shell.openExternal(t)
    return
  }
  const err = await shell.openPath(t)
  if (err) throw new Error(`Could not open ${t}: ${err}`)
}

/** Push an event to every open window. */
export function broadcast<E extends EventName>(event: E, payload: EventContract[E]): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(event, payload)
  }
}

export function registerIpc(deps: {
  music: RestMusic
  databaseFile: string
  restartForRestore: () => void
  db: Db
  library: LibraryRepo
  blocks: BlocksRepo
  logs: LogRepo
  settings: SettingsRepo
  session: SessionEngine
  reminders: StudyReminderService
  distractions: DistractionRepo
  captures: CaptureRepo
  sessions: SessionRepo
  stats: StatsRepo
  showMain: () => void
  openCapture: (mode: 'stuck') => void
  closeCapture: () => void
  popupReady: (which: 'reasons' | 'capture') => void
  openSwitch: () => void
  switchClosed: () => void
  hideReasons: () => void
  hotkeyStatus: () => HotkeyStatus
  trackingStatus: () => TrackingStatus
  focusPanel: () => Promise<void>
  togglePanel: () => void
  closePanel: () => void
  preparationPanel: (open:boolean) => void
  panelHover: (over: boolean) => void
  demo: { active: boolean; set: (on: boolean) => void }
  setAppearance: (a: Appearance) => Appearance
  setSetting: <K extends SettingKey>(key: K, value: AppSettings[K]) => AppSettings
}): void {
  const { library, blocks, logs, settings, session, distractions, captures, sessions } = deps
  ipcLanguage=()=>settings.getAll().language
  const t=(key:string):string=>translate(settings.getAll().language,key)
  const notes = new NotesService(deps.db, settings)
  handle('music:status', () => deps.music.get())
  handle('music:command', action => deps.music.command(action, settings.getAll().restPlaylist))
  handle('studyReminders:status',()=>deps.reminders.status())
  handle('studyReminders:test',()=>deps.reminders.test())
  handle('studyReminders:pause',mode=>deps.reminders.pause(mode))
  let lastBackup: string | null = null
  const restoreChoices = new Map<string,string>()
  const backupRoot=dirname(backupFolder(deps.databaseFile,'manual'))
  handle('backup:create',async()=>{
    const folder=backupFolder(deps.databaseFile,'manual');mkdirSync(folder,{recursive:true})
    const r=await dialog.showSaveDialog({title:t('Back Up Data'),defaultPath:join(folder,`FocusRecall-${new Date().toISOString().replace(/[:.]/g,'-')}.db`),filters:[{name:t('FocusRecall database backup'),extensions:['db']}]})
    if(r.canceled || !r.filePath)return null
    const info=snapshot(deps.db,r.filePath);lastBackup=r.filePath
    return {name:info.name}
  })
  handle('backup:reveal',()=>{if(lastBackup)shell.showItemInFolder(lastBackup)})
  handle('backup:openFolder',async()=>{mkdirSync(backupRoot,{recursive:true});const error=await shell.openPath(backupRoot);if(error)throw new Error('Could not open the backup folder.')})
  handle('backup:inspectRestore',async()=>{
    const r=await dialog.showOpenDialog({title:t('Choose a FocusRecall backup'),defaultPath:backupRoot,properties:['openFile'],filters:[{name:t('FocusRecall database backup'),extensions:['db']}]})
    if(r.canceled)return null
    const file=r.filePaths[0],info=validateBackup(file)
    if(info.demo!==deps.demo.active)throw new Error('Demo and personal backups are separate. Switch to the matching data mode before restoring this backup.')
    const token=randomUUID();restoreChoices.clear();restoreChoices.set(token,file)
    return {token,name:info.name,schema:info.schema,bytes:info.bytes}
  })
  handle('backup:restore',(token)=>{
    const file=restoreChoices.get(token)
    if(!file)throw new Error('Choose and confirm the backup again.')
    if(session.get().stage!=='idle' || session.get().recovery)throw new Error('Finish or leave the current study workflow for later before restoring.')
    if(notes.isBusy)throw new Error('Wait for note saving or sending to finish before restoring data.')
    if(validateBackup(file).demo!==deps.demo.active)throw new Error('The selected backup changed. Choose a matching backup again.')
    prepareRestore(deps.db,deps.databaseFile,file)
    restoreChoices.delete(token);restoring=true;deps.restartForRestore()
  })
  const tools = new StudyToolsRepo(settings)
  const changedTools = (value:ReturnType<StudyToolsRepo['get']>) => {broadcast('tools:changed',null);return value}
  handle('tools:get',()=>tools.get())
  handle('tools:saveDiscovery',(entry)=>changedTools(tools.saveDiscovery(entry)))
  handle('tools:saveView',(v)=>changedTools(tools.saveView(v)))
  handle('tools:saveExperiment',(e)=>changedTools(tools.saveExperiment(e)))
  handle('tools:saveReview',(r)=>changedTools(tools.saveReview(r)))
  handle('tools:remove',(kind,id)=>changedTools(tools.remove(kind,id)))
  handle('notes:search',query=>notes.search(query))
  handle('notes:list',(itemId,blockId)=>notes.list(itemId,blockId))
  handle('notes:save',(note,sync)=>notes.save(note,sync))
  handle('notes:delete',id=>notes.delete(id))
  handle('notes:connection',()=>notes.configured())
  handle('notes:setToken',(token)=>notes.setToken(token))
  handle('notes:testNotion',(page)=>notes.sections(page))
  handle('notes:copy',(note,image)=>notes.copy(note,image))
  handle('notes:pickVault',async()=>{ const result=await dialog.showOpenDialog({ title:t('Choose your Obsidian vault folder'),properties:['openDirectory'] });return result.canceled ? null : result.filePaths[0] })
  handle('notes:pickFile',async(vault)=>{
    if (!vault) throw new Error('Choose a vault folder first.')
    const result=await dialog.showOpenDialog({ title:t('Choose a Markdown note inside your vault'),defaultPath:vault,properties:['openFile'],filters:[{name:t('Markdown'),extensions:['md']}] })
    if (result.canceled) return null
    const path=relative(resolve(vault),resolve(result.filePaths[0]))
    if (path.startsWith('..') || isAbsolute(path)) throw new Error('Choose a file inside this vault.')
    return path.replace(/\\/g,'/')
  })

  /**
   * After a distraction or a part changes: store the session's numbers again,
   * let the engine pick up new part times, and tell the windows.
   */
  const distractionChanged = (blockId: number | null): void => {
    const sessionId = blockId !== null ? distractions.sessionOfBlock(blockId) : null
    if (sessionId !== null) distractions.refreshSessionStats(sessionId)
    if (session.get().finished.some((f) => f.id === blockId)) session.touch()
    broadcast('distractions:changed', { blockId })
  }

  handle('library:listCategories', (includeArchived) => library.listCategories(includeArchived))
  handle('library:createCategory', (input) => library.createCategory(input))
  handle('library:updateCategory', (id, input) => library.updateCategory(id, input))
  handle('library:setCategoryArchived', (id, archived) => library.setCategoryArchived(id, archived))
  handle('library:deleteCategory', (id) => library.deleteCategory(id))
  handle('library:reorderCategories', (ids) => library.reorderCategories(ids))
  handle('library:moveCategory', (id, parentId) => library.moveCategory(id, parentId))
  handle('library:moveItem', (itemId, categoryId) => library.moveItem(itemId, categoryId))
  handle('library:itemStats', () => library.itemStats())

  handle('library:listItems', (filter) => library.listItems(filter))
  handle('library:listPickerItems', () => library.listPickerItems())
  handle('library:createItem', (input) => library.createItem(input))
  handle('library:updateItem', (id, input) => library.updateItem(id, input))
  handle('library:setItemArchived', (id, archived) => library.setItemArchived(id, archived))
  handle('library:setItemPinned', (id, pinned) => library.setItemPinned(id, pinned))
  handle('resources:list', (itemId) => library.listResources(itemId))
  handle('resources:save', (r) => library.saveResource(r))
  handle('resources:delete', (id) => library.deleteResource(id))
  handle('resources:reorder', (ids) => library.reorderResources(ids))
  handle('blocks:summaries', () => blocks.summaries())
  handle('shell:open', async(target) => {
    target=target.trim();targetKind(target)
    if (/^https:\/\/([a-z0-9-]+\.)?(notion\.so|notion\.site)\//i.test(target) && settings.getAll().notionOpenIn === 'desktop') {
      try { await shell.openExternal(target.replace(/^https:\/\//,'notion://')); return } catch { /* Fall back to the browser when no desktop handler is installed. */ }
    }
    await openTarget(target)
  })
  handle('shell:pickFile', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openFile'] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })

  handle('settings:getAll', () => settings.getAll())
  handle('learn:get',()=>normalizeLearn(settings.readRaw('learn.v1')))
  handle('learn:act',action=>{
    const config=settings.getAll(),day=studyDayKey(new Date(),parseDayStart(config.dayStart))
    const next=updateLearn(settings.readRaw('learn.v1'),action,day)
    settings.writeRaw('learn.v1',next)
    return next
  })
  handle('advice:choose',(surface,intent,another)=>{
    // Advice never accompanies active focus, even if an old window requests it.
    if(session.get().running&&session.get().stage==='focus')return null
    const result=selectAdvice(settings.readRaw('studyAdvice.v1'),surface,intent,another)
    settings.writeRaw('studyAdvice.v1',result.history)
    return result.id
  })
  handle('advice:less',id=>settings.writeRaw('studyAdvice.v1',lessAdvice(settings.readRaw('studyAdvice.v1'),id)))
  handle('advice:reset',()=>settings.writeRaw('studyAdvice.v1',normalizeAdviceHistory(null,Date.now())))
  handle('settings:set', (key, value) => {
    const state=session.get()
    if(key==='studyExperience'&&(state.stage!=='idle'||state.recovery||preparation.get()))throw Error('Finish the current study step before switching modes.')
    return deps.setSetting(key,value as never)
  })
  handle('appearance:get', () => settings.getAppearance())
  handle('appearance:set', (a) => deps.setAppearance(a))
  const presets=():{name:string;appearance:Appearance}[]=>{const stored=settings.readRaw('appearancePresets');return Array.isArray(stored)?stored:[]}
  handle('appearance:presets',()=>presets())
  handle('appearance:savePreset',(name,a)=>{const title=name.trim().slice(0,80);if(!title)throw new Error('Give this preset a name.');settings.writeRaw('appearancePresets',[...presets().filter((p)=>p.name!==title),{name:title,appearance:normalizeAppearance(a)}])})
  handle('appearance:deletePreset',(name)=>settings.writeRaw('appearancePresets',presets().filter((p)=>p.name!==name)))
  handle('appearance:export',async(a)=>{const result=await dialog.showSaveDialog({defaultPath:'FocusRecall appearance.json',filters:[{name:t('Appearance JSON'),extensions:['json']}]});if(result.canceled||!result.filePath)return null;writeFileSync(result.filePath,JSON.stringify({format:DATA_IDENTITY.appearanceFormat,version:1,appearance:normalizeAppearance(a)},null,2),'utf8');return result.filePath})
  handle('appearance:import',async()=>{const result=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:t('Appearance JSON'),extensions:['json']}]});if(result.canceled)return null;const file=result.filePaths[0];if(statSync(file).size>1000000)throw new Error('This preset file is too large.');const data=JSON.parse(readFileSync(file,'utf8'));if(data.format!==DATA_IDENTITY.appearanceFormat||data.version!==1||!data.appearance||typeof data.appearance!=='object')throw new Error('Choose a FocusRecall appearance preset JSON file.');return normalizeAppearance(data.appearance)})

  handle('app:version',()=>app.getVersion())
  handle('session:get', () => session.get())
  handle('session:resumeWorkflow', (id) => session.resumeWorkflow(id))
  handle('session:leaveWorkflow', (id) => session.leaveWorkflow(id))
  handle('session:getLogDraft', (id) => session.getLogDraft(id))
  handle('session:getRecallDraft',(id)=>session.getRecallDraft(id))
  handle('session:saveRecallDraft',(id,draft)=>session.saveRecallDraft(id,draft))
  handle('session:saveLogDraft', (id, draft) => session.saveLogDraft(id, draft))
  handle('recall:get', (id) => {
    const r = deps.db.prepare('SELECT recall_text, to_review_text, review_marked, recall_rating, recall_rating_touched, recall_seconds FROM blocks WHERE id = ?').get(id) as {recall_text:string|null;to_review_text:string|null;review_marked:number;recall_rating:number|null;recall_rating_touched:number;recall_seconds:number|null}|undefined
    return !r || r.recall_seconds === null ? null : {recallText:r.recall_text ?? '',toReviewText:r.to_review_text ?? '',reviewMarked:r.review_marked === 1,recallRating:r.recall_rating as 1|2|3|4|5|null,recallRatingTouched:r.recall_rating_touched === 1,recallSeconds:r.recall_seconds}
  })
  const preparation=new PreparationGate()
  let quickPreparationSitting:number|null=null
  const publishPreparation=():void=>{deps.reminders.setPreparing(preparation.get()!==null);broadcast('preparation:changed',preparation.get())}
  const cancelPreparation=():void=>{preparation.cancel();deps.preparationPanel(false);publishPreparation()}
  handle('preparation:get',()=>preparation.get())
  handle('preparation:begin',(input,force)=>{
    const state=session.get()
    if(state.running||state.stage==='recall'||state.step==='log'||state.recovery)throw Error('Finish or leave the current study step first.')
    if(preparation.get())throw Error('Your preparation panel is already open.')
    const config=settings.getAll(),itemId=input?.itemId??config.lastItemId
    if(itemId===null)throw Error('Choose a subject first.')
    const item=library.getItem(itemId)
    if(item.archived)throw Error('Choose an active subject.')
    const mode=input?.timerMode??config.lastTimerMode??config.defaultTimerMode
    const plan=input??{itemId,timerMode:mode,targetSeconds:session.targetFor(itemId,mode)}
    if(!['flow','fixed','adaptive'].includes(plan.timerMode)||!Number.isFinite(plan.targetSeconds)||plan.targetSeconds<=0)throw Error('Choose a valid timer target.')
    if(config.studyExperience==='quick'||!config.preparationEnabled || !force && state.sitting?.id===quickPreparationSitting){session.start(plan);broadcast('settings:changed',settings.getAll());return}
    preparation.begin({input:plan,subject:item.name,tip:0,suggestions:[]})
    deps.preparationPanel(true);publishPreparation()
  })
  handle('preparation:confirm',(quickForSitting)=>{const result=preparation.commit(input=>session.start(input));quickPreparationSitting=quickForSitting?result.sitting?.id??null:null;deps.preparationPanel(false);publishPreparation();broadcast('settings:changed',settings.getAll());return result})
  handle('preparation:cancel',()=>{cancelPreparation();deps.showMain()})
  handle('session:start', (input) => {if(preparation.get())throw Error('Confirm or cancel preparation first.');return session.start(input)})
  handle('session:startLast', () => {if(preparation.get())throw Error('Confirm or cancel preparation first.');return session.startLast()})
  handle('session:distracted', () => session.distracted())
  handle('session:back', () => session.back())
  handle('session:toggleDistracted', () => session.toggleDistracted())
  handle('session:switch', (itemId) => {
    const r = session.switchTo(itemId)
    deps.switchClosed()
    return r
  })
  handle('session:wrapUp', (itemId) => session.wrapUp(itemId))
  handle('session:finish', () => session.finish())
  handle('session:quickAction', (destination,blockId)=>session.quickAction(destination,blockId))
  handle('session:discardFinished', () => session.discardFinished())
  handle('session:splitLast', (itemIds) => session.splitLast(itemIds))
  handle('session:completeRecall', () => session.completeRecall())
  handle('session:adjustSplit', (ids, boundaries) => session.adjustSplit(ids, boundaries))
  handle('stats:raw', () => deps.stats.raw())
  const saveAs = async (fileName: string, ext: 'md' | 'pdf' | 'png'): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const r = await dialog.showSaveDialog(win, {
      defaultPath: fileName,
      filters: [{ name: t(ext === 'md' ? 'Markdown' : ext === 'png' ? 'PNG image' : 'PDF'), extensions: [ext] }]
    })
    return r.canceled || !r.filePath ? null : r.filePath
  }
  handle('stats:exportMarkdown', async (markdown, fileName) => {
    const path = await saveAs(fileName, 'md')
    if (path) writeFileSync(path, markdown, 'utf8')
    return path
  })
  handle('stats:exportPng', async (html, fileName, width) => {
    const path = await saveAs(fileName, 'png')
    if (!path) return null
    writeFileSync(path, await renderReportPng(html, width))
    return path
  })
  handle('stats:exportPdf', async (html, fileName) => {
    const path = await saveAs(fileName, 'pdf')
    if (!path) return null
    // A hidden window renders the report page; Chromium prints it to PDF. Nothing is loaded from the network.
    if(html.length>10_000_000)throw Error('The report is too large to export.')
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox:true, nodeIntegration:false, contextIsolation:true, partition:'focusrecall-report' } })
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
    win.webContents.on('will-navigate',event=>event.preventDefault())
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(safeReportHtml(html)))
      const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 } })
      writeFileSync(path, pdf)
      return path
    } finally {
      win.destroy()
    }
  })

  handle('session:review', (ids) => {
    const sessionId = ids.length ? distractions.sessionOfBlock(ids[0]) : null
    const goal = sessionId !== null ? captures.goal(sessionId) : { goal: null, result: null }
    return {
      distractions: distractions.forBlocks(ids),
      programs: distractions.programs(ids),
      windowHistoryFrozen: distractions.windowHistoryFrozen(ids),
      marks: captures.marks(ids),
      goal: goal.goal,
      goalResult: goal.result,
      windowSwitches: sessionId !== null ? distractions.windowSwitches(sessionId) : 0
    }
  })
  handle('distraction:retime', (id, start, end) => {
    distractions.retime(id, Date.parse(start), Date.parse(end))
    distractionChanged(distractions.blockOf(id))
  })
  handle('distraction:add', (ids, start, end, kind) => {
    const id = distractions.addManual(ids, Date.parse(start), Date.parse(end), kind)
    distractionChanged(distractions.blockOf(id))
    return id
  })
  handle('distraction:alwaysIgnore', (id) => {
    const blockId = distractions.blockOf(id)
    distractions.alwaysIgnore(id)
    distractionChanged(blockId)
  })
  handle('session:moveSwitch', (left, right, at) => {
    sessions.transaction(()=>{sessions.moveSwitch(left, right, Date.parse(at));distractions.deriveAuto([left,right])})
    distractionChanged(left)
  })
  handle('session:setGoalResult', (sessionId, result) => captures.setGoalResult(sessionId, result))
  handle('session:longAbsence', (choice) => session.resolveLongAbsence(choice))
  handle('reasons:counts', () => distractions.reasonCounts())
  handle('capture:mark', (kind, note) => {
    session.mark(kind, note)
    broadcast('capture:marked', { kind })
    broadcast('distractions:changed', { blockId: session.get().running?.id ?? null })
  })
  handle('capture:open', (mode) => deps.openCapture(mode))
  handle('capture:close', () => deps.closeCapture())
  handle('popup:ready', (which) => deps.popupReady(which))
  handle('day:get', (day) => logs.day(day))
  handle('day:save', (day, values, notes, untouched) => logs.saveDay(day, values, notes, untouched))
  handle('day:skip', (day) => logs.skipDay(day))
  handle('distraction:label', (id, kind) => {
    distractions.setKind(id, kind)
    distractionChanged(distractions.blockOf(id))
  })
  handle('distraction:confirm', (id) => {
    distractions.confirm(id)
    distractionChanged(distractions.blockOf(id))
  })
  handle('distraction:delete', (id) => {
    const blockId = distractions.blockOf(id)
    distractions.delete(id)
    distractionChanged(blockId)
  })
  handle('rules:list', () => distractions.rules())
  handle('rules:save', (r) => {
    distractions.saveRule(r)
    rulesChanged()
    return distractions.rules()
  })
  /** A rule changed: detections everywhere are worked out again, and open screens refresh. */
  const rulesChanged = (): void => {
    distractions.rederiveAll()
    if (session.get().finished.length) session.touch()
    broadcast('distractions:changed', { blockId: null })
  }
  handle('rules:decide', (rules) => {
    const ids = rules.map((r) => distractions.saveRule(r))
    rulesChanged()
    return ids
  })
  handle('rules:rescope', (id, scope, ctx) => {
    const next = distractions.rescope(id, scope, ctx)
    rulesChanged()
    return next
  })
  handle('rules:delete', (id) => {
    distractions.deleteRule(id)
    rulesChanged()
    return distractions.rules()
  })
  handle('hotkeys:status', () => deps.hotkeyStatus())
  handle('tracking:deleteTitles', () => {
    // A running tracker or recovery view may retain buffered activity. Do not
    // interrupt a study workflow or allow it to write a title back after deletion.
    if(session.get().stage!=='idle'||session.get().recovery)throw Error('Finish or leave the current study workflow before deleting window titles.')
    deps.setSetting('foregroundTrackingTitlesEnabled',false)
    const result=distractions.deleteWindowTitles()
    broadcast('distractions:changed',{blockId:null})
    broadcast('study:changed',null)
    return result
  })
  handle('tracking:status', () => deps.trackingStatus())
  handle('session:finishWrapUp',(entries,destination)=>session.finishWrapUp(entries,destination))
  handle('session:submitLog', (entries) => session.submitLog(entries))
  handle('recall:save', (id, recall) => blocks.saveRecall(id, recall))
  handle('log:previous', (itemId, exclude) => logs.previous(itemId, exclude))
  handle('log:activityHistory', (itemId) => logs.activityHistory(itemId))
  handle('log:schema', () => logs.schema())
  const schemaChanged = <T>(r: T): T => {
    broadcast('log:schemaChanged', logs.schema())
    return r
  }
  handle('log:saveGroup', (g) => schemaChanged(logs.saveGroup(g)))
  handle('log:saveField', (f) => schemaChanged(logs.saveField(f)))
  handle('log:saveOptions', (id, options) => schemaChanged(logs.saveOptions(id, options)))
  handle('log:addOption', (id, label) => schemaChanged(logs.addOption(id, label)))
  handle('log:setArchived', (kind, id, archived) => schemaChanged(logs.setArchived(kind, id, archived)))
  handle('log:reorder', (kind, ids) => schemaChanged(logs.reorder(kind, ids)))
  handle('log:setupHistory', () => logs.setupHistory())

  handle('history:list', () => blocks.history())
  handle('history:updateBlock', (id, patch) => {
    session.assertHistoryMutationAllowed(distractions.sessionOfBlock(id))
    blocks.updateBlock(id, patch)
    distractionChanged(id)
  })
  handle('history:saveLog', (id, values, notes, untouched) => {
    session.assertHistoryMutationAllowed(distractions.sessionOfBlock(id))
    logs.saveValues(id, values, notes, untouched)
    session.touch()
  })
  handle('history:deleteBlock', (id) => {
    const sessionId = distractions.sessionOfBlock(id)
    session.assertHistoryMutationAllowed(sessionId)
    blocks.deleteBlock(id)
    if (sessionId !== null) distractions.refreshSessionStats(sessionId)
    session.touch()
  })
  handle('history:deleteSession', (id) => {session.assertHistoryMutationAllowed(id);blocks.deleteSession(id);session.touch()})
  handle('history:setToReviewDone', (id, done) => blocks.setToReviewDone(id, done))
  handle('session:finishStudying',()=>session.finishStudying())
  handle('session:endSitting', () => session.endSitting())
  handle('session:resolveRecovery', (choice) => session.resolveRecovery(choice))
  handle('rest:start', (seconds) => session.startRest(seconds))
  handle('rest:updatePlan', (seconds) => session.updateRestPlan(seconds))
  handle('rest:endEarly', () => session.endRestEarly())
  handle('rest:skip', () => session.skipRest())
  handle('rest:finish', (activity) => session.finishRest(activity))
  handle('rest:startNextBlock', () => session.startNextFromRest())

  handle('window:showMain', () => deps.showMain())
  handle('panel:focus', () => deps.focusPanel())
  handle('panel:toggle', () => deps.togglePanel())
  handle('panel:close', () => {cancelPreparation();deps.closePanel()})
  handle('panel:hover', (over) => deps.panelHover(over))
  handle('ui:openSwitch', () => deps.openSwitch())
  handle('ui:switchClosed', () => deps.switchClosed())
  handle('reasons:hide', () => deps.hideReasons())
  handle('app:demo', () => deps.demo.active)
  handle('app:setDemo', (on) => deps.demo.set(on))
}
