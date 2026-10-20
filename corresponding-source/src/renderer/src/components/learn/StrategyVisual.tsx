import { useState, type ReactNode } from 'react'
import { STRATEGY_VISUALS, strategySceneText, type StrategySceneId, type StrategyVisualId } from '@core/strategyVisuals'
import { t, useLanguage } from '../../i18n'
import { FieldVisual } from './FieldVisual'
import { PrincipleVisual } from './PrincipleVisual'
import './strategyVisual.css'
import { ReadingExample } from './ReadingExample'

function Ink({children}:{children:ReactNode}):React.JSX.Element {return <svg viewBox="0 0 220 160" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{children}</svg>}
function Sheet({children}:{children?:ReactNode}):React.JSX.Element {return <><rect className="strategy-paper" x="62" y="18" width="96" height="126" rx="6"/><path d="M77 36H141M77 48H126"/>{children}</>}
function Symbols({gap=false}:{gap?:boolean}):React.JSX.Element {return <><circle cx="86" cy="77" r="9"/>{gap?<rect className="strategy-gap" x="110" y="67" width="19" height="19" rx="3"/>:<path d="M109 85L119 67L129 85Z"/>}<path d="M78 104H96V122H78ZM110 105H140M110 118H132"/></>}
function Calendar():React.JSX.Element {return <><rect className="strategy-paper" x="38" y="25" width="144" height="112" rx="9"/><path d="M38 53H182M72 15V36M148 15V36M86 53V137M134 53V137M38 95H182"/></>}
function KeySteps({children,label}:{children:ReactNode;label:string}):React.JSX.Element {return <div className="strategy-scene">{children}<p>{label}</p></div>}
function Tailored({id,compact=false}:{id:StrategySceneId;compact?:boolean}):React.JSX.Element {
 const language=useLanguage(),copy=strategySceneText(id,language),labels=copy.labels.split('¦'),[replay,setReplay]=useState(0)
 if(id==='contrast'||id==='example')return <figure className={'strategy-visual'+(compact?' strategy-compact':'')} data-strategy-scene={id}><div aria-hidden="true"><ReadingExample kind={id==='contrast'?'compare':'support'}/></div>{!compact&&<figcaption>{copy.caption}</figcaption>}</figure>
 const cells:ReactNode[]=id==='question'?[
  <Ink><rect className="strategy-paper" x="24" y="50" width="66" height="74" rx="5"/><rect className="strategy-paper" x="131" y="26" width="66" height="74" rx="5"/><text x="57" y="97">A</text><text x="164" y="73">B</text></Ink>,
  <Ink><circle cx="40" cy="85" r="22"/><circle cx="180" cy="85" r="22"/><path className="strategy-flow" d="M65 85H155M145 76L155 85L145 94"/><text x="110" y="68">?</text><text x="40" y="91">A</text><text x="180" y="91">B</text></Ink>,
  <Ink><path className="strategy-flow" d="M35 85H185M175 76L185 85L175 94"/><rect className="strategy-paper strategy-highlight" x="78" y="46" width="64" height="78" rx="6"/><path d="M91 65H128M91 77H119M91 89H128M91 101H115"/></Ink>
 ]:id==='adjust'?[
  <Ink><Sheet/><Symbols gap/></Ink>,
  <Ink><circle cx="105" cy="74" r="39"/><rect className="strategy-gap" x="92" y="62" width="26" height="26" rx="3"/><path d="M136 104L169 137"/><path className="strategy-highlight" d="M96 83L105 66L114 83Z"/></Ink>,
  <Ink><path d="M20 122H200M30 116V128M190 116V128"/><rect className="strategy-gap" x="160" y="62" width="29" height="42" rx="4"/><rect className="strategy-paper strategy-highlight" x="76" y="62" width="29" height="42" rx="4"/><path className="strategy-flow" d="M169 49Q127 18 86 49M94 36L86 49L100 49"/><path d="M82 77H99M82 87H93"/></Ink>
 ]:id==='feedback'?[
  <Ink><path d="M35 33H185V57H35ZM53 33V46M72 33V42M91 33V46M110 33V42M129 33V46M148 33V42M167 33V46"/><text x="90" y="112" className="strategy-number">12</text><path className="strategy-gap" d="M124 114H169"/></Ink>,
  <Ink><rect className="strategy-paper" x="32" y="20" width="156" height="54" rx="9"/><text x="110" y="56">cm</text><path className="strategy-flow" d="M110 79V120M101 109L110 120L119 109"/><path className="strategy-gap" d="M79 135H141"/></Ink>,
  <Ink><Sheet/><text x="110" y="97" className="strategy-number strategy-answer">12 cm</text></Ink>
 ]:id==='prediction'?[
  <Ink><Sheet/><Symbols/></Ink>,
  <Ink><Sheet/><Symbols gap/></Ink>,
  <Ink><Sheet/><Symbols gap/><circle className="strategy-highlight" cx="120" cy="77" r="24"/><path className="strategy-flow" d="M148 82L185 103M173 104L185 103L180 92"/></Ink>
 ]:id==='delay'?[
  <Ink><path className="strategy-paper" d="M25 44Q68 30 110 47Q152 30 195 44V126Q152 112 110 129Q68 112 25 126ZM110 47V129"/><path d="M40 61L91 66M40 75L91 80M130 66L180 61M130 80L180 75"/></Ink>,
  <Ink><Calendar/><circle cx="62" cy="75" r="7"/><circle className="strategy-gap" cx="158" cy="115" r="7"/><path className="strategy-flow" d="M74 76Q139 67 154 100"/></Ink>,
  <Ink><Sheet/><path className="strategy-gap" d="M80 79H140M80 96H126"/><path className="strategy-flow" d="M172 54Q205 78 182 112M180 100L182 112L194 107"/></Ink>
 ]:id==='restart'?[
  <Ink><Sheet/><path d="M78 71H141M78 86H132"/><path className="strategy-gap" d="M78 110H139"/><path className="strategy-highlight" d="M142 89H154V127L148 121L142 127Z"/></Ink>,
  <Ink><path className="strategy-paper" d="M45 42H175V130H45Z"/><path className="strategy-flow" d="M67 86H147M137 77L147 86L137 95"/><path d="M72 107H139"/><path d="M76 32V20M147 32V20"/></Ink>,
  <Ink><Sheet/><path d="M78 71H141M78 86H132"/><path className="strategy-highlight" d="M78 110H139M142 89H154V127L148 121L142 127Z"/><path d="M171 98L194 75L201 82L178 105L168 109Z"/></Ink>
 ]:id==='feasible'?[
  <Ink><Calendar/><rect className="strategy-highlight" x="89" y="58" width="40" height="31" rx="3"/><path d="M96 68H122M96 78H114"/></Ink>,
  <Ink><path className="strategy-flow" d="M35 80H95Q110 80 119 68L162 29M95 80Q110 80 119 94L162 133M150 30L162 29L162 42M150 132L162 133L162 120"/><path className="strategy-gap" d="M174 23H204M174 35H194"/><path className="strategy-highlight" d="M174 129H204"/></Ink>,
  <Ink><rect className="strategy-paper" x="62" y="51" width="96" height="64" rx="5"/><path className="strategy-highlight" d="M80 82H139"/></Ink>
 ]:[
  <Ink><path d="M65 26H137V103H65ZM57 103H151V116H57ZM68 116V144M137 116V144M146 82H166V116M166 92H148"/></Ink>,
  <Ink><rect x="43" y="23" width="134" height="106" rx="6"/><path d="M110 23V129M43 76H177M28 139H192"/><circle className="strategy-tint" cx="145" cy="51" r="12"/><path d="M53 104L77 86L101 104M124 111L149 90L170 111"/></Ink>,
  <Ink><path className="strategy-paper" d="M68 55H143V100Q143 126 105 126Q68 126 68 100ZM143 63H160Q187 84 143 101"/><path d="M55 135H157M90 43Q80 33 90 23M117 43Q107 33 117 23"/></Ink>
 ]
 return <figure className={'strategy-visual strategy-'+id+(compact?' strategy-compact':'')} data-strategy-scene={id}><div key={replay} className={'strategy-scenes '+(replay?'strategy-replay':'')} aria-hidden="true">{cells.map((cell,i)=><KeySteps key={i} label={labels[i]}>{cell}</KeySteps>)}</div>{!compact&&<><figcaption>{copy.caption}</figcaption>{id!=='accessible'&&<button className="visual-compare" type="button" onClick={()=>setReplay(n=>n+1)}>{t('Replay the illustration')}</button>}</>}</figure>
}
export function StrategyVisual({id,compact=false}:{id:StrategyVisualId;compact?:boolean}):React.JSX.Element {
 const visual=STRATEGY_VISUALS[id]
 return <div data-strategy-visual={id}>{visual.type==='principle'?<PrincipleVisual id={visual.id} compact={compact}/>:visual.type==='field'?<FieldVisual id={visual.id} compact={compact}/>:<Tailored id={visual.id} compact={compact}/>}</div>
}
