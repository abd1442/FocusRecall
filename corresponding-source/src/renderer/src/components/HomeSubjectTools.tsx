import { useRef, useState } from 'react'
import type { PickerItem } from '@core/types'
import { mergeHomeOrder, type HomeSubjectOrdering } from '@core/homePreferences'
import { useSettings } from '../store/session'
import { t } from '../i18n'
import { Button, Dialog, inputBase } from './ui'

export function HomeSubjectTools({items}:{items:PickerItem[]}):React.JSX.Element|null {
  const preference=useSettings(s=>s.settings.homeSubjectOrdering)
  const [draft,setDraft]=useState<number[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [pending,setPending]=useState<HomeSubjectOrdering|null>(null)
  const revision=useRef(0)
  const current=pending??preference
  const list=useRef<HTMLOListElement>(null)
  const save=async(next:HomeSubjectOrdering):Promise<boolean>=>{
    const request=++revision.current
    setPending(next);setBusy(true);setError('')
    try {await window.api.invoke('settings:set','homeSubjectOrdering',next);return true}
    catch {if(request===revision.current)setError(t('Could not save subject order. Try again.'));return false}
    finally {if(request===revision.current){setPending(null);setBusy(false)}}
  }
  const move=(id:number,delta:number):void=>{
    setDraft(old=>{
      if(!old)return old
      const from=old.indexOf(id),to=from+delta
      if(from<0||to<0||to>=old.length)return old
      const next=[...old];[next[from],next[to]]=[next[to],next[from]];return next
    })
    requestAnimationFrame(()=>{
      const row=list.current?.querySelector(`[data-order-id="${id}"]`)
      ;(row?.querySelector<HTMLButtonElement>(`button[data-direction="${delta}"]:not(:disabled)`)??row?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus()
    })
  }
  if(items.length<2)return null
  return <>
    <div className="flex shrink-0 items-center gap-2 text-sm">
      <label><span className="sr-only">{t('Sort subjects')}</span><select aria-label={t('Sort subjects')} title={t('Sort subjects')} aria-busy={busy} className={`${inputBase} min-h-13 w-40 max-w-[35vw] py-2`} value={current.mode} onChange={e=>{
        const mode=e.target.value as HomeSubjectOrdering['mode']
        const ids=mode==='manual'&&!current.ids.length?items.map(i=>i.id):current.ids
        void save({mode,ids})
      }}>
        <option value="recent">{t('Recently studied · pinned first')}</option>
        <option value="alphabetical">{t('Alphabetical')}</option>
        <option value="most">{t('Most studied · recorded time')}</option>
        <option value="manual">{t('Custom order')}</option>
      </select></label>
      {preference.mode==='manual'&&<Button size="sm" className="min-h-13 min-w-11 px-3" aria-label={t('Arrange subjects')} title={t('Arrange subjects')} disabled={busy} onClick={()=>{setError('');setDraft(items.map(i=>i.id))}}><span aria-hidden="true">↕</span></Button>}
    </div>
    {error&&!draft&&<p role="alert" className="absolute inset-x-0 top-full z-10 rounded-lg border border-line bg-surface p-3 text-status-error">{error}</p>}
    {draft&&<Dialog title={t('Arrange subjects')} onClose={()=>{if(!busy)setDraft(null)}}>
      <p className="mb-4 text-muted">{t('Use Move up or Move down to arrange subjects. Save to keep this order.')}</p>
      <ol ref={list} className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {draft.map((id,index)=>{const item=items.find(i=>i.id===id);return item&&<li key={id} data-order-id={id} className="flex items-center gap-3 rounded-xl border border-line p-3"><span className="text-sm text-muted" aria-hidden="true">{index+1}</span><span dir="auto" className="min-w-0 flex-1 break-words">{item.name}</span>{[-1,1].map(delta=><button key={delta} data-direction={delta} type="button" className="min-h-11 min-w-11 rounded-lg border border-line hover:bg-surface-2 disabled:opacity-30" aria-label={t(delta<0?'Move {name} up':'Move {name} down',{name:item.name})} disabled={busy||(delta<0?index===0:index===draft.length-1)} onClick={()=>move(id,delta)}>{delta<0?'↑':'↓'}</button>)}</li>})}
      </ol>
      {error&&<p role="alert" className="mt-3 text-status-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-3"><Button disabled={busy} onClick={()=>setDraft(null)}>{t('Cancel')}</Button><Button disabled={busy} variant="primary" onClick={()=>void save({mode:'manual',ids:mergeHomeOrder(preference.ids,draft)}).then(ok=>{if(ok)setDraft(null)})}>{t('Save order')}</Button></div>
    </Dialog>}
  </>
}
