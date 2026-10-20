import type { AdviceTopic } from '@core/adviceCatalog'

/** A lightweight visual cue, not a chart of measured benefit or personal results. */
export function AdviceSketch({topic}:{topic:AdviceTopic}):React.JSX.Element {
  const paper=<><rect x="12" y="18" width="40" height="52" rx="5"/><path d="M22 31H42M22 41H36M22 51H40"/></>
  return <svg aria-hidden="true" className="advice-sketch" viewBox="0 0 144 88" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {topic==='rest'?<><path d="M17 62H65M24 31H56V49Q56 59 40 59Q24 59 24 49ZM56 35H64Q78 45 56 49M33 21V13M46 21V13"/><path d="M84 33H129V67H84ZM106 33V67M91 43H99M114 43H122"/></>
    :topic==='spacing'?<><rect x="12" y="19" width="120" height="54" rx="7"/><path d="M12 34H132M35 12V25M108 12V25"/>{[30,72,114].map(x=><circle key={x} cx={x} cy="54" r="6"/>)}</>
    :topic==='attention'?<>{paper}<path d="M77 21H128V70H77ZM87 35H118M87 46H108M87 57H115M59 44H69"/><path d="M61 39L67 44L61 49"/></>
    :topic==='planning'?<>{paper}<path d="M23 59L28 64L39 53M74 44H94M87 37L94 44L87 51"/><rect x="103" y="29" width="28" height="32" rx="4"/><path d="M110 44H124"/></>
    :topic==='feedback'||topic==='metacognition'?<>{paper}<circle cx="105" cy="43" r="24"/><path d="M94 43L102 51L117 33M61 43H72"/>{topic==='metacognition'&&<path d="M93 73H117"/>}</>
    :topic==='examples'?<>{paper}<path d="M73 25H128V69H73ZM84 36H117M84 47H106M84 58H116M59 43H66"/><path d="M73 16H128"/></>
    :topic==='understanding'?<><circle cx="32" cy="44" r="19"/><circle cx="112" cy="44" r="19"/><path d="M53 44H90M82 36L90 44L82 52M27 38H37M27 49H34M107 38H117M107 49H114"/></>
    :<>{paper}<rect x="91" y="18" width="40" height="52" rx="5"/><path d="M101 31H121M101 42H114M101 53H119M61 44H82M75 37L82 44L75 51"/><path d="M104 60L109 65L120 54"/></>}
  </svg>
}
