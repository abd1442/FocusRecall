export type RendererRole = 'main'|'panel'|'reasons'|'capture'
const common = ['appearance:get','session:get','settings:getAll','reasons:counts']
const helpers: Record<Exclude<RendererRole,'main'>,readonly string[]> = {
  panel:['advice:choose','advice:less','advice:reset','preparation:get','preparation:begin','preparation:confirm','preparation:cancel','window:showMain','session:toggleDistracted','ui:openSwitch','session:finish','panel:close','panel:hover','rest:endEarly','rest:startNextBlock','capture:open','settings:set','library:listPickerItems','shell:open'],
  reasons:['popup:ready','reasons:counts','reasons:hide','distraction:label','session:longAbsence'],
  capture:['popup:ready','capture:close','capture:mark']
}
export function roleCanInvoke(role:RendererRole,channel:string,args:unknown[]):boolean {
  if(role==='main')return true
  if(role==='panel'&&['session:quickAction','session:finishStudying'].includes(channel))return true
  if(!common.includes(channel)&&!helpers[role].includes(channel))return false
  if(channel==='settings:set')return role==='panel'&&args[0]==='panelExpanded'
  if(channel==='popup:ready')return args[0]===role
  // Preparation's only external destination is a research source, not a local file.
  if(channel==='shell:open')return typeof args[0]==='string'&&/^https:\/\//i.test(args[0])
  return true
}
export function trustedPage(url:string,expected:string):boolean {
  try {
    const actual=new URL(url),allowed=new URL(expected)
    return actual.href===allowed.href
  } catch {return false}
}
export function targetKind(target:string):'url'|'path' {
  if(!target || target.length>8192 || /[\u0000-\u001f\u007f]|%0[ad]/i.test(target))throw Error('Invalid external destination.')
  if(/^[a-z]:[\\/]/i.test(target)){
    if(target.slice(2).includes(':'))throw Error('File streams are not supported.')
    if(target.split(/[\\/]/).some(segment=>/[ .]$/.test(segment)))throw Error('Ambiguous Windows paths are not supported.')
    if(!/\.(?:pdf|txt|md|markdown|rtf|docx|xlsx|pptx|csv|epub|png|jpe?g|gif|webp|bmp|mp3|wav|ogg|m4a|mp4|webm|mov)$/i.test(target))throw Error('Only supported document and media resources can be opened from A14 Pomodoro.')
    return 'path'
  }
  const url=new URL(target)
  if(!['http:','https:','obsidian:','notion:','spotify:','mailto:'].includes(url.protocol)||url.username||url.password)throw Error('Unsupported external destination.')
  return 'url'
}
export const REPORT_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"
export const safeReportHtml = (html:string):string => `<meta http-equiv="Content-Security-Policy" content="${REPORT_CSP}">${html}`
