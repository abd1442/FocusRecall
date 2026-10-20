import type { LearnKind } from '@core/learn'
import type { LessonCopy } from '@core/learnText'
import { t, useLanguage } from '../../i18n'
import { Button } from '../ui'
import { TeachingText } from './TeachingText'

export function LearnInteraction({kind,copy,values,onChange,onActivity}:{kind:LearnKind;copy:LessonCopy;values:number[];onChange:(values:number[])=>void;onActivity:()=>void}):React.JSX.Element {
 const language=useLanguage(),number=(n:number)=>new Intl.NumberFormat(language).format(n)
 const items=copy.items?.split('¦')??[],panels=copy.panels?.split('¦')??[]
 const change=(next:number[],record=true):void=>{onChange(next);if(record)onActivity()}
 let content:React.ReactNode
 if(kind==='reconstruct'){
   const hidden=values[0]===1,order=values.slice(1,4),matches=order.length===3&&order.every((n,i)=>n===i)
   content=<><div className="learn-procedure" aria-label={t('Example procedure')}>{!hidden?<ol>{items.map((item,i)=><li key={i}><span className="learn-node">{number(i+1)}</span><span>{item}</span></li>)}</ol>:<div className="learn-covered"><span aria-hidden="true">▤</span><p>{t('The example is hidden. Recall privately before using the choices.')}</p></div>}</div>
   <Button onClick={()=>change([hidden?0:1,...order],false)}>{t(hidden?'Show the example':'Hide the example')}</Button>
   {hidden&&<><fieldset><legend className="mb-3 font-medium">{t('Reconstruct the sequence')}</legend><div className="learn-choice-grid">{[2,0,1].map(i=><Button key={i} disabled={order.includes(i)} onClick={()=>change([1,...order,i])}>{items[i]}</Button>)}</div></fieldset><ol className="learn-sequence" aria-label={t('Your sequence')}>{order.map((n,i)=><li key={i}><span>{number(i+1)}</span>{items[n]}</li>)}</ol><div className="flex flex-wrap gap-2"><Button disabled={!order.length} onClick={()=>change([1,...order.slice(0,-1)],false)}>{t('Undo last choice')}</Button><Button disabled={order.length!==3} onClick={()=>change([0,...order])}>{t('Compare with the example')}</Button></div></>}
   {!hidden&&order.length===3&&<p role="status" className="learn-feedback">{t(matches?'Your sequence matches. The choices supplied cues; this does not measure lasting memory.':'Compare the sequence with the example and identify a step to repair.')}</p>}</>
 }else if(kind==='schedule'){
   const days=values.length>=4?values.slice(0,4):[0,0,0,0],selected=values[4]??0
   const distinct=new Set(days).size
   content=<><div className="learn-token-picker" role="group" aria-label={t('Choose a practice token')}>{days.map((day,i)=><Button key={i} aria-pressed={selected===i} onClick={()=>change([...days,i],false)}>{t('Practice')} {number(i+1)} · {t('Day')} {number(day+1)}</Button>)}</div>
   <div className="learn-calendar" role="group" aria-label={t('Choose a practice day')}>{Array.from({length:14},(_,day)=><button key={day} type="button" aria-label={t('Day {value0}',{value0:number(day+1)})} className="learn-calendar-day" onClick={()=>change([...days.map((d,i)=>i===selected?day:d),selected])}><span>{number(day+1)}</span><span className="learn-token-stack">{days.map((d,i)=>d===day?<span key={i} className="learn-token">{number(i+1)}</span>:null)}</span></button>)}</div>
   <div className="flex flex-wrap gap-3"><Button onClick={()=>change([0,0,0,0,0])}>{t('Group on one day')}</Button><Button onClick={()=>change([0,3,7,12,0])}>{t('Spread across days')}</Button></div><p role="status" className="learn-feedback">{t('Four equal practice opportunities across {value0} distinct days.',{value0:number(distinct)})} {t('Illustration only. No retention prediction or optimal schedule.')}</p></>
 }else if(kind==='reason'){
   const choice=values[0]??-1
   content=<><div className="learn-equation" dir="ltr" aria-label="4x + 3 = 19"><span>4x + 3</span><span>=</span><span>19</span></div><div className="learn-choice-grid">{items.map((item,i)=><Button key={i} aria-pressed={choice===i} onClick={()=>change([i])}>{item}</Button>)}</div>{choice>=0&&<><div className="learn-equation" dir="ltr"><span>4x</span><span>{choice===0?'=':'≠'}</span><span>{choice===0?'16':'19'}</span></div><p role="status" className="learn-feedback">{panels[choice]}</p></>}</>
 }else if(kind==='plan'){
   const selected=values.slice(0,3)
   content=<><div className="learn-plan">{items.map((item,i)=><div key={i} className="learn-plan-step"><h3><span className="learn-node">{number(i+1)}</span>{item}</h3><Button aria-pressed={selected.includes(i)} onClick={()=>change(selected.includes(i)?selected.filter(n=>n!==i):[...selected,i])}>{selected.includes(i)?t('Remove from example plan'):t('Add to example plan')}</Button>{selected.includes(i)&&<p>{panels[i]}</p>}</div>)}</div><p role="status" className="learn-feedback">{t('This example plan stays in Learn. No session goal or experiment is created.')}</p></>
 }else{
   const selected=values[0]??0,revealed=values[1]===1,mixed=values[2]===1
   content=<><div className="learn-stage-rail" role="group" aria-label={t('Explore the example')}>{items.map((item,i)=><button type="button" key={i} aria-pressed={selected===i} onClick={()=>change([i,0,mixed?1:0],false)}><span className="learn-node">{number(i+1)}</span><span>{item}</span></button>)}</div>
   <div className="learn-workbench"><span className="text-sm text-muted">{items[selected]}</span>{kind==='fade'&&selected>0&&<p className="py-4"><TeachingText text={panels[selected]}/></p>}{!revealed&&<p className="py-4">{kind==='fade'?t('Try this step privately, then reveal the worked reasoning.'):t('Think about this stage before revealing its explanation.')}</p>}<Button onClick={()=>change([selected,revealed?0:1,mixed?1:0])}>{t(revealed?'Hide worked reasoning':'Reveal worked reasoning')}</Button>{revealed&&<p role="status" className="learn-feedback"><TeachingText text={kind==='fade'&&selected>0?copy.explanation:panels[selected]}/></p>}</div>
   {kind==='contrast'&&<><Button aria-pressed={mixed} onClick={()=>change([selected,revealed?1:0,mixed?0:1])}>{t(mixed?'Show grouped practice':'Show mixed practice')}</Button><div className="learn-practice-set" aria-label={t(mixed?'Mixed practice example':'Grouped practice example')}>{(mixed?[0,1,1,0]:[0,0,1,1]).map((n,i)=><span key={i} className={n?'learn-case-b':'learn-case-a'}><b>{number(i+1)}</b>{items[n]}</span>)}</div></>}
   </>
 }
 return <section className="learn-interaction" data-learn-interaction={kind} aria-label={t('Interactive example')}><p className="mb-5 leading-relaxed text-muted">{copy.instruction}</p><div className="flex flex-col gap-5">{content}</div><div className="mt-5 border-t border-line pt-3"><Button variant="ghost" onClick={()=>onChange([])}>{t('Reset this example')}</Button></div></section>
}
