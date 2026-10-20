export const subjectPanelStyle=(color:string):React.CSSProperties=>({'--panel-colour':color} as React.CSSProperties)

/** Chosen concept: perforated edge plus a low-opacity inset footer rule. */
export function SubjectCardAccent():React.JSX.Element {
  return <><span aria-hidden="true" data-perforated-edge className="subject-perforations pointer-events-none absolute right-0 top-6 bottom-6 w-[3px]"/><span aria-hidden="true" data-whisper-rule className="pointer-events-none absolute bottom-[13px] left-6 right-6 h-[2px] rounded-full" style={{background:'var(--panel-colour)',opacity:.28}}/></>
}
