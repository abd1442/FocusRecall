export function ContextVisual({labels,replay}:{labels:string[];replay:number}):React.JSX.Element {
 return <div className={'context-scenes '+(replay?'context-replay':'')}>{labels.slice(0,3).map((label,i)=><div key={label} className="context-scene" style={{'--context-step':i} as React.CSSProperties}><svg className="field-ink" viewBox="0 0 240 210" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
  <rect className="field-paper" x="12" y="15" width="216" height="180" rx="12"/>
  {i===0?<><path d="M28 37H78V98H28ZM53 37V98M28 67H78M28 111H85"/><path d="M178 112V67L204 50M197 44L215 57L193 71Z"/></>:i===1?<><path d="M28 52H89V103H28ZM35 44H82M37 37H79"/><path d="M168 102V56H210V102M182 56V102M196 56V102"/></>:<><circle cx="120" cy="48" r="16"/><path d="M120 37V48L128 53M48 98H73M175 98H199"/></>}
  <path d="M34 154H206M49 154V184M192 154V184"/>
  <g className="context-idea"><rect className="field-paper" x="87" y="90" width="66" height="62" rx="4"/>{i===2?<><path className="sample-gap" d="M103 111H137M103 125H128"/><path d="M96 102L144 142"/></>:<><path d="M100 105H139M100 115H131"/><path className="field-green" d="M103 137L115 122L127 137ZM131 130H141"/></>}</g>
  {i===2&&<path className="field-purple" d="M174 128Q200 111 208 130M201 123L208 130L198 133"/>}
 </svg><p>{label}</p></div>)}</div>
}
