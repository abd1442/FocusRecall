import { useState } from 'react'
import type { LegacyLessonId } from '@core/learn'
import { t } from '../../i18n'
import { ReadingExample } from './ReadingExample'

export const ideaTitle:Record<LegacyLessonId,string>={familiarity:'Familiar ≠ remembered',retrieve:'Recall, then check',spacing:'Give ideas another day',explain:'Connect the steps',examples:'Support, then independence',feedback:'Make feedback usable',mix:'Practice choosing a method',reflect:'A small plan can change'}
const captions:Record<LegacyLessonId|'attention'|'rest',string>={
 attention:'Give the task a clear space. Park unrelated thoughts somewhere you can return to.',
 rest:'A break is a chance to recover. Choose something accessible and return with one small step.',
 familiarity:'Seeing the notes and recalling without them are different experiences.',
 retrieve:'An attempt reveals gaps. Checking gives you something to repair.',
 spacing:'The same number of study occasions, arranged differently. No retention prediction.',
 explain:'A useful explanation connects steps with reasons, not just more words.',
 examples:'Keep an example nearby, then remove support as the task becomes manageable.',
 feedback:'Specific feedback points to a change you can try on the next attempt.',
 mix:'Related tasks can look similar but need different methods. Mix them after learning the basics.',
 reflect:'Choose one manageable action, notice what happened, and adjust. A plan is not a learning score.'
}
const descriptions:Partial<Record<LegacyLessonId,string>>={
 familiarity:'Illustration: notes show three shapes; recalling with the notes closed leaves a gap.',
 retrieve:'Illustration: an attempt has a missing triangle; the notes reveal it; the next attempt includes it.',
 spacing:'Illustration: four visits cluster at the start of one timeline and are separated on another.',
 explain:'Example: identify a claim, find its evidence, then explain how the evidence supports the claim.',
 examples:'Example: a passage has a completed explanation, then a missing link, then space for an independent explanation.',
 feedback:'Example: a measurement says 12 without a unit. Feedback identifies the omission; the next attempt says 12 centimetres.',
 mix:'Example: the same passage can be summarized or evaluated. Choose whether the task asks for the main idea or an assessment of its evidence.',
 reflect:'Example: the plan is to explain one step; an attempt reveals repetition without a reason; the next plan adds a worked example for comparison.'
}
// Original local artwork. Shapes stand for ideas, never a quantity of memory.
function Note({gap=false,repair=false,closed=false}:{gap?:boolean;repair?:boolean;closed?:boolean}):React.JSX.Element {
 return <svg className="idea-note" viewBox="0 0 160 140" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path className="paper-fill" d="M30 12H116L132 28V126H30Z"/><path d="M116 12V28H132M42 12V126"/>{closed?<><path d="M61 47Q93 35 114 49V87Q90 73 61 87Z"/><path d="M87 43V81"/></>:<><circle cx="67" cy="45" r="9"/>{gap?<rect className={repair?'repaired-ink':'missing-ink'} x="58" y="64" width="18" height="18" rx="3"/>:<path d="M58 82L67 64L76 82Z"/>}<path d="M58 100H76V117H58ZM89 45H116M89 73H116M89 108H110"/>{repair&&<path className="repaired-ink" d="M60 79L67 66L74 79Z"/>}</>}</svg>
}
function Arrow():React.JSX.Element {return <span className="idea-arrow" aria-hidden="true">→</span>}
function Scene({label,children}:{label:string;children:React.ReactNode}):React.JSX.Element {return <div className="idea-scene">{children}<span className="idea-scene-label">{t(label)}</span></div>}
function Spacing({replay}:{replay:number}):React.JSX.Element {
 // Same four study occasions on a seven-day ruler: piled into one day, or spread
 // out with room between visits. No retention prediction is drawn.
 const day=(d:number):number=>18+d*41
 const lane=(spread:boolean):React.JSX.Element=>{
  const xs=spread?[0,2,4,6].map(d=>day(d)-11):[0,1,2,3].map(i=>day(0)-11+i*7)
  return <svg className={`sp-track ${spread?'sp-spread':''}`} viewBox="0 0 290 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
   <path className="sp-rule" d="M6 56H284"/>{[0,1,2,3,4,5,6].map(d=><path key={d} className="sp-tick" d={`M${day(d)} 52V60`}/>)}
   {spread&&[0,2,4].map(d=><path key={d} className="sp-return" d={`M${day(d)+12} 14Q${day(d+1)} 0 ${day(d+2)-12} 14`}/>)}
   {xs.map((x,i)=><g key={i} className="sp-card" style={{'--from':`${spread?day(0)-11+i*7-x:0}px`,'--i':i} as React.CSSProperties}><rect x={x} y={spread?16:16-i*3} width="22" height="30" rx="3"/><path d={`M${x+6} ${(spread?16:16-i*3)+10}H${x+16}M${x+6} ${(spread?16:16-i*3)+17}H${x+13}`}/></g>)}
  </svg>}
 return <div className="spacing-story sp-story" key={replay}>{[false,true].map(spread=><div key={String(spread)} className="sp-lane"><span className="idea-scene-label">{t(spread?'Across days':'In one day')}</span>{lane(spread)}</div>)}<div className="spacing-key"><span className="spacing-key-mark"/>{t('Four visits. Room between them.')}</div></div>
}
function Feedback():React.JSX.Element {
 return <div className="feedback-story"><Scene label="Attempt"><div className="measurement" dir="ltr"><svg viewBox="0 0 140 48"><path d="M15 10H125V38H15ZM30 10V24M45 10V20M60 10V24M75 10V20M90 10V24M105 10V20"/></svg><strong>12 <span className="unit-gap">?</span></strong></div></Scene><div className="feedback-note"><span>{t('Check the unit.')}</span><svg viewBox="0 0 120 40"><path d="M5 10Q60 45 110 10M98 10H110V22"/></svg></div><Scene label="Next attempt"><div className="measurement" dir="ltr"><svg viewBox="0 0 140 48"><path d="M15 10H125V38H15ZM30 10V24M45 10V20M60 10V24M75 10V20M90 10V24M105 10V20"/></svg><strong>12 <em>cm</em></strong></div></Scene></div>
}
function Planning():React.JSX.Element {
 return <div className="planning-example"><div className="planning-cards"><Scene label="Plan"><div className="plan-slip">{t('Explain one step.')}</div></Scene><Arrow/><Scene label="Notice"><div className="plan-observation">{t('I can repeat it, but not explain why.')}</div></Scene><Arrow/><Scene label="Adjust"><div className="plan-slip plan-adjusted">{t('Compare with a worked example.')}</div></Scene></div><div className="plan-return" aria-hidden="true">↶</div></div>
}
/** A visual argument first, optional depth in Learn. No answers or scores. */
export function PrincipleVisual({id,compact=false}:{id:LegacyLessonId|'attention'|'rest';compact?:boolean}):React.JSX.Element {
 const [replay,setReplay]=useState(0)
 return <figure className={`principle-visual principle-${id} ${compact?'principle-compact':''}`} data-principle={id}><div className="principle-drawing" aria-hidden="true">
 {id==='spacing'?<Spacing replay={replay}/>
 :id==='familiarity'?<div className="familiarity-story"><Scene label="With the notes"><div className="notes-and-thought"><Note/><div className="idea-thought"><span>● △ ■</span></div></div></Scene><span className="idea-versus">≠</span><Scene label="Without the notes"><div className="notes-and-thought"><Note closed/><div className="idea-thought"><span>● <i>?</i> ■</span></div></div></Scene></div>
 :id==='retrieve'?<div className="retrieval-story"><Scene label="Attempt"><Note gap/></Scene><Arrow/><Scene label="Check"><div className="check-overlay"><Note/><span>△</span></div></Scene><Arrow/><Scene label="Repair"><Note gap repair/></Scene></div>
 :id==='explain'?<ReadingExample kind="reason"/>:id==='examples'?<ReadingExample kind="support"/>:id==='feedback'?<Feedback/>:id==='mix'?<ReadingExample kind="compare"/>:id==='reflect'?<Planning/>
 :id==='attention'?<div className="attention-story"><Scene label="Study task"><Note/></Scene><div className="attention-divide"/><Scene label="Park for later"><div className="parked-notes"><span>…</span><span>…</span><span>…</span></div></Scene></div>
 :<div className="rest-story"><Scene label="Step away"><svg viewBox="0 0 120 100"><path d="M30 73H90M38 66V34H80V50Q80 66 65 66ZM80 37H90Q105 50 80 54M50 25Q42 17 50 8M66 25Q58 17 66 8"/></svg></Scene><Arrow/><Scene label="Return gently"><div className="return-book"><Note/><span>↶</span></div></Scene></div>}
 </div>{!compact&&<><figcaption>{t(captions[id])}</figcaption>{id!=='attention'&&id!=='rest'&&<p className="sr-only">{t(descriptions[id]!)}</p>}{id==='spacing'&&<button type="button" className="visual-compare" onClick={()=>setReplay(v=>v+1)}>{t('Replay spacing')}</button>}</>}</figure>
}
