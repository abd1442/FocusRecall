import { t as uiText } from '../i18n'
type Page = 'general' | 'log' | 'appearance' | 'about'

export function SettingIcon({ title }: { title: string }): React.JSX.Element {
  const path = /colour|appearance|size|panel/i.test(title) ? 'M5 5h14v14H5z M5 12h14 M12 5v14' : /notes|question|log/i.test(title) ? 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3' : /focus|sitting|day/i.test(title) ? 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16 M12 7v5l3 2' : 'M4 7h16 M4 12h16 M4 17h16 M8 5v4 M16 10v4 M10 15v4'
  return <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-focus/10 text-focus"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg></span>
}

export function SettingsGuide({ page, onChange, onJump }: { page: Page; onChange: (page: Page) => void; onJump: (id: string, page: Page) => void }): React.JSX.Element {
  const cards = [{ id:'general', title:'General', hint:'Timers, notes, music & shortcuts', tone:'focus' }, { id:'log', title:'Log questions', hint:'Choose what you record after study', tone:'recall' }, { id:'appearance', title:'Appearance', hint:'Theme, sidebar, size', tone:'rest' }, { id:'about', title:'About', hint:'The story, privacy & support', tone:'focus' }] as const
  return <div className="flex flex-col gap-4">
    <nav aria-label={uiText("Settings pages")} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map((c) => <button key={c.id} id={`settings-page-${c.id}`} aria-label={uiText(c.title)} aria-describedby={`settings-hint-${c.id}`} aria-controls="settings-page-content" aria-current={page===c.id?'page':undefined} aria-pressed={page===c.id} type="button" onClick={() => onChange(c.id)} className={`settings-guide group flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-start transition ${page===c.id?'border-focus bg-focus/5 ring-1 ring-focus':'border-line bg-surface hover:bg-surface-2'}`}>
      <svg aria-hidden="true" viewBox="0 0 64 64" className="size-12 shrink-0" fill="none" style={{color:`var(--tf-${c.tone})`}}>
        <rect x="3" y="3" width="58" height="58" rx="14" fill="currentColor" opacity=".1"/>
        {c.id==='general'?<><circle cx="32" cy="31" r="18" stroke="currentColor" strokeWidth="3"/><path d="M32 18v13l9 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></>:c.id==='log'?<><rect x="17" y="13" width="30" height="38" rx="4" stroke="currentColor" strokeWidth="2"/><path d="m22 25 3 3 5-6 M33 26h8 M22 36h19 M22 43h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>:<><circle cx="23" cy="25" r="9" fill="currentColor"/><circle cx="41" cy="25" r="9" fill="var(--tf-recall)"/><rect x="14" y="40" width="36" height="9" rx="4.5" fill="var(--tf-focus)"/></>}
      </svg><span className="min-w-0"><span className="block font-semibold">{uiText(c.title)}</span><span id={`settings-hint-${c.id}`} className="mt-1 block text-sm text-muted">{uiText(c.hint)}</span></span>
    </button>)}</nav>
    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="me-2 text-muted">{uiText("Quick find")}</span>{[{label:'Notes apps',id:'setting-notes-integrations',page:'general'},{label:'Timeline colours',id:'setting-timeline-colours',page:'appearance'},{label:'Shapes & fonts',id:'setting-fonts',page:'appearance'},{label:'Keyboard shortcuts',id:'setting-distracted-back-hotkey',page:'general'}].map((link) => <button key={link.id} type="button" className="rounded-full border border-line bg-surface px-4 py-2 transition hover:border-focus hover:text-focus" onClick={() => onJump(link.id,link.page as Page)}>{uiText(link.label)}</button>)}</div>
  </div>
}
