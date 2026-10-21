import { trackingConsented, TRACKING_DISCLOSURE, TITLE_DISCLOSURE, TRACKING_RECONFIRM } from '@core/trackingConsent'
import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import type { HotkeyStatus, TrackingStatus } from '@core/api'
import type { CaptureSettings } from '@core/captures'
import { confirmBrowserRules } from '../components/SessionReview'
import { NumberStepper, TimeInput } from '../components/NumberInputs'
import { OTHER_REASON, addReason, type ReasonOption } from '@core/distractions'
import type { AppRule, Classification } from '@core/tracking'
import { Button, inputBase } from '../components/ui'
import { confirmAction } from '../components/appDialogs'
import { useSession, useSettings } from '../store/session'
import { useLibrary } from '../store/library'

const CLASS_LABEL: Record<Classification, string> = { distraction: 'Distraction', study: 'Study', ignore: 'Ignore' }

export function AutomaticTrackingCard():React.JSX.Element {
  const {settings,set}=useSettings(),[tracking,setTracking]=useState<TrackingStatus|null>(null)
  useEffect(()=>{void window.api.invoke('tracking:status').then(setTracking);return window.api.on('tracking:changed',setTracking)},[])
  const [deleting,setDeleting]=useState(false),[deletion,setDeletion]=useState('')
  const idle=useSession(s=>s.state.stage==='idle'&&!s.state.recovery)
  const deleteTitles=async():Promise<void>=>{
    if(!await confirmAction('Remove recorded window titles from this profile? Study history, app names and classifications stay. Title collection turns off. Backups, exports and your saved title rules are not changed. This is not secure erasure of disk remnants.','Delete window titles','Delete window titles?',true))return
    setDeleting(true);setDeletion('')
    try{await window.api.invoke('tracking:deleteTitles');setDeletion(uiText('Window titles deleted. Title collection is off.'))}
    catch(error){setDeletion(error instanceof Error?error.message:String(error))}
    finally{setDeleting(false)}
  }
  const enabled=trackingConsented(settings)
  return <div className="rounded-2xl border border-focus/40 bg-focus/5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-focus">{uiText("LESS MANUAL TRACKING")}</p><h3 className="mt-1 text-xl font-semibold">{uiText("See where your study time goes")}</h3></div><Switch label={uiText("Automatic foreground tracking")} checked={enabled} onChange={v=>set('foregroundTrackingEnabled',v)}/></div>
    <div className="my-4 flex flex-wrap gap-2">{['App time','Window activity','Detected distractions'].map(label=><span key={label} className="rounded-full border border-line bg-surface px-3 py-2 text-sm">{uiText(label)}</span>)}</div>
    <p className="text-sm text-muted">{uiText(TRACKING_DISCLOSURE)}</p>
    {settings.foregroundTrackingEnabled&&!enabled&&<p className="mt-3 text-sm text-muted">{uiText(TRACKING_RECONFIRM)}</p>}
    <label className="mt-4 flex items-start gap-3 text-sm text-muted"><input type="checkbox" className="mt-1" aria-label={uiText("Record window titles")} disabled={!enabled} checked={settings.foregroundTrackingTitlesEnabled} onChange={e=>void set('foregroundTrackingTitlesEnabled',e.target.checked)}/><span>{uiText(TITLE_DISCLOSURE)}</span></label>
    <p className="mt-3 text-xs text-muted">{uiText("App classifications are estimates. Review detected distractions; tracking does not prove attention. You can delete recorded titles separately from study history. Copies in backups and exports remain separate.")}</p>
    <p className="mt-3 text-xs text-muted">{uiText("After deletion, saved automatic detections and switch counts are preserved. Later rules apply to other sessions; individual records remain editable.")}</p>
    <div className="mt-4 flex flex-col items-start gap-2"><Button variant="quiet" disabled={!idle||deleting} onClick={()=>void deleteTitles()}>{uiText("Delete window titles")}</Button><p className="text-xs text-muted">{uiText("Removes titles from this profile, keeping study history. Copies in backups and exports remain. Saved title rules stay editable below.")}</p>{!idle&&<p className="text-xs text-muted">{uiText("Finish or leave the current study workflow before deleting window titles.")}</p>}<p role="status" className="text-sm text-muted">{deletion}</p></div>
    <p role="status" className={`mt-3 font-medium ${tracking?.state==='failed'?'text-status-error':'text-accent-text'}`}>{!enabled?uiText("Off · no foreground collection"):tracking?.state==='failed'?uiText("Not working: {value0}", {value0: (uiText(tracking.reason))}):tracking?.state==='running'?uiText("On · tracking now"):uiText("Enabled preference · not collecting now")}</p>
  </div>
}

/** Turn a key press into an Electron accelerator ("F8", "Ctrl+Shift+D"). */
function accelerator(e: React.KeyboardEvent): string | null {
  const k = e.key
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return null
  let key = k.length === 1 ? k.toUpperCase() : k
  if (key === ' ') key = 'Space'
  if (key.startsWith('Arrow')) key = key.slice(5)
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean)
  // Plain letters and digits would steal normal typing everywhere: they need a modifier.
  if (!mods.length && !/^F\d{1,2}$/.test(key)) return null
  return [...mods, key].join('+')
}

/** Settings > Distractions: hotkeys, window tracking, quality label thresholds and the app list. */
export function DistractionSettings({
  Section,
  Row
}: {
  Section: (p: { title: string; children: React.ReactNode }) => React.JSX.Element
  Row: (p: { label: string; hint?: string; keywords?: string; children: React.ReactNode }) => React.JSX.Element | null
}): React.JSX.Element {
  const { settings, set } = useSettings()
  const [status, setStatus] = useState<HotkeyStatus | null>(null)


  useEffect(() => {
    void window.api.invoke('hotkeys:status').then(setStatus)

    const offKeys = window.api.on('hotkeys:changed', setStatus)

    return () => { offKeys() }
  }, [])

  const q = settings.quality
  const setQ = (patch: Partial<typeof q>): Promise<void> => set('quality', { ...q, ...patch })

  return (
    <>
      <Section title="Distractions">
        <Row label="Distracted / Back hotkey" hint={uiText("Works during study in any app. Press Delete to disable.")}>
          <HotkeyField value={settings.hotkeyDistracted} ok={status?.distracted.ok ?? true} onChange={(v) => set('hotkeyDistracted', v)} />
        </Row>
        <Row label="Switch hotkey" hint={uiText("Opens the subject picker while a session runs.")}>
          <HotkeyField value={settings.hotkeySwitch} ok={status?.switch.ok ?? true} onChange={(v) => set('hotkeySwitch', v)} />
        </Row>

      </Section>

      <Section title="Session quality">
        <Row label="Clean" hint={uiText("Less than this share of the session lost, and at most this many distractions.")}>
          <div className="flex items-center gap-3">
            <SmallNumber value={q.cleanMaxShare} min={0} max={100} unit="%" onCommit={(v) => setQ({ cleanMaxShare: v })} />
            <SmallNumber value={q.cleanMaxCount} min={0} max={50} unit="" onCommit={(v) => setQ({ cleanMaxCount: Math.round(v) })} />
          </div>
        </Row>
        <Row label="Some distraction" hint={uiText("Less than this share lost. Anything above is Distracted.")}>
          <SmallNumber value={q.someMaxShare} min={0} max={100} unit="%" onCommit={(v) => setQ({ someMaxShare: v })} />
        </Row>
      </Section>

      <Section title="Quick captures">
        {CAPTURES.map((c) => (
          <Row key={c.key} label={c.label} hint={c.hint}>
            <Switch checked={settings.captures[c.key]} onChange={(v) => set('captures', { ...settings.captures, [c.key]: v })} />
          </Row>
        ))}
        <Row label="Stuck hotkey" hint={uiText("Marks 'I got stuck here' and opens a line for an optional note. Off until you choose a key.")}>
          <HotkeyField value={settings.hotkeyStuck} ok={status?.stuck.ok ?? true} onChange={(v) => set('hotkeyStuck', v)} />
        </Row>
        <Row label="Resisted hotkey" hint={uiText("Counts one 'I wanted to get distracted and did not'. Off until you choose a key.")}>
          <HotkeyField value={settings.hotkeyResisted} ok={status?.resisted.ok ?? true} onChange={(v) => set('hotkeyResisted', v)} />
        </Row>
        <Row label="Long absence after" hint={uiText("Back after more than this many minutes away asks whether to end the session where you left.")}>
          <SmallNumber value={settings.longAbsenceMinutes} min={1} max={240} unit="min" onCommit={(v) => set('longAbsenceMinutes', Math.round(v))} />
        </Row>
      </Section>

      <ReasonsEditor Section={Section} />

      <AppRules Section={Section} />
    </>
  )
}

const CAPTURES: { key: keyof CaptureSettings; label: string; hint: string }[] = [
  { key: 'stuck', label: 'Stuck marker', hint: 'A hotkey: shown on the timeline and added to the subject\'s Review later list.' },
  { key: 'goal', label: 'Session goal', hint: '"What do I want to get done?" on the setup card; the log asks Done, Partly or Not done.' },
  { key: 'resisted', label: 'Resisted', hint: 'A hotkey for "I wanted to get distracted and did not". It counts your wins.' },
  { key: 'longAbsence', label: 'Long absence question', hint: 'Continue, or end the session where you left, after a long time away.' }
]

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?:string }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-focus' : 'bg-surface-2 ring-1 ring-line'}`}
    >
      <span className={`absolute top-1 left-1 size-6 rounded-full shadow transition-transform ${checked ? 'translate-x-6 bg-on-accent' : 'bg-muted'}`} />
    </button>
  )
}

/** Distraction reasons: rename, reorder, archive, add. The picker shows the most used first. */
function ReasonsEditor({ Section }: { Section: (p: { title: string; children: React.ReactNode }) => React.JSX.Element }): React.JSX.Element {
  const { settings, set } = useSettings()
  const reasons = settings.distractionReasons
  const [adding, setAdding] = useState('')
  const save = (next: ReasonOption[]): Promise<void> => set('distractionReasons', next)
  const move = (i: number, d: -1 | 1): void => {
    const next = [...reasons]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    void save(next)
  }
  return (
    <Section title="Distraction reasons">
      <div className="flex flex-col gap-1.5 px-6 py-5">
        <p className="mb-2 text-sm text-muted">{uiText("Frequent reasons appear first. Archived reasons stay in History.")}</p>
        {reasons.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-2 ${r.archived ? 'opacity-55' : ''}`}>
            <RenameField value={r.label} onSave={(label) => save(reasons.map((x) => (x.id === r.id ? { ...x, label } : x)))} />
            {r.id === OTHER_REASON && <span className="text-sm text-muted">{uiText("asks what it was")}</span>}
            <span className="flex-1" />
            <Button variant="ghost" size="sm" aria-label={uiText("Move up")} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button variant="ghost" size="sm" aria-label={uiText("Move down")} disabled={i === reasons.length - 1} onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button variant="ghost" size="sm" disabled={r.id === OTHER_REASON} onClick={() => save(reasons.map((x) => (x.id === r.id ? { ...x, archived: !x.archived } : x)))}>
              {r.archived ? uiText("Restore") : uiText("Archive")}
            </Button>
          </div>
        ))}
        <form
          className="mt-2 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!adding.trim()) return
            void save(addReason(reasons, adding).reasons)
            setAdding('')
          }}
        >
          <input dir="auto" className={`${inputBase} flex-1`} placeholder={uiText("New reason")} value={adding} onChange={(e) => setAdding(e.target.value)} />
          <Button variant="quiet" type="submit">{uiText("Add")}</Button>
        </form>
      </div>
    </Section>
  )
}

function RenameField({ value, onSave }: { value: string; onSave: (v: string) => void }): React.JSX.Element {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      dir="auto"
      aria-label={uiText("Reason name")}
      className={`${inputBase} min-h-10 w-72 py-1`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() && text !== value && onSave(text.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function HotkeyField({ value, ok, onChange }: { value: string; ok: boolean; onChange: (v: string) => void }): React.JSX.Element {
  const [listening, setListening] = useState(false)
  return (
    <div className="flex items-center gap-3">
      {!ok && value && <span className="text-sm text-overtime">{uiText("Windows would not give FocusRecall this key. Try another.")}</span>}
      {ok && value && <span className="text-sm text-muted">{uiText("Ready")}</span>}
      <input
        readOnly
        aria-label={uiText("Hotkey")}
        className={`${inputBase} w-44 text-center ${!ok && value ? 'border-overtime' : ''} ${listening ? 'border-focus' : ''}`}
        value={listening ? 'Press a key…' : value || 'Off'}
        onFocus={() => setListening(true)}
        onBlur={() => setListening(false)}
        onKeyDown={(e) => {
          if (e.key === 'Tab') return
          e.preventDefault()
          if (e.key === 'Escape') return (e.target as HTMLInputElement).blur()
          if (e.key === 'Delete' || e.key === 'Backspace') {
            onChange('')
            return (e.target as HTMLInputElement).blur()
          }
          const acc = accelerator(e)
          if (acc) {
            onChange(acc)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
    </div>
  )
}

function SmallNumber({ value, min, max, unit, onCommit }: { value: number; min: number; max: number; unit: string; onCommit: (v: number) => void }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2">
      {unit === 'min' ? (
        <TimeInput value={value} min={min} max={max} onChange={(v) => v !== null && onCommit(v)} className="w-24" />
      ) : (
        <NumberStepper value={value} min={min} max={max} onChange={(v) => v !== null && onCommit(v)} className="w-16" />
      )}
      <span className="w-6 text-base text-muted">{unit}</span>
    </span>
  )
}

/**
 * Every lasting choice about programs and sites, grouped by site (or program).
 * Each shows what it counts as and where it applies (always, or for one
 * subject); both can be changed, or the choice removed. Choices made for a
 * single session stay with that session and are not listed.
 */
function AppRules({ Section }: { Section: (p: { title: string; children: React.ReactNode }) => React.JSX.Element }): React.JSX.Element {
  const [rules, setRules] = useState<AppRule[]>([])
  const [pattern, setPattern] = useState('')
  const [matchType, setMatchType] = useState<AppRule['matchType']>('title')
  const [classification, setClassification] = useState<Classification>('distraction')
  const items = useLibrary((s) => s.items)
  const subjects = items.filter((x) => !x.archived)
  useEffect(() => {
    void window.api.invoke('rules:list').then(setRules)
  }, [])
  const reload = async (): Promise<void> => setRules(await window.api.invoke('rules:list'))

  const add = async (): Promise<void> => {
    if (!pattern.trim()) return
    if (!await confirmBrowserRules([{ matchType, pattern, classification }])) return
    setRules(await window.api.invoke('rules:save', { matchType, pattern, classification }))
    setPattern('')
  }
  const lasting = rules.filter((r) => !r.sessionId)
  const groups = new Map<string, { label: string; rules: AppRule[] }>()
  for (const r of lasting) {
    const label = r.matchType === 'title' ? r.pattern.split(/\s+\+\s+/)[0].trim() : r.pattern
    const g = groups.get(label.toLowerCase()) ?? { label, rules: [] }
    g.rules.push(r)
    groups.set(label.toLowerCase(), g)
  }
  const sorted = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))

  return (
    <Section title="Programs and websites">
      <div className="flex flex-col gap-4 px-6 py-5">
        <p className="text-sm text-muted">{uiText("Matches window titles, not URLs. Subject rules override general rules; more specific rules win.")}</p>
        <div className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {sorted.map((g) => (
            <div key={g.label} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="text-base font-semibold" dir="auto">
                {g.label}
              </div>
              {g.rules
                .sort((a, b) => a.pattern.length - b.pattern.length || (a.itemId ?? 0) - (b.itemId ?? 0))
                .map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 text-base">
                    <span className="w-16 text-sm text-muted">{r.matchType === 'title' ? uiText("website") : uiText("program")}</span>
                    <span className="min-w-40 flex-1" dir="auto">
                      {r.pattern}
                    </span>
                    <select
                      aria-label={uiText("What {value0} counts as", {value0: (r.pattern)})}
                      className={`${inputBase} w-36`}
                      value={r.classification}
                      onChange={async (e) => setRules(await window.api.invoke('rules:save', { ...r, classification: e.target.value as Classification }))}
                    >
                      {(Object.keys(CLASS_LABEL) as Classification[]).map((c) => (
                        <option key={c} value={c}>
                          {CLASS_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={uiText("Where {value0} applies", {value0: (r.pattern)})}
                      className={`${inputBase} w-56`}
                      value={r.itemId ?? ''}
                      onChange={async (e) => {
                        const itemId = e.target.value ? Number(e.target.value) : null
                        await window.api.invoke('rules:rescope', r.id, itemId ? 'subject' : 'always', { itemId, sessionId: null })
                        await reload()
                      }}
                    >
                      <option value="">{uiText("Always")}</option>
                      {(r.itemId && !subjects.some((x) => x.id === r.itemId) ? [...subjects, ...items.filter((x) => x.id === r.itemId)] : subjects).map((x) => (
                        <option key={x.id} value={x.id}>{uiText("For ")}{x.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={uiText("Remove {value0}", {value0: (r.pattern)})}
                      className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                      onClick={async () => setRules(await window.api.invoke('rules:delete', r.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          ))}
          {!sorted.length && <span className="px-4 py-3 text-base text-muted">{uiText("None yet.")}</span>}
        </div>
        <form
          className="flex max-w-3xl flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <select aria-label={uiText("Match")} className={`${inputBase} w-48`} value={matchType} onChange={(e) => setMatchType(e.target.value as AppRule['matchType'])}>
            <option value="title">{uiText("Word in the title")}</option>
            <option value="process">{uiText("Program name")}</option>
          </select>
          <input
            className={`${inputBase} min-w-48 flex-1`}
            placeholder={matchType === 'title' ? uiText("e.g. YouTube") : uiText("e.g. Discord")}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <select aria-label={uiText("Counts as")} className={`${inputBase} w-36`} value={classification} onChange={(e) => setClassification(e.target.value as Classification)}>
            {(Object.keys(CLASS_LABEL) as Classification[]).map((c) => (
              <option key={c} value={c}>
                {CLASS_LABEL[c]}
              </option>
            ))}
          </select>
          <Button variant="quiet" type="submit">{uiText("Add (always)")}</Button>
        </form>
      </div>
    </Section>
  )
}
