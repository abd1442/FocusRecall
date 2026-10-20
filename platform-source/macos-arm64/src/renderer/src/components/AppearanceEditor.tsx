import { t as uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { DEFAULT_APPEARANCE, normalizeAppearance, type Appearance } from '@core/appearance'
import { useAppearance } from '../store/appearance'
import { Button, inputClass } from './ui'

// Settings → Appearance → Advanced: fonts, corners and spacing, and saved setups.
// Custom colours now live in Stage colours (AppearanceSettings).

function useRunner(): { run: (fn: () => Promise<void>) => Promise<void>; error: string; message: string; setMessage: (m: string) => void } {
  const [error,setError]=useState(''),[message,setMessage]=useState('')
  const run=async(fn:()=>Promise<void>)=>{setError('');setMessage('');try{await fn()}catch(e){setError(e instanceof Error?e.message:String(e))}}
  return {run,error,message,setMessage}
}

export function FontSettings():React.JSX.Element{
  const {appearance:a,update}=useAppearance()
  const {run,error,message,setMessage}=useRunner()
  const [fonts,setFonts]=useState(['Segoe UI','Arial','Calibri','Cambria','Georgia','Consolas','Cascadia Code'])
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{uiText("Fonts")}</h3><Button size="sm" onClick={()=>void run(async()=>{const query=(window as unknown as {queryLocalFonts?:()=>Promise<{family:string}[]>}).queryLocalFonts;if(!query){setMessage(uiText('Installed-font access is unavailable. Type any installed font name below.'));return}try{const rows=await query.call(window);setFonts([...new Set([...fonts,...rows.map((f)=>f.family)])].sort());setMessage(uiText('Installed fonts loaded.'))}catch{setMessage(uiText('Font access was declined or unavailable. Type an installed font name instead.'))}})}>{uiText("Load installed fonts")}</Button></div>
    <datalist id="appearance-fonts">{fonts.map((font)=><option key={font} value={font}/>)}</datalist>
    <div className="grid gap-4 md:grid-cols-3">{(['fontUi','fontTimer','fontWriting'] as const).map((field,i)=><label key={field}><span className="mb-2 block text-sm">{uiText(['Interface font','Timer font','Writing font'][i])}</span><input dir="ltr" aria-label={uiText(['Interface font','Timer font','Writing font'][i])} list="appearance-fonts" className={inputClass} defaultValue={a[field].split(',')[0].replace(/"/g,'')} key={a[field]} onBlur={(e)=>{if(e.target.value.trim())void update({[field]:JSON.stringify(e.target.value.trim())+', "Segoe UI", sans-serif'})}}/></label>)}</div>
    <div className="rounded-2xl border border-line bg-writing p-5"><p dir="ltr" className="font-timer text-4xl text-stage-focus-text">25:00</p><p dir="auto" className="my-3 font-writing text-writing-ink" style={{fontSize:'var(--tf-writing-size)'}}>{uiText("A little more understanding. تعلّم وفهم أفضل.")}</p><div className="flex flex-wrap gap-3">{(['focus','recall','rest'] as const).map((c)=><span key={c} className="rounded-lg px-4 py-2" style={{background:`var(--fr-stage-${c})`,color:`var(--fr-stage-${c}-on)`}}>{uiText(c)}</span>)}</div></div>
    {error&&<p role="alert" className="text-status-error">{error}</p>}{message&&<p role="status" className="text-muted">{message}</p>}
  </div>
}

export function ShapeSettings():React.JSX.Element{
  const {appearance:a,update}=useAppearance()
  return <div className="flex flex-col gap-4">
    <section className="rounded-xl border border-line bg-surface-2/30 p-5"><h3 className="text-lg font-semibold">{uiText("Interface shape")}</h3><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:'Straight',value:0},{label:'Subtle',value:0.5},{label:'Rounded',value:1},{label:'Soft',value:1.6}].map((shape)=><button key={uiText(shape.label)} type="button" aria-label={uiText('{shape} shapes',{shape:uiText(shape.label)})} aria-pressed={a.roundness===shape.value} onClick={()=>void update({roundness:shape.value})} className={`flex flex-col items-center gap-3 rounded-xl border p-4 transition ${a.roundness===shape.value?'border-selected-line bg-selected ring-1 ring-selected-line':'border-line hover:bg-surface-2'}`}><span aria-hidden="true" className="flex h-14 w-full max-w-32 items-center gap-2 border border-focus/40 bg-surface p-2" style={{borderRadius:24*shape.value}}><span className="h-full w-3 bg-focus/25" style={{borderRadius:8*shape.value}}/><span className="h-4 flex-1 bg-focus" style={{borderRadius:8*shape.value}}/></span><span className="text-sm font-medium">{uiText(shape.label)}</span></button>)}</div></section>
    <div className="grid gap-4 md:grid-cols-2"><label><span className="mb-2 block text-sm">{uiText("Corner roundness · ")}{a.roundness.toFixed(1)}</span><input aria-label={uiText("Corner roundness")} type="range" min={0} max={2} step={0.1} value={a.roundness} className="w-full accent-[var(--tf-focus)]" onChange={(e)=>void update({roundness:Number(e.target.value)})}/></label><label><span className="mb-2 block text-sm">{uiText("Spacing")}</span><select aria-label={uiText("Interface spacing")} className={inputClass} value={a.density} onChange={(e)=>void update({density:e.target.value as 'comfortable'|'compact'})}><option value="comfortable">{uiText("Comfortable")}</option><option value="compact">{uiText("Compact")}</option></select></label></div>
  </div>
}

export function PresetSettings():React.JSX.Element{
  const {appearance:a,update}=useAppearance()
  const {run,error,message,setMessage}=useRunner()
  const [presets,setPresets]=useState<{name:string;appearance:Appearance}[]>([]),[name,setName]=useState('')
  const refresh=()=>void window.api.invoke('appearance:presets').then(setPresets)
  useEffect(refresh,[])
  return <div className="flex flex-col gap-4">
    <h3 className="text-lg font-semibold">{uiText("Your appearance presets")}</h3><div className="flex flex-wrap gap-3"><input aria-label={uiText("Preset name")} className={`${inputClass} min-w-0 flex-1`} placeholder={uiText("Name this setup")} value={name} onChange={(e)=>setName(e.target.value)}/><Button disabled={!name.trim()} onClick={()=>void run(async()=>{await window.api.invoke('appearance:savePreset',name,a);setName('');refresh();setMessage(uiText('Preset saved.'))})}>{uiText("Save preset")}</Button><Button onClick={()=>void run(async()=>{const path=await window.api.invoke('appearance:export',a);if(path)setMessage(uiText('Preset exported to {path}',{path}))})}>{uiText("Export JSON")}</Button><Button onClick={()=>void run(async()=>{const preset=await window.api.invoke('appearance:import');if(preset){await update(preset);setMessage(uiText('Preset imported.'))}})}>{uiText("Import JSON")}</Button><Button onClick={()=>void update(DEFAULT_APPEARANCE)}>{uiText("Reset appearance")}</Button></div>
    {presets.map((preset)=><div key={preset.name} className="flex items-center gap-3"><Button onClick={()=>void update(normalizeAppearance(preset.appearance))}>{preset.name}</Button><Button variant="ghost" size="sm" onClick={()=>void run(async()=>{await window.api.invoke('appearance:deletePreset',preset.name);refresh()})}>{uiText("Remove preset")}</Button></div>)}
    {error&&<p role="alert" className="text-status-error">{error}</p>}{message&&<p role="status" className="text-muted">{message}</p>}
  </div>
}

/** How many setups are saved, for the Advanced row summary. */
export function usePresetCount():number{
  const [count,setCount]=useState(0)
  useEffect(()=>{void window.api.invoke('appearance:presets').then(p=>setCount(p.length))},[])
  return count
}
