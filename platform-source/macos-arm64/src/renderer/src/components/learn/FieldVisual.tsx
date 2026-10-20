import { useState, type ReactNode } from 'react'
import { expansionText, type ExpansionId } from '@core/learnExpansion'
import { t, useLanguage } from '../../i18n'
import './fieldVisual.css'
import { PracticeScenes } from './PracticeScenes'
import { MemoryRoom } from './MemoryRoom'
import { ContextVisual } from './ContextVisual'
import { CompletionVisual } from './CompletionVisual'

function Ink({children,viewBox='0 0 360 220',className=''}:{children:ReactNode;viewBox?:string;className?:string}):React.JSX.Element {
 return <svg className={'field-ink '+className} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
function Leaf({x=0,y=0}:{x?:number;y?:number}):React.JSX.Element{return <g transform={`translate(${x} ${y})`}><path d="M0 12Q-18 5-14-7Q0-8 0 4Q4-12 17-12Q20 1 2 5M0 4V22"/></g>}
function Book():React.JSX.Element{return <g><path className="field-paper" d="M-45-35Q-20-43 0-28Q20-43 45-35V34Q20 26 0 40Q-20 26-45 34ZM0-28V40"/><path d="M-34-20L-12-15M-34-7L-12-2M12-15L34-20M12-2L34-7"/></g>}
function Chunking({labels,replay}:{labels:string[];replay:number}):React.JSX.Element {
 const symbols=[...t('Claim · evidence · explanation').split(' · '),...t('Question · attempt · check').split(' · '),...t('Plan · action · review').split(' · ')]
 return <div className={'chunk-comparison '+(replay?'chunk-replay':'')} key={replay}>{[false,true].map(grouped=><div key={String(grouped)}><div className={'chunk-field '+(grouped?'chunk-grouped':'chunk-scattered')} dir="ltr">{symbols.map((s,i)=><span key={i} style={{'--x':i%3,'--y':Math.floor(i/3),'--scatter-x':(i*2)%3,'--scatter-y':(i+Math.floor(i/3))%3,'--tilt':`${(i%3-1)*12}deg`} as React.CSSProperties}>{s}</span>)}</div><p>{labels[grouped?1:0]}</p></div>)}</div>
}
function Routes({alternate=false,wide=false}:{alternate?:boolean;wide?:boolean}):React.JSX.Element {
 return <Ink className={`route-map ${alternate?'route-alternate':''}`}><path className="map-grid" d="M30 50H330M30 110H330M30 170H330M90 25V195M180 25V195M270 25V195"/><path className="route-old" d="M55 170V50H290V170H305"/><path className="route-new" d={wide?'M55 170L125 115L220 160L305 170':'M55 170H305'}/><circle className="field-paper" cx="55" cy="170" r="9"/><circle className="field-paper" cx="305" cy="170" r="9"/>{wide&&<><path className="route-possibility" d="M55 170L180 50L305 170M55 170L145 190L260 80L305 170"/><circle cx="180" cy="50" r="4"/><circle cx="260" cy="80" r="4"/></>}</Ink>
}
function Workspace({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="workbench-comparison">{[false,true].map(clear=><div key={String(clear)}><Ink><path d="M25 171H335M50 171V209M310 171V209"/><path className="workbench-space" d="M70 31Q180 4 290 31V147H70Z"/>{(clear?[0]:[0,1,2,3,4]).map((v)=><g key={v} transform={`translate(${clear?139:85+(v%3)*65} ${clear?65:48+Math.floor(v/3)*52}) rotate(${clear?0:(v%2?9:-8)})`}><path className="field-paper" d="M0 0H62V72H0Z"/><path d="M12 18H49M12 30H40M12 42H48"/></g>)}{clear&&<g className="field-green"><path className="field-paper" d="M220 154L310 154L323 178H230Z"/><path d="M238 161H299M243 168H306"/><path d="M175 142Q178 164 214 165"/></g>}</Ink><p>{labels[clear?1:0]}</p></div>)}</div>
}
function Incubation({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="incubation-comparison"><div className="lens-scene"><Ink><circle className="lens-glass" cx="151" cy="100" r="70"/><path className="route-old" d="M104 144V65H190"/><path d="M201 150L252 201M210 143L261 192"/><path className="map-grid" d="M100 95H200M150 48V150"/></Ink><p>{labels[0]}</p></div><div><Routes alternate wide/><p>{labels[1]}</p></div><span className="field-return">↶ <span>{labels[2]}</span></span></div>
}
function Starting({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="starting-story"><div><Ink><path className="field-paper" d="M90 205V28H268V205ZM109 28V205"/>{[0,1,2,3,4,5].map(i=><path key={i} d={`M128 ${52+i*25}H247M128 ${61+i*25}H214`}/>)}<path className="field-purple" d="M62 205V172H81M62 172L71 181M62 172L53 181"/></Ink><p>{labels[0]}</p></div><div><Ink><path d="M60 201H308M77 175V200M126 175V200M74 115V175H132M65 115H94M128 145V175"/><path className="field-paper" d="M170 136L287 136L300 176H182Z"/><path className="field-green first-move" d="M192 151H260M197 161H236"/><path className="field-purple" d="M137 105Q160 72 202 105M190 104H202V92"/></Ink><p>{labels[1]} <span className="idea-arrow" aria-hidden="true">→</span> {labels[2]}</p></div></div>
}
function Sleep({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="sleep-sequence">{labels.map((label,i)=><div key={label}><Ink viewBox="0 0 180 170">{i===1?<><path className="night-disc" d="M114 27A49 49 0 1 0 132 108A44 44 0 0 1 114 27Z"/><path className="field-purple" d="M139 28V42M132 35H146M151 73V81M147 77H155"/><path d="M36 142H145"/></>:<><circle cx="90" cy="39" r="12"/><path d="M90 17V10M68 39H61M112 39H119M74 23L69 18M106 23L111 18"/><g transform="translate(90 103) scale(.8)"><Book/></g>{i===2&&<path className="field-green" d="M119 82A38 38 0 1 0 125 123M119 82V99H103"/>}</>}</Ink><p>{label}</p></div>)}</div>
}
function Transfer({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="transfer-story"><div className="transfer-pair">{[false,true].map(seats=><div key={String(seats)}><Ink viewBox="0 0 260 200">{[0,1,2].map(row=><g key={row} transform={`translate(24 ${25+row*57})`}>{!seats&&<path className="field-paper" d="M0 16H210L200 39H10Z"/>}{[0,1,2,3].map(col=><g key={col} transform={`translate(${28+col*50} 9)`} className={row===1?'field-purple':'field-green'}>{seats?<path d="M-13-12H13V10H-13ZM-16 10H16V17H-16ZM-12 17V28M12 17V28"/>:<Leaf/>}</g>)}</g>)}</Ink><p>{labels[seats?1:0]}</p></div>)}</div><div className="shared-relationship"><span dir="ltr">3 × 4 = 12</span><p>{labels[2]}</p></div></div>
}
/** Original semantic illustrations; all meaning is present before interaction. */
export function FieldVisual({id,compact=false}:{id:ExpansionId;compact?:boolean}):React.JSX.Element {
 const language=useLanguage(),copy=expansionText(id,language),labels=copy.labels.split('¦'),[replay,setReplay]=useState(0),[alternate,setAlternate]=useState(false)
 return <figure className={`field-visual field-${id} ${compact?'field-compact':''}`} data-principle={id}>
  <div className="field-stage" aria-hidden="true" key={replay}>
   {id==='forgetting'||id==='motivation'||id==='targeted'||id==='pressure'||id==='methods'?<CompletionVisual id={id} labels={labels} replay={replay}/>:id==='context'?<ContextVisual labels={labels} replay={replay}/>:['exam','difficulty','together','switching','sources'].includes(id)?<PracticeScenes id={id} labels={labels} replay={replay}/>:id==='chunking'?<Chunking labels={labels} replay={replay}/>:id==='workspace'?<Workspace labels={labels}/>:id==='incubation'?<Incubation labels={labels}/>:id==='mentalset'?<><Routes alternate={alternate}/><div className={'route-legend '+(alternate?'legend-alternate':'')}><span>{labels[0]}</span><span>{labels[1]}</span></div></>:id==='starting'?<Starting labels={labels}/>:id==='palace'?<><MemoryRoom active={replay>0}/><div className="palace-legend" dir="ltr">{labels.slice(0,3).map((l,i)=><span key={l} dir="auto"><b>{new Intl.NumberFormat(language).format(i+1)}</b>{l}</span>)}</div></>:id==='sleep'?<Sleep labels={labels}/>:<Transfer labels={labels}/>}
  </div>
  {!compact&&<><figcaption>{copy.caption}</figcaption>{id==='targeted'&&<p className="sr-only">{t('Example: a passage lacks its source. Check where the claim comes from, then try identifying the source in a new passage.')}</p>}{['chunking','palace','mentalset','together','switching','context','forgetting','targeted'].includes(id)&&<button className="visual-compare" type="button" {...(id==='mentalset'?{'aria-pressed':alternate}:{})} onClick={()=>{setReplay(n=>n+1);setAlternate(v=>!v)}}>{labels.at(-1)}</button>}</>}
 </figure>
}
