import { useEffect, useRef, useState } from 'react'
import { LEARN_LESSONS, learnLesson, learnRefreshDelay, type LessonId } from '@core/learn'
import { parseDayStart, studyDayKey } from '@core/studyDay'
import { useSettings } from '../store/session'
import { ADVICE_CATALOG, ADVICE_SOURCES, adviceConcept } from '@core/adviceCatalog'
import { adviceText } from '@core/adviceText'
import { adviceBrief } from '@core/adviceBrief'
import { t, useLanguage } from '../i18n'
import { useLearn } from '../store/learn'
import { Button, inputClass } from '../components/ui'
import { PrincipleVisual, ideaTitle } from '../components/learn/PrincipleVisual'
import { FieldVisual } from '../components/learn/FieldVisual'
import { StrategyVisual } from '../components/learn/StrategyVisual'
import type { StrategyVisualId } from '@core/strategyVisuals'
import { expansionText, isExpansion, EXPANSION_SOURCES } from '@core/learnExpansion'
import './learn.css'

const topics={retrieval:'Retrieval',spacing:'Spacing',understanding:'Understanding',examples:'Examples and mixed practice',feedback:'Feedback',metacognition:'Checking your understanding',planning:'Planning',attention:'Attention',rest:'Rest'}

const visualTopics:Partial<Record<LessonId,keyof typeof topics>>={chunking:'understanding',workspace:'attention',incubation:'rest',mentalset:'understanding',starting:'planning',palace:'retrieval',sleep:'rest',transfer:'understanding',exam:'examples',difficulty:'examples',together:'understanding',switching:'attention',sources:'understanding',context:'spacing',forgetting:'retrieval',motivation:'planning',targeted:'examples',pressure:'planning',methods:'understanding'}
const collections={understand:'Understand and connect',remember:'Remember over time',practice:'Practise with purpose',adapt:'Start, pause and adapt',notice:'Notice what you know'}
function Visual({id,compact=false}:{id:LessonId;compact?:boolean}):React.JSX.Element {return isExpansion(id)?<FieldVisual id={id} compact={compact}/>:<PrincipleVisual id={id} compact={compact}/>}

export default function LearnTab():React.JSX.Element {
 const s=useLearn(),root=useRef<HTMLDivElement>(null),[resetting,setResetting]=useState(false)
 const dayStart=useSettings(s=>s.settings.dayStart)
 useLanguage()
 useEffect(()=>{void useLearn.getState().load().then(()=>{if(useLearn.getState().data)void useLearn.getState().act({type:'today'})})},[])
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>
  const refresh=():void=>{const store=useLearn.getState();if(document.visibilityState==='visible'&&store.data&&store.view==='today'&&store.data.today.day!==studyDayKey(new Date(),parseDayStart(dayStart)))void store.act({type:'today'})}
  const tick=():void=>{refresh();timer=setTimeout(tick,learnRefreshDelay(new Date(),dayStart))}
  tick();document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh)
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh)}
 },[dayStart])
 const route=s.lesson??(s.view==='today'?`today:${s.data?.today.id}`:s.view),previous=useRef(route)
 useEffect(()=>{if(route!==previous.current){const prior=previous.current;previous.current=route;root.current?.scrollTo({top:s.lesson||s.view==='today'?0:s.scroll});(root.current?.querySelector<HTMLElement>(s.lesson||s.view==='today'?'.learn-idea-heading h2':`[data-idea-card="${prior}"]`)??root.current?.querySelector<HTMLElement>('h1'))?.focus({preventScroll:true})}},[route,s.lesson,s.view])
 return <div className="learn-page" ref={root} data-learn-page><div className="learn-shell">
  <header className={`learn-header ${s.lesson?'learn-detail-header':''}`}><div><h1 tabIndex={-1}>{t(s.lesson?'Learn':'Small ideas for better studying')}</h1></div><div className="flex gap-2">{s.lesson&&<><Button onClick={s.close}>{t('Back to Learn')}</Button><Button onClick={()=>s.navigate('saved')}>{t('Saved')}</Button></>}</div></header>
  {!s.lesson&&<nav className="learn-nav" aria-label={t('Learn views')}><Button aria-pressed={s.view==='today'} onClick={()=>s.navigate('today')}>{t('Today')}</Button><Button aria-pressed={s.view!=='today'&&s.view!=='saved'} onClick={()=>s.navigate('guide')}>{t('Explore')}</Button><Button aria-pressed={s.view==='saved'} onClick={()=>s.navigate('saved')}>{t('Saved')}</Button></nav>}
  {s.error&&<div role="alert" className="text-status-error"><p>{t(s.error)}</p><Button onClick={()=>void s.load()}>{t('Retry')}</Button></div>}
  {!s.data?<p role="status">{t('Loading…')}</p>:s.lesson?<Explainer id={s.lesson}/>:s.view==='today'?<Today/>:<Explore/>}
  <footer className="learn-footer"><span>{t('Offline. At your own pace.')}</span><details><summary>{t('Learn progress and privacy')}</summary><p>{t('Bookmarks and previously saved Learn activity stay on this device. There are no required activities or completion targets.')}</p>{resetting?<><Button disabled={s.busy} onClick={()=>void s.act({type:'reset'}).then(ok=>{if(ok){setResetting(false);void s.act({type:'today'})}})}>{t('Confirm Learn reset')}</Button><Button onClick={()=>setResetting(false)}>{t('Cancel')}</Button></>:<Button onClick={()=>setResetting(true)}>{t('Reset Learn progress')}</Button>}</details></footer>
 </div></div>
}
function Save({id}:{id:string}):React.JSX.Element {
 const s=useLearn(),saved=s.data?.saved.includes(id)
 return <Button aria-pressed={!!saved} disabled={s.busy} onClick={()=>void s.act({type:'save',id})}>{t(saved?'Unsave':'Save')}</Button>
}
function Today():React.JSX.Element {
 const s=useLearn(),id=learnLesson(s.data!.today.id??'')?.id
 const visit=useRef(''),key=`${s.data!.today.day}:${id}`
 useEffect(()=>{if(id&&!s.data!.today.hidden&&visit.current!==key){visit.current=key;void s.act({type:'view',id}).then(ok=>{if(!ok)visit.current=''})}},[id,key,s.data!.today.hidden])
 return <>{id&&!s.data!.today.hidden?<><div className="learn-today-tools"><p className="learn-eyebrow" role="status">{t('One idea for today')} · {t(s.data!.today.revisiting?'Previously shown':'New idea')}</p><div className="learn-toolbar"><Button disabled={s.busy} onClick={()=>void s.act({type:'another'})}>{t('Another idea')}</Button><Button variant="ghost" disabled={s.busy} onClick={()=>void s.act({type:'hide'})}>{t('Hide today’s idea')}</Button></div></div><Explainer id={id} today/></>:<section className="learn-quiet"><span aria-hidden="true">◌</span><h2>{t('A quiet Today')}</h2><p>{t('Nothing to catch up on. Browse an idea whenever it is useful.')}</p><Button onClick={()=>s.navigate('guide')}>{t('Explore')}</Button><Button disabled={s.busy} onClick={()=>void s.act({type:'another'})}>{t('Another idea')}</Button></section>}</>
}
function Explainer({id}:{id:LessonId;today?:boolean}):React.JSX.Element {
 const language=useLanguage(),lesson=learnLesson(id)!,copy=isExpansion(id)?expansionText(id,language):adviceText(lesson.concept,language)
 return <article className="learn-explainer" data-learn-idea={id}><div className="learn-idea-heading"><h2 tabIndex={-1}>{isExpansion(id)?expansionText(id,language).title:t(ideaTitle[id])}</h2><Save id={'lesson:'+id}/></div><Visual id={id}/><div className="learn-takeaway"><span className="learn-eyebrow">{t('For your next study session')}</span><p>{copy.action}</p></div>
  <details className="learn-deeper"><summary>{t('A little deeper')}</summary><p>{copy.detail}</p><div className="learn-related">{lesson.related.map(concept=><div key={concept}><p>{adviceText(concept,language).action}</p><Save id={'concept:'+concept}/></div>)}</div></details>
  <details className="learn-deeper"><summary>{t('Research and limitations')}</summary><Sources ids={[lesson.concept,...lesson.related]} lessonId={id}/></details>
 </article>
}
function Explore():React.JSX.Element {
 const s=useLearn(),language=useLanguage(),saved=s.view==='saved',q=s.query.trim().toLocaleLowerCase(language)
 const matches=(value:string)=>!q||value.toLocaleLowerCase(language).includes(q)
 const title=(id:LessonId)=>isExpansion(id)?expansionText(id,language).title:t(ideaTitle[id])
 const matchedLessons=LEARN_LESSONS.filter(l=>matches(title(l.id)+' '+(isExpansion(l.id)?Object.values(expansionText(l.id,language)).join(' '):adviceText(l.concept,language).detail+' '+adviceText(l.concept,language).action))&&(!saved||s.data!.saved.includes('lesson:'+l.id))&&(!s.topic||(visualTopics[l.id]??adviceConcept(l.concept)?.topic)===s.topic))
 const matchedConcepts=ADVICE_CATALOG.filter(c=>{const copy=adviceText(c.id,language);return matches(copy.action+' '+copy.detail+' '+t(topics[c.topic]))&&(!saved||s.data!.saved.includes('concept:'+c.id))&&(!s.topic||s.topic===c.topic)})
 const lessons=matchedLessons.filter(l=>!s.collection||l.group===s.collection),concepts=!s.collection||s.collection==='strategies'?matchedConcepts:[]
 return <><div className="learn-toolbar"><label className="learn-search"><span className="sr-only">{t('Search Learn')}</span><input dir="auto" aria-label={t('Search Learn')} type="search" className={inputClass} placeholder={t('Search ideas, examples or strategies')} value={s.query} onChange={e=>useLearn.setState({query:e.target.value.slice(0,200)})}/></label><select aria-label={t('Topic')} className={inputClass} value={s.topic} onChange={e=>useLearn.setState({topic:e.target.value})}><option value="">{t('All topics')}</option>{Object.entries(topics).map(([id,key])=><option key={id} value={id}>{t(key)}</option>)}</select>{(s.query||s.topic||s.collection)&&<Button onClick={()=>useLearn.setState({query:'',topic:'',collection:''})}>{t('Clear filters')}</Button>}</div>
  <nav className="learn-collection-links learn-shelf-picker" aria-label={t('Browse a collection')}><Button aria-pressed={!s.collection} onClick={()=>useLearn.setState({collection:''})}>{t('All collections')}</Button>{Object.entries(collections).filter(([group])=>matchedLessons.some(l=>l.group===group)).map(([group,label])=><Button key={group} data-collection-filter={group} aria-pressed={s.collection===group} onClick={()=>useLearn.setState({collection:group})}>{t(label)} <span>{new Intl.NumberFormat(language).format(matchedLessons.filter(l=>l.group===group).length)}</span></Button>)}{!!matchedConcepts.length&&<Button data-collection-filter="strategies" aria-pressed={s.collection==='strategies'} onClick={()=>useLearn.setState({collection:'strategies'})}>{t('Practical strategies')} <span>{new Intl.NumberFormat(language).format(matchedConcepts.length)}</span></Button>}</nav>
  <p className="learn-result-count" role="status">{t('Visual ideas')}: {new Intl.NumberFormat(language).format(lessons.length)} · {t('Practical strategies')}: {new Intl.NumberFormat(language).format(concepts.length)}</p>
  {Object.entries(collections).map(([group,label])=>{const entries=lessons.filter(l=>l.group===group);return entries.length?<section className="learn-collection" id={'learn-collection-'+group} key={group}><h2>{t(label)} <span>{new Intl.NumberFormat(language).format(entries.length)}</span></h2><div className="learn-guide-grid">{entries.map(l=><button type="button" key={l.id} className="learn-guide-entry" data-idea-card={l.id} aria-label={title(l.id)} onClick={()=>{const scroll=document.querySelector('[data-learn-page]')?.scrollTop??0;s.open(l.id);useLearn.setState({scroll})}}><Visual id={l.id} compact/><h3>{title(l.id)}<span aria-hidden="true"> ↗</span></h3></button>)}</div></section>:null})}
  {!!concepts.length&&<section className="learn-strategies" id="learn-strategies"><h2>{t('Practical strategies')} <span className="learn-eyebrow">{new Intl.NumberFormat(language).format(concepts.length)}</span></h2><div className="learn-strategy-list">{concepts.map(c=><article key={c.id} data-strategy-id={c.id}><div className="learn-strategy-preview" aria-hidden="true"><StrategyVisual id={c.id as StrategyVisualId} compact/></div><details><summary><span className="learn-eyebrow">{t(topics[c.topic])}</span><h3>{adviceBrief(c.id,language)}</h3></summary><p>{adviceText(c.id,language).action}</p><StrategyVisual id={c.id as StrategyVisualId}/><p>{adviceText(c.id,language).detail}</p><div className="learn-toolbar"><Save id={'concept:'+c.id}/></div><details className="learn-deeper"><summary>{t('Research and limitations')}</summary><Sources ids={[c.id]}/></details></details></article>)}</div></section>}
  {!concepts.length&&!lessons.length&&<section role="status" className="learn-quiet"><span aria-hidden="true">{saved?'◇':'⌕'}</span><p>{t(saved?'Nothing saved matches this view. Save an idea or clear the filters.':'No results. Try a different word or clear the topic filter.')}</p>{saved&&!s.query&&!s.topic&&<Button onClick={()=>s.navigate('guide')}>{t('Explore')}</Button>}</section>}
 </>
}
function Sources({ids,lessonId}:{ids:string[];lessonId?:LessonId}):React.JSX.Element {
 const language=useLanguage()
 const sources=lessonId&&isExpansion(lessonId)?EXPANSION_SOURCES[lessonId]:[...new Set(ids.flatMap(id=>adviceConcept(id)?.sources??[]))].map(key=>ADVICE_SOURCES[key as keyof typeof ADVICE_SOURCES])
 return <div className="learn-sources"><p>{t(sources.length?'General guidance, not a finding from your records. These studies do not test A14 Pomodoro itself.':'Practical suggestion, not a personal finding or a proven learning effect.')}</p>{lessonId&&isExpansion(lessonId)&&<p>{expansionText(lessonId,language).detail}</p>}{sources.map(source=>{return <button key={source.url} type="button" onClick={()=>void window.api.invoke('shell:open',source.url).catch(()=>useLearn.setState({error:'Could not open the research source.'}))}><bdi>{source.citation}</bdi><span className="sr-only"> {t('Open in browser')}</span></button>})}</div>
}
