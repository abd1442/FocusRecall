import type { ReactNode } from 'react'
import type { ExpansionId } from '@core/learnExpansion'
import './practiceScenes.css'

function Drawing({children}:{children:ReactNode}):React.JSX.Element {
 return <svg className="field-ink" viewBox="0 0 300 180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
function Paper({x=0,y=0,children}:{x?:number;y?:number;children?:ReactNode}):React.JSX.Element {
 return <g transform={`translate(${x} ${y})`}><rect className="field-paper" width="65" height="80" rx="4"/><path d="M12 15H53M12 25H43"/>{children}</g>
}
function Person({x,y}:{x:number;y:number}):React.JSX.Element {return <g><circle cx={x} cy={y} r="11"/><path d={`M${x-22} ${y+41}Q${x-22} ${y+15} ${x} ${y+15}Q${x+22} ${y+15} ${x+22} ${y+41}`}/></g>}
function Demand({kind}:{kind:number}):React.JSX.Element {
 return <g>{kind===0?<path d="M0 0H29V22H16L7 30V22H0ZM7 8H22M7 14H18"/>:kind===1?<><circle cx="9" cy="13" r="10"/><rect x="29" y="3" width="20" height="20"/><path d="M21 13H27"/></>:<path d="M1 7H13M7 1V13M23 3L35 15M35 3L23 15M3 26H33M3 32H33"/>}</g>
}
function Exam({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="exam-map"><div className="exam-demands">{labels.slice(0,3).map((label,i)=><div key={label}><Drawing><Paper x={100} y={20}><g transform="translate(15 40) scale(.7)"><Demand kind={i}/></g></Paper><path className="field-purple" d="M132 111V153M125 144L132 153L139 144"/></Drawing><p>{label}</p></div>)}</div><div className="exam-sample"><Drawing><rect className="field-paper" x="35" y="14" width="225" height="147" rx="7"/>{[0,1,2].map(i=><g key={i} transform={`translate(${55+i*66} 45)`}><Demand kind={i}/><path className="sample-gap" d="M0 61H40"/></g>)}<path className="field-green" d="M224 133Q269 114 280 145Q288 172 243 174M243 174L253 164M243 174L256 178"/></Drawing><p>{labels[3]}</p></div><p className="scene-footnote">↶ {labels[4]}</p></div>
}
function Difficulty({labels}:{labels:string[]}):React.JSX.Element {
 // A bridge metaphor (see the caption): solid planks are steps you have, a dashed
 // slot is one step to attempt, an empty span is too much missing, and a
 // restored plank is support put back. Shapes are filled so they read at card size.
 const slots=[66,109,152,195]
 const plan:(1|'try'|'void'|'restored')[][]=[[1,1,'try',1],[1,'void','void','void'],[1,1,'restored',1],[1,'try','restored',1]]
 const scene=(i:number):React.JSX.Element=><svg className="field-ink bridge-scene" viewBox="0 0 300 150" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
  <path className="bridge-water" d="M60 138Q82 131 104 138T148 138T192 138T236 138"/>
  <path className="bridge-ground" d="M0 108H64V150H0Z"/><path className="bridge-ground" d="M236 108H300V150H236Z"/>
  <path d="M272 108V66"/><path className="bridge-flag" d="M272 66L296 74L272 82Z"/>
  {slots.map((x,n)=>{const s=plan[i][n];return s===1?<rect key={n} className="bridge-plank" x={x} y="101" width="39" height="11" rx="2.5"/>:s==='try'?<rect key={n} className="bridge-slot" x={x+1} y="100" width="37" height="13" rx="3"/>:s==='restored'?<g key={n}><rect className="bridge-restored" x={x} y="101" width="39" height="11" rx="2.5"/><path className="bridge-restored-arrow" d={`M${x+19.5} 58V90M${x+11} 82L${x+19.5} 91L${x+28} 82`}/></g>:<rect key={n} className="bridge-void" x={x+1} y="100" width="37" height="13" rx="3"/>})}
  <circle cx="38" cy="58" r="9.5"/><path d="M38 68V88L27 106M38 88L49 106M27 77H50"/>
 </svg>
 // The card preview shows one composite bridge; the lesson shows each case.
 return <div className="difficulty-bridges">{labels.map((label,i)=><div key={label}>{scene(i)}<p>{label}</p></div>)}<div className="bridge-preview" aria-hidden="true">{scene(3)}</div></div>
}
function Together({labels,replay}:{labels:string[];replay:number}):React.JSX.Element {
 return <div className={'peer-sequence '+(replay?'peer-replay':'')}>{labels.slice(0,3).map((label,i)=><div key={label} style={{'--scene':i} as React.CSSProperties}><Drawing>{i===0?<><Person x={65} y={30}/><Person x={230} y={30}/><Paper x={30} y={90}><path d="M17 61L32 39L47 61Z"/></Paper><Paper x={195} y={90}><circle cx="32" cy="51" r="13"/></Paper></>:i===1?<><Person x={55} y={25}/><Person x={245} y={25}/><path className="peer-exchange" d="M87 41H207M196 33L207 41L196 49M207 66H87M98 58L87 66L98 74"/><Paper x={75} y={90}><path d="M16 61L32 39L48 61Z"/></Paper><Paper x={160} y={90}><circle cx="32" cy="51" r="13"/></Paper><path className="field-purple" d="M145 127H155"/></>:<><path className="field-paper" d="M20 40Q62 27 105 43Q147 27 190 40V101Q148 88 105 104Q62 88 20 101ZM105 43V104"/><path d="M35 54L85 57M35 66L85 69M125 57L175 54M125 69L175 66"/><path className="field-green" d="M193 107L216 127M205 126H216V115"/><Paper x={222} y={92}><path className="sample-gap" d="M14 54H50"/></Paper></>}</Drawing><p>{label}</p></div>)}</div>
}
function Switching({labels,replay}:{labels:string[];replay:number}):React.JSX.Element {
 return <div className={'switch-sequence '+(replay?'switch-replay':'')}>{[false,true].map(cue=><div className="switch-lane" key={String(cue)}><p>{labels[cue?1:0]}</p><Drawing><Paper x={8} y={40}><path d="M15 45H50M15 56H39"/>{cue&&<path className="field-green" d="M47 58V92L55 85L63 92V58Z"/>}</Paper><g className="field-purple"><rect className="field-paper" x="110" y="53" width="52" height="65" rx="9"/><path d="M120 68H152M120 80H142M120 92H147"/></g><Paper x={222} y={40}><path d="M15 45H50M15 56H39"/>{cue?<path className="field-green" d="M47 58V92L55 85L63 92V58Z"/>:<path className="sample-gap" d="M15 68H50"/>}</Paper><path className="switch-return" d="M75 34Q150-15 236 32M225 20L236 32L222 34"/><path d="M80 84H102M94 77L102 84L94 91M170 84H215M207 77L215 84L207 91"/></Drawing></div>)}<p className="scene-footnote">{labels[2]}</p></div>
}
function Sources({labels}:{labels:string[]}):React.JSX.Element {
 return <div className="source-network"><div><p>{labels[0]}</p><Drawing><Paper x={28} y={10}><path d="M15 45H49M15 56H40"/></Paper><Paper x={205} y={10}><path d="M15 45H49M15 56H40"/></Paper><path className="source-link" d="M60 93L135 126M237 93L163 126"/><rect className="field-paper" x="112" y="120" width="76" height="45" rx="4"/><path d="M124 135H176M124 148H164"/></Drawing><p>{labels[1]}</p></div><div className="source-investigate"><Drawing><Paper x={33} y={48}><path d="M15 45H49M15 56H40"/></Paper><path className="source-link" d="M104 88H158M147 80L158 88L147 96"/><circle className="field-paper" cx="214" cy="79" r="39"/><path className="field-green" d="M195 64H232M195 76H232M195 88H220M244 108L271 140M249 104L277 136"/><path className="sample-gap" d="M181 135H237"/></Drawing><p>{labels[2]}</p><p className="source-prompt">{labels[3]}</p></div></div>
}
/** Original diagrams. Localized captions explain their relationships without motion. */
export function PracticeScenes({id,labels,replay}:{id:ExpansionId;labels:string[];replay:number}):React.JSX.Element {
 return id==='exam'?<Exam labels={labels}/>:id==='difficulty'?<Difficulty labels={labels}/>:id==='together'?<Together labels={labels} replay={replay}/>:id==='switching'?<Switching labels={labels} replay={replay}/>:<Sources labels={labels}/>
}
