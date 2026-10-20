import { useLanguage } from '../../i18n'

/** A frontal room: the route stays below the furniture, never through it. */
export function MemoryRoom({active}:{active:boolean}):React.JSX.Element {
 const language=useLanguage()
 return <svg className={'field-ink memory-room '+(active?'memory-room-replay':'')} viewBox="0 0 720 300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
  <rect className="memory-wall" x="12" y="12" width="696" height="274" rx="18"/>
  <path className="memory-floor" d="M13 232H707V268Q707 286 689 286H30Q13 286 13 268Z"/>
  <g className="memory-place memory-place-0">
   <path className="field-paper" d="M54 232V47H173V232M65 232V58H162V232"/>
   <path className="memory-detail" d="M80 75H146V214H80Z"/><circle cx="148" cy="153" r="4"/>
   <g className="memory-object memory-key"><path d="M113 88V100"/><circle className="field-paper" cx="113" cy="116" r="15"/><path d="M113 131V176H127M113 159H125M113 169H122"/></g>
  </g>
  <g className="memory-place memory-place-1">
   <rect className="field-paper" x="281" y="164" width="158" height="14" rx="5"/>
   <path d="M295 178V231M425 178V231M295 192H425"/>
   <g className="memory-object memory-leaf"><path className="memory-leaf-fill" d="M340 155Q326 117 381 108Q394 147 340 155ZM340 155L370 120M354 141L352 126M354 141L373 141"/></g>
  </g>
  <g className="memory-place memory-place-2">
   <rect className="field-paper" x="542" y="52" width="126" height="112" rx="4"/>
   <path d="M550 60H660V156H550ZM605 60V156M550 107H660"/>
   <path className="memory-detail" d="M559 91L581 69M566 98L590 74"/>
   <rect className="field-paper" x="531" y="165" width="148" height="12" rx="3"/>
   <g className="memory-object memory-cup"><path className="field-paper" d="M583 130H619V148Q619 163 601 163Q583 163 583 148ZM619 134H628Q642 145 619 151"/><path d="M577 164H630"/></g>
  </g>
  <path className="memory-route-base" d="M113 259H605"/>
  <path className="memory-route" d="M113 259H605"/>
  {[113,360,605].map((x,i)=><g className={'memory-stop memory-stop-'+i} key={x}><circle className="field-paper" cx={x} cy="259" r="13"/><text x={x} y="264" textAnchor="middle" stroke="none" fill="currentColor" fontSize="14" fontFamily="sans-serif">{new Intl.NumberFormat(language).format(i+1)}</text></g>)}
 </svg>
}
