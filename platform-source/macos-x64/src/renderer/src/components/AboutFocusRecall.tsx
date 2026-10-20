import { t as uiText } from '../i18n'
import { PRODUCT_LINKS } from '@core/product'
import { sessionCommand } from '../store/session'
import { Button } from './ui'
import { AppVersion } from './AppVersion'
import { useState } from 'react'
import { Dialog } from './ui'
import eula from '../../../../resources/legal/EULA.txt?raw'
import privacy from '../../../../resources/legal/PRIVACY.txt?raw'
const icon=new URL('../../../../resources/focusrecall-icon.png',import.meta.url).href
const supportArt=new URL('../../../../resources/support-cup.svg',import.meta.url).href

export function AboutFocusRecall():React.JSX.Element {
  const [legal,setLegal]=useState<'license'|'privacy'|null>(null)
  const open=(url:string):void=>{void sessionCommand(()=>window.api.invoke('shell:open',url))}
  return <section aria-labelledby="about-focusrecall" className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
    <header className="flex items-center gap-4"><img src={icon} alt="" className="size-16 rounded-2xl"/><div><h2 id="about-focusrecall" className="text-2xl font-semibold">{uiText("About FocusRecall")}</h2><p className="mt-1 text-sm text-muted">{uiText("Made by abd1442 · Free to use")}</p><AppVersion/></div></header>
    <div className="max-w-2xl"><h3 className="text-xl font-medium">{uiText("Built for my own studying")}</h3><p className="mt-3 leading-relaxed">{uiText("I couldn't find an app that combined the study timer, recall notes and personal insights I wanted. So I built FocusRecall for myself, with one priority: keeping my study data on my own computer.")}</p><p className="mt-3 leading-relaxed text-muted">{uiText("Track your sessions, revisit what you learned and discover patterns in your own records. No account, required subscription or cloud upload.")}</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['Local records','Your study history and notes stay on your PC.'],['You choose what leaves','Exports and Obsidian sends are under your control.'],['Your Windows account','Local records are not encrypted by FocusRecall. Protect your account and backups.']].map(([title,copy])=><div key={title} className="rounded-xl bg-focus/5 p-4"><h3 className="text-sm font-semibold text-focus">{title}</h3><p className="mt-2 text-sm text-muted">{copy}</p></div>)}</div>
    <div className="flex flex-wrap gap-3"><Button onClick={()=>open(PRODUCT_LINKS.github)}>{uiText("FocusRecall on GitHub")}</Button><Button onClick={()=>open(PRODUCT_LINKS.feedback)}>{uiText("Suggest an improvement")}</Button><Button onClick={()=>setLegal('license')}>{uiText("License")}</Button><Button onClick={()=>setLegal('privacy')}>{uiText("Privacy")}</Button></div>
    {legal&&<Dialog title={legal==='license'?uiText("FocusRecall license"):uiText("Privacy & local data")} onClose={()=>setLegal(null)}><div className="whitespace-pre-wrap text-sm leading-relaxed">{legal==='license'?eula:privacy}</div></Dialog>}
    <footer aria-labelledby="support-focusrecall-title" className="focusrecall-support flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <img src={supportArt} alt="" className="size-12 shrink-0"/>
      <div className="min-w-0 flex-1"><h3 id="support-focusrecall-title" className="font-semibold">{uiText("Support FocusRecall")}</h3><p className="mt-1 text-sm text-muted">{uiText("Optional, always. Every feature stays free.")}</p></div>
      <Button aria-label={uiText("Support on Ko-fi (opens in your browser)")} onClick={()=>open(PRODUCT_LINKS.support)}>{uiText("Ko-fi ")}<span aria-hidden="true">↗</span></Button>
    </footer>
  </section>
}
