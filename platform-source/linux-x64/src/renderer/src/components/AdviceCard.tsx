import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { adviceConcept, ADVICE_SOURCES, type AdviceIntent, type AdviceSurface } from '@core/adviceCatalog'
import { adviceText } from '@core/adviceText'
import { adviceBrief } from '@core/adviceBrief'
import { AdviceSketch } from './AdviceSketch'
import { t, useLanguage } from '../i18n'
import { Button } from './ui'
import { LEARN_LESSONS } from '@core/learn'
import { useLearn } from '../store/learn'
import { useUi } from '../store/ui'
import { useSession } from '../store/session'
import './adviceCard.css'
const StudyStrategyExample=lazy(()=>import('./learn/StudyStrategyExample'))

/** Deliberately absent from Focus. Language changes update text in place. */
export function AdviceCard({surface}:{surface:AdviceSurface}):React.JSX.Element {
  const language=useLanguage(),[intent,setIntent]=useState<AdviceIntent>('any'),[id,setId]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false)
  const [example,setExample]=useState<string|null>(null)
  const focusActive=useSession(s=>s.state.stage==='focus')
  useEffect(()=>{setExample(null)},[id,focusActive])
  const sequence=useRef(0),previousPurpose=useRef('')
  useEffect(()=>{
    const request=++sequence.current,key=`${surface}:${intent}`,explicitChange=!!previousPurpose.current&&previousPurpose.current!==key
    previousPurpose.current=key;setLoaded(false);setError('')
    void window.api.invoke('advice:choose',surface,intent,explicitChange).then(next=>{if(request===sequence.current){setId(next);setLoaded(true)}}).catch(()=>{if(request===sequence.current){setError(t('Could not load study suggestions. Try again.'));setLoaded(true)}})
    return ()=>{sequence.current++}
  },[surface,intent])
  async function act(action:'another'|'less'|'reset'):Promise<void>{
    if(busy)return;setBusy(true);setError('');const request=++sequence.current
    try{if(action==='less'&&id)await window.api.invoke('advice:less',id);if(action==='reset')await window.api.invoke('advice:reset');const next=await window.api.invoke('advice:choose',surface,intent,action==='another');if(request===sequence.current){setId(next);setLoaded(true)}}
    catch{if(request===sequence.current)setError(t('Could not load study suggestions. Try again.'))}finally{setBusy(false)}
  }
  const concept=id?adviceConcept(id):undefined,copy=concept?adviceText(concept.id,language):undefined
  return <><section aria-label={t('Study suggestions')} data-advice-id={id??''} className="advice-card">
    <div className="advice-overview">{concept&&<AdviceSketch topic={concept.topic}/>}<div aria-live="polite" className="min-w-0">{concept&&<p className="advice-basis">{t(concept.basis==='research'?'Research-backed strategy':concept.basis==='contextual'?'Depends on the task':'Practical suggestion')}</p>}{copy&&concept&&<p className="advice-prompt">{adviceBrief(concept.id,language)}</p>}{loaded&&!copy&&!error&&<p className="text-muted">{t('No fresh suggestion for this purpose. You can study without one, change purpose or reset suggestions.')}</p>}</div></div>
    <div className="advice-actions"><div className="advice-primary-actions">{copy&&concept&&surface!=='stats'&&!focusActive&&<Button size="sm" variant="ghost" onClick={()=>setExample(concept.id)}>{t('See a visual example')}</Button>}{id&&<Button size="sm" variant="ghost" disabled={busy||!loaded} onClick={()=>void act('another')}>{t('Another suggestion')}</Button>}</div>
    {copy&&concept&&<details className="advice-depth"><summary>{t('Why and when')}</summary><p className="font-medium">{copy.action}</p><p>{copy.detail}</p><p className="text-sm text-muted">{t('General guidance, not a finding from your records. These studies do not test FocusRecall itself.')}</p>{concept.sources.length>0&&<div className="flex flex-wrap gap-2" aria-label={t('Research sources')}>{concept.sources.map(key=>{const s=ADVICE_SOURCES[key as keyof typeof ADVICE_SOURCES];return <button key={key} type="button" className="min-h-11 break-words text-start underline" onClick={()=>void window.api.invoke('shell:open',s.url).catch(()=>setError(t('Could not open the research source.')))}><bdi>{s.citation}</bdi><span className="sr-only"> {t('Open in browser')}</span></button>})}</div>}{surface==='stats'&&<Button onClick={()=>{const lesson=LEARN_LESSONS.find(l=>l.concept===concept.id||(l.related as readonly string[]).includes(concept.id));if(lesson)useLearn.getState().open(lesson.id);else{useLearn.getState().navigate('strategies');useLearn.setState({query:copy.action,topic:''})}useUi.getState().setTab('learn')}}>{t('Explore in Learn')}</Button>}</details>}
    <details className="advice-depth"><summary>{t('Suggestion controls')}</summary><label className="flex flex-wrap items-center gap-2 text-muted">{t('Purpose')}<select className="min-h-11 max-w-full rounded-lg border border-line bg-surface px-2 text-ink" value={intent} disabled={busy} onChange={e=>setIntent(e.target.value as AdviceIntent)}><option value="any">{t('Any study task')}</option><option value="understand">{t('Understand ideas')}</option><option value="practice">{t('Practice a skill')}</option><option value="remember">{t('Remember material')}</option></select></label>{id&&<Button size="sm" variant="ghost" disabled={busy||!loaded} onClick={()=>void act('less')}>{t('Less of this topic')}</Button>}<p className="text-sm text-muted">{t('Rotation stays on this device. Less of a topic hides its concepts until reset. Reset clears only suggestion history and hidden topics.')}</p><Button size="sm" disabled={busy} onClick={()=>void act('reset')}>{t('Reset study suggestions')}</Button></details>
    </div>
    {error&&<p role="alert" className="mt-2 text-status-error">{error}<button type="button" className="min-h-11 px-2 underline" onClick={()=>void act('another')}>{t('Retry')}</button></p>}
  </section>{example&&example===id&&!focusActive&&<Suspense fallback={null}><StudyStrategyExample id={example} onClose={()=>setExample(null)}/></Suspense>}</>
}
