import { SettingLabelContext, useSettingLabel } from '../components/settingLabel'
import { StudyExperience } from '../components/StudyExperience'
import { t as uiText } from '../i18n'
import { LanguageSettings } from '../components/LanguageSettings'
import { AdviceSettings } from '../components/AdviceSettings'
import { RestMusicControls } from '../components/RestMusic'
import { confirmAction } from '../components/appDialogs'
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { normalizeStages, type StageStep } from '@core/learning'
import { checkLink } from '@core/links'
import { LinkStatus } from '../components/LinkStatus'
import { LINE_PALETTES, UI_SCALE_RANGE, paletteFor, themeTokensFor, type PanelSize } from '@core/appearance'
import type { Weekday } from '@core/studyDay'
import { playChime } from '../sound'
import { useUi } from '../store/ui'
import { useLogSchema } from '../store/logSchema'
import { LogQuestions } from './LogQuestions'
import { AutomaticTrackingCard, DistractionSettings } from './DistractionSettings'
import { STARTER_GUIDE_EVENT } from '../components/StarterGuide'
import { LengthChips, ModeControl } from '../components/TimerControls'
import { NumberStepper, TimeInput } from '../components/NumberInputs'
import { useAppearance } from '../store/appearance'
import { useSettings } from '../store/session'
import { Button, Segmented, inputBase } from '../components/ui'
import { NotesSettings } from '../components/NotesSettings'
import { FontSettings, PresetSettings, ShapeSettings, usePresetCount } from '../components/AppearanceEditor'
import { AdvancedRow, CustomSurfacesRow, PanelPreview, SidebarChoices, StageColourEditor, ThemeGallery, ThemeModeCards, ThemeUndoToast } from '../components/AppearanceSettings'
import { TimelineColours } from '../components/TimelineColours'
import { SettingsGuide, SettingIcon } from '../components/SettingsGuide'
import { RestExample } from '../components/SettingsExamples'
import { BackupSettings } from '../components/BackupSettings'
import { StudyReminderSettings } from '../components/StudyReminderSettings'
import { AboutFocusRecall } from '../components/AboutFocusRecall'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Page = 'general' | 'log' | 'appearance' | 'about'

/** Search across every setting: what is typed, the page a row is on, and how to go to a result. */
const SearchContext = createContext<{ query: string; page: Page; pick: (id: string, page: Page) => void }>({ query: '', page: 'general', pick: () => {} })

/** Extra words a setting is found by, beyond its name and description. */
const KEYWORDS: Record<string, string> = {
  'Rest playlist': 'spotify music playlist song audio rest music',
  'Play and pause the music by itself': 'spotify music media key play pause',
  Chime: 'sound audio bell notification alert',
  Volume: 'sound audio loud quiet chime',
  'Default focus target': 'length minutes pomodoro 25 flow target time',
  'Fixed countdown': 'length minutes countdown fixed time',
  'Default timer mode': 'flow fixed adaptive mode timer',
  'Show the floating panel when a session starts': 'panel window mini timer always on top',
  'Timer display': 'floating panel digital circular countdown ring clock',
  'Minimise FocusRecall when a session starts': 'minimize hide window',
  'Study setup starts from': 'place posture setup remembered',
  'End a sitting automatically': 'auto end sitting hours',
  'A study day starts at': 'midnight day boundary 4 04:00 night',
  'Weeks start on': 'saturday sunday monday week calendar',
  'Distracted / Back hotkey': 'keyboard shortcut key f8 f9 pause',
  'Switch hotkey': 'keyboard shortcut key f10 subject',
  'Stuck hotkey': 'keyboard shortcut key marker review',
  'Resisted hotkey': 'keyboard shortcut key win',
  'Automatic tracking': 'window app program browser detection detect website',
  'Long absence after': 'away break minutes end session',
  'Light or dark': 'theme dark mode night light colour color',
  'High contrast': 'accessibility contrast readable',
  'Expanded sidebar width': 'sidebar navigation wide narrow',
  'Interface size': 'zoom scale bigger smaller text font size',
  'Writing text size': 'font recall writing size',
  Size: 'panel floating small medium large',
  Opacity: 'panel transparent see-through floating'
}

const matches = (q: string, ...texts: (string | undefined)[]): boolean => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hay = texts.filter(Boolean).flatMap(text => [text, uiText(text!)]).join(' ').toLocaleLowerCase()
  return words.every((w) => hay.includes(w))
}

const slug = (label: string): string => 'setting-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function SettingsTab(): React.JSX.Element {
  const [page, setPage] = useState<Page>(useUi.getState().settingsPage)
  const schema=useLogSchema(s=>s.schema)
  useEffect(()=>{useUi.setState({settingsPage:page})},[page])
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const pick = (id: string, p: Page): void => {
    setQuery('')
    setPage(p)
    // After the page is shown: scroll to the setting and highlight it briefly.
    setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) return
      const detail = el.closest('details') ?? el.querySelector(':scope > details')
      if (detail) detail.open = true
      el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      el.classList.add('setting-highlight')
      setTimeout(() => el.classList.remove('setting-highlight'), 1800)
    }, 60)
  }
  return (
    <div className="settings-surface h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-7 lg:px-10 lg:py-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">{uiText("Settings")}</h1>
          <input
            type="search"
            dir="auto"
            aria-label={uiText("Search settings")}
            placeholder={uiText("Search settings (for example: music, hotkey, panel)")}
            className={`${inputBase} min-w-72 flex-1`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          />

        </div>
        {!searching && <SettingsGuide page={page} onChange={setPage} onJump={pick}/>}
        {searching ? (
          <div className="flex flex-col gap-8">
            {matches(query,'about FocusRecall creator why privacy local data donation donate support ko-fi feedback')&&<AboutFocusRecall/>}

            {schema.fields.some(f=>!f.archived&&matches(query,f.label,f.key??'',f.options.map(o=>o.label).join(' '),'log question answers'))&&<section className="rounded-2xl border border-line bg-surface p-5"><h2 className="text-lg font-semibold">{uiText("Log questions")}</h2><div className="mt-3 flex flex-wrap gap-2">{schema.fields.filter(f=>!f.archived&&schema.groups.some(g=>g.id===f.groupId&&!g.archived)&&matches(query,f.label,f.key??'',f.options.map(o=>o.label).join(' '),'log question answers')).map(f=><Button key={f.id} onClick={()=>pick('log-question-'+f.id,'log')}>{f.label}</Button>)}</div></section>}
            <SearchContext.Provider value={{ query, page: 'general', pick }}>
              <GeneralPage />
            </SearchContext.Provider>
            <SearchContext.Provider value={{ query, page: 'appearance', pick }}>
              <AppearancePage />
            </SearchContext.Provider>

          </div>
        ) : (
          <SearchContext.Provider value={{ query: '', page, pick }}>
            <div key={page} id="settings-page-content" role="region" aria-labelledby={`settings-page-${page}`} className="tf-fade-in flex flex-col gap-8">{page === 'general' ? <GeneralPage /> : page === 'log' ? <LogQuestions /> : page === 'about' ? <AboutFocusRecall/> : <AppearancePage />}</div>
          </SearchContext.Provider>
        )}
      </div>
    </div>
  )
}

// --- General -----------------------------------------------------------------

function GeneralPage(): React.JSX.Element {
  const { settings, set } = useSettings()
  return (
    <>
      <nav aria-label={uiText('General settings sections')} className="flex flex-wrap gap-2">{['Study experience','Home','Automatic tracking','Focus','Sound'].map(label=><Button key={label} size="sm" variant="quiet" onClick={()=>{const target=document.getElementById(label==='Study experience'?slug(label):'general-'+slug(label));target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true})}}>{uiText(label)} →</Button>)}</nav>
      <SettingGroup label="Language" keywords="language العربية Español Français 简体中文 Português Deutsch English"><LanguageSettings /></SettingGroup>
      <SettingGroup label="Study experience" keywords="quick full minimal timer workflow"><StudyExperience/>        {settings.studyExperience==='full'&&<Row label="Quick preparation before studying" hint={uiText("Optional checklist before the timer starts.")}>
          <Toggle label={uiText('Quick preparation before studying')} checked={settings.preparationEnabled} onChange={v=>set('preparationEnabled',v)}/>
        </Row>}</SettingGroup>
      <SettingGroup label="Study suggestions" keywords="advice tips reset topics history"><AdviceSettings/></SettingGroup>
      <Section title="Home"><Row label="Show Today Check" hint={uiText('Show the optional daily check-in on Home. Skipping hides it until local midnight.')}><Toggle label={uiText('Show Today Check')} checked={settings.showTodayCheck} onChange={v=>void set('showTodayCheck',v)}/></Row></Section>
      <Section title="Getting started"><SettingGroup label="Starter guide" keywords="welcome help first use basics tutorial"><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-muted">{uiText("A quick tour of studying, review, tracking and insights.")}</p><Button onClick={()=>window.dispatchEvent(new Event(STARTER_GUIDE_EVENT))}>{uiText("Open starter guide")}</Button></div></SettingGroup></Section>
      <Section title="Automatic tracking"><SettingGroup label="Automatic tracking" keywords="privacy apps windows titles foreground distraction"><AutomaticTrackingCard/></SettingGroup></Section>
      <Section title="Focus">
        <p className="px-6 py-4 text-sm text-muted">{uiText("Screen locking also interrupts tracking, even if you continue studying on paper. Resume when you return; locked time is not credited as Focus.")}</p>
        <Row label="Default focus target" hint={uiText("Flow counts up toward this, then keeps going.")}>
          <LengthChips label={uiText("Default focus target")} value={settings.focusTargetMinutes} onChange={(v) => set('focusTargetMinutes', v)} />
        </Row>
        <Row label="Fixed countdown" hint={uiText("Fixed counts down from this, then shows the overtime.")}>
          <LengthChips label={uiText("Fixed countdown")} value={settings.fixedMinutes} onChange={(v) => set('fixedMinutes', v)} />
        </Row>
        <Row label="Default timer mode" hint={uiText("Used until you pick another mode on Home.")}>
          <div className="w-96">
            <ModeControl value={settings.defaultTimerMode} onChange={(m) => set('defaultTimerMode', m)} />
          </div>
        </Row>

        <Row label="Show the floating panel when a session starts" hint={uiText("An always-on-top timer with controls.")}>
          <Toggle checked={settings.panelAutoShow} onChange={(v) => set('panelAutoShow', v)} />
        </Row>
        <Row label="Minimise FocusRecall when a session starts" hint={uiText("It comes back by itself when the session ends.")}>
          <Toggle checked={settings.minimizeOnStart} onChange={(v) => set('minimizeOnStart', v)} />
        </Row>
        <Row label="Study setup starts from" hint={uiText("What the log fills in for place, device, sound and the rest.")}>
          <Segmented<'last' | 'most'>
            value={settings.setupDefaultMode}
            onChange={(v) => set('setupDefaultMode', v)}
            options={[
              { value: 'last', label: 'Last used' },
              { value: 'most', label: 'Most used' }
            ]}
          />
        </Row>
      </Section>

      <StudyReminderSettings Section={Section} Row={Row}/>
      <Section title="Notes"><SettingGroup label="Obsidian notes" keywords="obsidian vault file destination"><NotesSettings/></SettingGroup></Section>

      <DistractionSettings Section={Section} Row={Row} />

      <Section title="Sittings">
        <Row label="End a sitting automatically" hint={uiText("After this long with no session. 0 turns it off.")}>
          <NumberField value={settings.sittingAutoEndHours} min={0} max={24} step={0.5} unit="h" onCommit={(v) => set('sittingAutoEndHours', v)} />
        </Row>
      </Section>

      <Section title="Days and weeks">
        <Row label="A study day starts at" hint={uiText("Work before this time counts on the previous day.")}>
          <input
            type="time"
            aria-label={uiText("A study day starts at")}
            className={`${inputBase} w-36`}
            value={settings.dayStart}
            onChange={(e) => e.target.value && set('dayStart', e.target.value)}
          />
        </Row>
        <Row label="Weeks start on">
          <select aria-label={uiText("Weeks start on")} className={`${inputBase} w-44`} value={settings.weekStartsOn} onChange={(e) => set('weekStartsOn', Number(e.target.value) as Weekday)}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {uiText(d)}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Learning stages">
        <Row
          label="Stages by hours on a subject"
          hint={uiText("Tracked focus + prior study hours.")}
          keywords="first 20 hours stage threshold learning beginner"
        >
          <StagesEditor value={settings.learningStages} onChange={(v) => set('learningStages', v)} />
        </Row>
      </Section>

      <RestSection />

      <DataSection />

      <Section title="Sound">
        <Row label="Chime" hint={uiText("One soft chime when the target is reached.")}>
          <Toggle checked={settings.soundsEnabled} onChange={(v) => set('soundsEnabled', v)} />
        </Row>
        <Row label="Volume">
          <div className="flex items-center gap-4">
            <input
              type="range"
              aria-label={uiText("Volume")}
              min={0}
              max={1}
              step={0.05}
              value={settings.soundVolume}
              disabled={!settings.soundsEnabled}
              onChange={(e) => set('soundVolume', Number(e.target.value))}
              className="w-48 accent-[var(--tf-focus)]"
            />
            <Button variant="quiet" size="sm" disabled={!settings.soundsEnabled} onClick={playChime}>{uiText("Test")}</Button>
          </div>
        </Row>
      </Section>
    </>
  )
}

function RestSection(): React.JSX.Element {
  const { settings, set } = useSettings()
  const r = settings.restRules
  const [playlist, setPlaylist] = useState(settings.restPlaylist)
  const [newSuggestion, setNewSuggestion] = useState('')
  const valid = checkLink(playlist, 'spotify').ok
  const rule = (k: keyof typeof r) => (v: number) => set('restRules', { ...r, [k]: v,
    ...(k==='minMinutes'&&v>r.maxMinutes?{maxMinutes:v}:{}),
    ...(k==='maxMinutes'&&v<r.minMinutes?{minMinutes:v}:{}) })
  return (
    <Section title="Rest">
      <SettingExample><RestExample/></SettingExample>
      <Row label="Rest per 5 minutes of focus" hint={uiText("Counted since the last rest in the sitting.")}>
        <NumberField value={r.minutesPerFive} min={0.5} max={5} step={0.5} unit="min" onCommit={rule('minutesPerFive')} />
      </Row>
      <Row label="Shortest and longest rest">
        <div className="flex items-center gap-3">
          <NumberField label="Shortest rest" value={r.minMinutes} min={1} max={60} step={1} unit="min" onCommit={rule('minMinutes')} />
          <span className="text-muted">{uiText("to")}</span>
          <NumberField label="Longest rest" value={r.maxMinutes} min={1} max={90} step={1} unit="min" onCommit={rule('maxMinutes')} />
        </div>
      </Row>
      <Row label="Long rest" hint={uiText("Every n-th rest in a sitting, and how long it is.")}>
        <div className="flex items-center gap-3">
          <span className="text-muted">{uiText("every")}</span>
          <NumberField label="Rests before long rest" value={r.longEvery} min={0} max={12} step={1} unit="" onCommit={rule('longEvery')} />
          <NumberField label="Long rest duration" value={r.longMinutes} min={5} max={90} step={1} unit="min" onCommit={rule('longMinutes')} />
        </div>
      </Row>
      <Row label="Rest playlist" hint={uiText("Spotify playlist link.")}>
        <div className="flex flex-col items-end gap-1.5">
          <input
            className={`${inputBase} w-96 ${valid ? '' : 'border-overtime'}`}
            aria-label={uiText("Rest playlist")}
            placeholder={uiText("https://open.spotify.com/playlist/…")}
            value={playlist}
            onChange={(e) => {
              setPlaylist(e.target.value)
              // A pasted, recognised link saves at once.
              if (checkLink(e.target.value, 'spotify').ok) void set('restPlaylist', e.target.value.trim())
            }}
            onBlur={() => valid && set('restPlaylist', playlist.trim())}
          />
          <LinkStatus value={playlist} kind="spotify" />
        </div>
      </Row>
      <Row label="Play and pause the music by itself" hint={uiText("Requests Play in Spotify when rest starts. Pauses at the end only if FocusRecall started playback. Requires an available Spotify Windows media session.")}>
        <Toggle checked={settings.restMusicAutoPlay} onChange={(v) => set('restMusicAutoPlay', v)} />
      </Row>
      <div className="px-6 py-4"><RestMusicControls /></div>
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="text-base font-medium">{uiText("Rest suggestions")}</div>
        <div className="flex flex-wrap gap-2">
          {settings.restSuggestions.map((sug) => (
            <span key={sug} className="flex items-center gap-1 rounded-full border border-line py-1 pr-1 pl-4 text-base">
              {sug}
              <button
                type="button"
                aria-label={uiText("Remove {value0}", {value0: (sug)})}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => set('restSuggestions', settings.restSuggestions.filter((x) => x !== sug))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const t = newSuggestion.trim()
            if (t && !settings.restSuggestions.includes(t)) void set('restSuggestions', [...settings.restSuggestions, t])
            setNewSuggestion('')
          }}
        >
          <input dir="auto" className={`${inputBase} flex-1`} aria-label={uiText("Add a suggestion")} placeholder={uiText("Add a suggestion")} value={newSuggestion} onChange={(e) => setNewSuggestion(e.target.value)} />
          <Button variant="quiet" type="submit">{uiText("Add")}</Button>
        </form>
      </div>
    </Section>
  )
}

function DataSection(): React.JSX.Element {
  const [demo, setDemo] = useState<boolean | null>(null)
  useEffect(() => {
    void window.api.invoke('app:demo').then(setDemo)
  }, [])
  const switchTo = async (on: boolean): Promise<void> => {
    const msg = on
      ? uiText('Open demo data? FocusRecall restarts on a separate demo database with a few weeks of made-up study. Your own data is not touched.')
      : uiText('Go back to your own data? FocusRecall restarts on your database.')
    if (await confirmAction(msg,on?'Open demo':'Open my data','Switch data?')) void window.api.invoke('app:setDemo', on)
  }
  return (
    <Section title="Data">
      <SettingGroup label="Backup and restore" keywords="back up snapshot restore recovery database"><BackupSettings/></SettingGroup>
      <Row
        label={demo ? 'You are looking at demo data' : 'Demo data'}
        hint={demo ? uiText("Nothing you do here reaches your own data.") : uiText("A separate database with weeks of sample study, to explore every screen.")}
      >
        {demo === null ? null : demo ? (
          <Button variant="primary" onClick={() => switchTo(false)}>{uiText("Back to my data")}</Button>
        ) : (
          <Button variant="quiet" onClick={() => switchTo(true)}>{uiText("Open demo data")}</Button>
        )}
      </Row>
    </Section>
  )
}

// --- Appearance --------------------------------------------------------------

function AppearancePage(): React.JSX.Element {
  const { appearance: a, update, resolved } = useAppearance()
  const { query } = useContext(SearchContext)
  const stages = themeTokensFor(a, resolved), line = paletteFor(a, resolved === 'dark').line
  const presetCount = usePresetCount()
  const customStages = Object.keys(a.stageOverrides[resolved]).length > 0
  const shapeName = a.roundness === 0 ? 'Straight' : a.roundness <= 0.5 ? 'Subtle' : a.roundness <= 1 ? 'Rounded' : 'Soft'
  const lineName = a.linePalette === 'custom' ? 'Custom' : LINE_PALETTES.find(p => p.id === a.linePalette)?.name ?? 'Calm'

  return (
    <>
      {!query.trim() && <AppearanceJumps />}
      <Section title="Theme" anchor="appearance-theme" plain lead="Choose Light, Dark or Follow Windows, then pick a theme. Light and dark themes are saved separately.">
        <SettingGroup label="Light or dark" keywords="theme mode dark light night follow windows system" flush><ThemeModeCards /></SettingGroup>
        <SettingGroup label="Colour theme" keywords="theme colour color palette light dark ivory ink library espresso pewter graphite night" flush><ThemeGallery /></SettingGroup>
        <div className="rounded-2xl border border-line bg-surface">
          <Row label="High contrast" hint={uiText("Stronger text and edges, on top of either theme.")}>
            <div className="flex justify-end"><Toggle label={uiText("High contrast")} checked={a.highContrast} onChange={(highContrast) => update({ highContrast })} /></div>
          </Row>
        </div>
      </Section>

      <Section title="Sidebar" anchor="appearance-sidebar" lead="How the navigation looks beside your work.">
        <SettingGroup label="Sidebar design" keywords="sidebar navigation journal simple icon rail compact colour opposite brand ink"><SidebarChoices /></SettingGroup>
        {!a.sidebarCollapsed && <Row label="Expanded sidebar width"><div className="flex items-center gap-3"><input aria-label={uiText("Expanded sidebar width")} type="range" min={184} max={280} step={8} value={a.sidebarWidth} className="w-48 accent-[var(--tf-focus)]" onChange={e=>void update({sidebarWidth:Number(e.target.value)})}/><span className="w-14 text-sm tabular-nums">{a.sidebarWidth}{uiText("px")}</span></div></Row>}
      </Section>

      <Section title="Text & size" anchor="appearance-text">
        <Row label="Interface size" hint={uiText("The main window. The floating panel has its own size below.")}>
          <ScaleSlider value={a.uiScale} onCommit={(uiScale) => update({ uiScale })} />
        </Row>
        <Row label="Writing text size" hint={uiText("Recall box and other writing areas.")}>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={14}
              max={28}
              step={1}
              value={a.writingSize}
              aria-label={uiText("Writing text size")}
              onChange={(e) => update({ writingSize: Number(e.target.value) })}
              className="w-48 accent-[var(--tf-focus)]"
            />
            <span className="w-14 text-end text-base tabular-nums">{a.writingSize}{uiText("px")}</span>
          </div>
        </Row>
        <div className="px-6 pb-5">
          <p dir="auto" className="rounded-xl border border-line bg-writing px-5 py-4 font-writing leading-relaxed text-writing-ink" style={{ fontSize: 'var(--tf-writing-size)' }}>{uiText("Eigenvalues keep their direction. القيم الذاتية تحافظ على الاتجاه.")}</p>
        </div>
      </Section>

      <Section title="Floating panel" anchor="appearance-panel">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="divide-y divide-line">
            <Row label="Timer display" hint={uiText("Circular shows time remaining to the target, then overtime.")}>
              <Segmented value={a.panelTimerDisplay} onChange={(panelTimerDisplay) => update({ panelTimerDisplay })}
                options={[{ value: 'digital', label: 'Digital' }, { value: 'circular', label: 'Circular' }]} />
            </Row>
            <Row label="Size" hint={uiText("Floating panel size.")}>
              <Segmented<PanelSize>
                value={a.panelSize}
                onChange={(panelSize) => update({ panelSize })}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' }
                ]}
              />
            </Row>
            <Row label="Opacity" hint={uiText("See-through when you are not pointing at it.")}>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0.3}
                  max={1}
                  step={0.05}
                  value={a.panelOpacity}
                  aria-label={uiText("Opacity")}
                  onChange={(e) => update({ panelOpacity: Number(e.target.value) })}
                  className="w-48 accent-[var(--tf-focus)]"
                />
                <span className="w-14 text-end text-base tabular-nums">{Math.round(a.panelOpacity * 100)}%</span>
              </div>
            </Row>
          </div>
          {!query.trim() && <div className="p-4 lg:border-s lg:border-line"><PanelPreview /></div>}
        </div>
      </Section>

      <Section title="Advanced" anchor="appearance-advanced" lead="Optional. Every change is checked for readable contrast.">
        <SettingGroup label="Stage colours" keywords="custom colour color focus recall rest overtime accent hex buttons" flush>
          <AdvancedRow title="Stage colours" summary={uiText(customStages ? "Customised" : "From the theme")} swatches={(['focus', 'recall', 'rest', 'overtime'] as const).map(k => stages[`stage.${k}`])}><StageColourEditor /></AdvancedRow>
        </SettingGroup>
        <SettingGroup label="Timeline colours" keywords="palette colour color blind pastel classic calm distracted detected idle hex" flush>
          <AdvancedRow title="Timeline colours" summary={uiText(lineName)} swatches={[line.focus ?? stages['stage.focus'], line.distracted, line.detected, line.idle]}><TimelineColours /></AdvancedRow>
        </SettingGroup>
        <SettingGroup label="Fonts" keywords="font typeface segoe timer writing interface" flush>
          <AdvancedRow title="Fonts" summary={a.fontUi.split(',')[0].replace(/"/g, '')}><FontSettings /></AdvancedRow>
        </SettingGroup>
        <SettingGroup label="Corners and spacing" keywords="shape roundness rounded straight corners spacing density compact" flush>
          <AdvancedRow title="Corners and spacing" summary={`${uiText(shapeName)} · ${uiText(a.density === 'compact' ? 'Compact' : 'Comfortable')}`}><ShapeSettings /></AdvancedRow>
        </SettingGroup>
        <SettingGroup label="Saved setups" keywords="presets import export json reset appearance" flush>
          <AdvancedRow title="Saved setups" summary={uiText("{count} saved", { count: presetCount })}><PresetSettings /></AdvancedRow>
        </SettingGroup>
        <CustomSurfacesRow />
      </Section>
      <ThemeUndoToast />
    </>
  )
}

const APPEARANCE_JUMPS = [
  { id: 'appearance-theme', label: 'Theme' }, { id: 'appearance-sidebar', label: 'Sidebar' }, { id: 'appearance-text', label: 'Text & size' },
  { id: 'appearance-panel', label: 'Floating panel' }, { id: 'appearance-advanced', label: 'Advanced' }
]

/** Scroll anchors for the Appearance sections; the chip of the section in view is highlighted. */
function AppearanceJumps(): React.JSX.Element {
  const [current, setCurrent] = useState(APPEARANCE_JUMPS[0].id)
  useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting)
      const first = APPEARANCE_JUMPS.find(j => seen.get(j.id))
      if (first) setCurrent(first.id)
    }, { rootMargin: '0px 0px -60% 0px' })
    for (const j of APPEARANCE_JUMPS) { const el = document.getElementById(j.id); if (el) observer.observe(el) }
    return () => observer.disconnect()
  }, [])
  return <nav aria-label={uiText("Appearance sections")} className="-mb-3 flex flex-wrap gap-2">
    {APPEARANCE_JUMPS.map(j => <button key={j.id} type="button" aria-current={current === j.id ? 'true' : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${current === j.id ? 'border-line bg-control font-semibold text-ink' : 'border-line text-muted hover:text-ink'}`}
      onClick={() => document.getElementById(j.id)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{uiText(j.label)}</button>)}
  </nav>
}

/**
 * The interface scale changes the window zoom, which moves the slider under
 * the pointer, so it applies on release (or on keyboard change).
 */
function ScaleSlider({ value, onCommit }: { value: number; onCommit: (v: number) => void }): React.JSX.Element {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = (): void => {
    if (v !== value) onCommit(v)
  }
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={UI_SCALE_RANGE.min}
        max={UI_SCALE_RANGE.max}
        step={0.05}
        value={v}
        aria-label={uiText("Interface size")}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-48 accent-[var(--tf-focus)]"
      />
      <span className="w-14 text-right text-base tabular-nums">{Math.round(v * 100)}%</span>
      {value !== 1 && (
        <Button variant="ghost" size="sm" onClick={() => onCommit(1)}>{uiText("Reset")}</Button>
      )}
    </div>
  )
}

// --- Building blocks ---------------------------------------------------------

function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onCommit
}: {
  label?: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onCommit: (v: number) => void
}): React.JSX.Element {
  const name = useSettingLabel(label)
  // Whole minutes are lengths (the colon comes by itself); everything else is a plain number with steppers.
  return (
    <div className="flex items-center gap-3">
      {unit === 'min' && Number.isInteger(step) ? (
        <TimeInput label={name} value={value} min={min} max={max} onChange={(v) => v !== null && onCommit(v)} className="w-24" />
      ) : (
        <NumberStepper label={name} value={value} min={min} max={max} step={step} onChange={(v) => v !== null && onCommit(v)} className="w-20" />
      )}
      <span className="w-8 text-base text-muted">{unit}</span>
    </div>
  )
}

/** While searching, a section whose title matches shows all its settings. */
const SectionMatch = createContext(false)

function SettingExample({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const { query } = useContext(SearchContext)
  return query.trim() ? null : <>{children}</>
}

function Section({ title, children, advanced = false, plain = false, lead, anchor }: { title: string; children: React.ReactNode; advanced?: boolean; plain?: boolean; lead?: string; anchor?: string }): React.JSX.Element {
  const { query } = useContext(SearchContext)
  const searching = query.trim().length > 0
  const titleMatch = searching && matches(query, title)
  const content = (
    <section
      id={anchor??("general-"+slug(title))} tabIndex={-1}
      className={`flex scroll-mt-4 flex-col gap-3 ${searching && !titleMatch ? '[&:not(:has([data-row]))]:hidden' : ''}`}
    >
      {!advanced && <h2 className="flex items-center gap-3 text-lg font-semibold"><SettingIcon title={title}/>{uiText(title)}</h2>}
      {lead && !searching && <p className="-mt-1 text-sm text-muted">{uiText(lead)}</p>}
      <div
        className={`${plain ? 'flex flex-col gap-4' : 'divide-y divide-line rounded-2xl border border-line bg-surface'} ${searching && !titleMatch ? '[&>*:not([data-row])]:hidden' : ''}`}
      >
        <SectionMatch.Provider value={titleMatch}>{children}</SectionMatch.Provider>
      </div>
    </section>
  )
  if (!advanced) return content
  return <details open={searching ? true : undefined} className={`rounded-2xl border border-line bg-surface p-5 ${searching&&!titleMatch?'[&:not(:has([data-row]))]:hidden':''}`}><summary className="cursor-pointer text-lg font-semibold">{uiText(title)} <span className="ml-2 text-sm font-normal text-muted">{uiText("Advanced colours, fonts & shapes")}</span></summary><div className="mt-5">{content}</div></details>
}

/**
 * One setting. It is found by the search through its name, description and
 * keywords. After a change it shows a small "Saved" tick (or the error) for a
 * moment: the row listens for the save to come back from main.
 */
function SettingGroup({ label, keywords, children, flush = false }: { label: string; keywords: string; children: React.ReactNode; flush?: boolean }): React.JSX.Element | null {
  const { query, page, pick } = useContext(SearchContext)
  const sectionMatch = useContext(SectionMatch)
  const searching = query.trim().length > 0
  if (searching && !sectionMatch && !matches(query, label, keywords)) return null
  const id = slug(label)
  return (
    <div id={id} tabIndex={-1} data-row className={flush && !searching ? '' : 'p-6'}>
      {searching ? (
        <button type="button" className="w-full text-left text-base font-medium hover:text-focus" onClick={() => pick(id, page)}>{uiText(label)}</button>
      ) : children}
    </div>
  )
}

function Row({ label, hint, keywords, children }: { label: string; hint?: string; keywords?: string; children: React.ReactNode }): React.JSX.Element | null {
  const { query, page, pick } = useContext(SearchContext)
  const sectionMatch = useContext(SectionMatch)
  const status = useSaveStatus()
  const labelId = useId(), hintId = useId()
  const searching = query.trim().length > 0
  const id = slug(label)
  if (searching && !sectionMatch && !matches(query, label, hint, keywords, KEYWORDS[label])) return null
  return (
    <div
      id={id}
      data-row
      role="group" aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined}
      onChangeCapture={status.arm}
      onClickCapture={status.arm}
      onKeyDownCapture={status.arm}
      className={`relative grid min-h-18 grid-cols-1 items-start gap-4 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] transition-colors ${searching ? 'cursor-pointer hover:bg-surface-2/50' : ''}`}
      onClick={searching ? () => pick(id, page) : undefined}
    >
      <div className="min-w-0">
        <div id={labelId} className="text-base font-medium">{uiText(label)}</div>
        {hint && <div id={hintId} className="mt-0.5 text-sm text-muted">{uiText(hint)}</div>}
      {status.shown && (
        <span className={`text-sm whitespace-nowrap ${status.error ? 'text-status-error' : 'text-stage-rest-text'}`} role="status">
          {status.error ? status.error : uiText("✓ Saved")}
        </span>
      )}
      </div>
      <SettingLabelContext.Provider value={uiText(label)}><div className={`setting-controls min-w-0 ${searching ? 'pointer-events-none' : ''}`}>{children}</div></SettingLabelContext.Provider>
    </div>
  )
}

/**
 * "Saved" after a change: armed by an edit in the row, shown when main sends
 * the updated settings back (or the error if saving failed).
 */
function useSaveStatus(): { arm: () => void; shown: boolean; error: string | null } {
  const armed = useRef(0)
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const show = (err: string | null): void => {
      if (Date.now() - armed.current > 2500) return
      armed.current = 0
      setError(err)
      setShown(true)
      clearTimeout(timer)
      timer = setTimeout(() => setShown(false), err ? 4000 : 1600)
    }
    const offs = [
      window.api.on('settings:changed', () => show(null)),
      window.api.on('appearance:changed', () => show(null)),
      window.api.on('hotkeys:changed', () => show(null))
    ]
    const onError = (e: Event): void => show((e as CustomEvent<string>).detail)
    window.addEventListener('tf-save-error', onError)
    return () => {
      offs.forEach((off) => off())
      window.removeEventListener('tf-save-error', onError)
      clearTimeout(timer)
    }
  }, [])
  return { arm: () => (armed.current = Date.now()), shown, error }
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?:string }): React.JSX.Element {
  const name = useSettingLabel(label)
  return (
    <button
      type="button"
      role="switch"
      aria-label={name}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-focus' : 'bg-surface-2 ring-1 ring-line'}`}
    >
      <span className={`absolute top-1 left-1 size-6 rounded-full shadow transition-transform ${checked ? 'translate-x-6 bg-on-accent' : 'bg-muted'}`} />
    </button>
  )
}

/** Edit stage names and the hour each one ends at; the last stage never ends. */
function StagesEditor({ value, onChange }: { value: StageStep[]; onChange: (v: StageStep[]) => void }): React.JSX.Element {
  const [draft, setDraft] = useState(() => normalizeStages(value))
  useEffect(() => setDraft(normalizeStages(value)), [value])
  const commit = (next: StageStep[]): void => {
    setDraft(next)
    onChange(normalizeStages(next))
  }
  return (
    <div className="flex w-[30rem] flex-col gap-2">
      {draft.map((st, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            dir="auto"
            aria-label={uiText("Name of stage {value0}", {value0: (i + 1)})}
            className={`${inputBase} min-w-0 flex-1`}
            value={st.name}
            onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            onBlur={() => st.name.trim() && commit(draft)}
          />
          {st.untilHours !== null ? (
            <>
              <span className="text-sm text-muted">{uiText("until")}</span>
              <NumberStepper
                value={st.untilHours}
                onChange={(v) => v !== null && v > 0 && commit(draft.map((x, j) => (j === i ? { ...x, untilHours: v } : x)))}
                label={uiText("Hours where stage {value0} ends", {value0:i + 1})}
                className="w-20"
              />
              <span className="w-4 text-sm text-muted">h</span>
              <button
                type="button"
                aria-label={uiText("Remove {value0}", {value0: (st.name)})}
                className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => draft.length > 2 && commit(draft.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </>
          ) : (
            <span className="w-44 text-sm text-muted">{uiText("and on")}</span>
          )}
        </div>
      ))}
      <button
        type="button"
        className="self-start text-base text-muted hover:text-ink"
        onClick={() => {
          const last = draft.filter((x) => x.untilHours !== null).at(-1)?.untilHours ?? 0
          const until = last ? last * 2 : 20
          commit([...draft.slice(0, -1), { untilHours: until, name: `${last} to ${until} hours` }, draft[draft.length - 1]])
        }}
      >{uiText("+ Add a stage")}</button>
    </div>
  )
}
