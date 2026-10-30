import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'

export function AppVersion():React.JSX.Element {
  const [version,setVersion]=useState('')
  useEffect(()=>{let alive=true;void window.api.invoke('app:version').then(v=>{if(alive)setVersion(v)}).catch(()=>{if(alive)setVersion('unavailable')});return()=>{alive=false}},[])
  return <span className="text-xs text-muted" aria-label={uiText("A14 Pomodoro version")}>{version?uiText("Version {value0}", {value0: (version)}):uiText("Checking version…")}</span>
}
