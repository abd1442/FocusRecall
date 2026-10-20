import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Menu({label,items}:{label:string;items:({label:string;onSelect:()=>void;disabled?:boolean;danger?:boolean}|'separator')[]}):React.JSX.Element {
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0})
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null)
  const close=()=>{setOpen(false);trigger.current?.focus()}
  useLayoutEffect(()=>{
    if(!open)return
    const place=()=>{
      if(!trigger.current||!menu.current)return
      const r=trigger.current.getBoundingClientRect(),m=menu.current.getBoundingClientRect(),zoom=parseFloat(getComputedStyle(document.documentElement).zoom)||1
      const x=Math.max(8,Math.min(r.right-m.width,window.innerWidth-m.width-8)),below=r.bottom+6
      const y=below+m.height<=window.innerHeight-8?below:Math.max(8,r.top-m.height-6)
      setPosition({left:x/zoom,top:y/zoom})
    }
    place();menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true})
    const outside=(e:MouseEvent)=>{if(!menu.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false)}
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}}
    const scroll=(e:Event)=>{if(!menu.current?.contains(e.target as Node))setOpen(false)}
    window.addEventListener('mousedown',outside);window.addEventListener('keydown',esc);window.addEventListener('resize',place);window.addEventListener('scroll',scroll,true)
    return()=>{window.removeEventListener('mousedown',outside);window.removeEventListener('keydown',esc);window.removeEventListener('resize',place);window.removeEventListener('scroll',scroll,true)}
  },[open])
  return <div onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)} className="grid size-10 place-items-center rounded-lg text-xl leading-none text-muted hover:bg-surface-2 hover:text-ink">⋯</button>
    {open&&createPortal(<div ref={menu} role="menu" aria-label={label} style={{...position,maxHeight:'calc(100vh / var(--tf-zoom,1) - 1rem)',maxWidth:'calc(100vw / var(--tf-zoom,1) - 1rem)'}} className="fixed z-[90] min-w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
      e.stopPropagation();const buttons=[...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const i=buttons.indexOf(document.activeElement as HTMLButtonElement)
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}
      if(e.key==='Escape'){e.preventDefault();close()}
      // Restore the trigger before the browser's default Tab traversal; the
      // portalled item is about to disappear and is not the logical tab anchor.
      if(e.key==='Tab')close()
    }}>
      {items.map((it,i)=>it==='separator'?<div key={i} role="separator" className="my-1.5 h-px bg-line"/>:<button key={it.label} type="button" role="menuitem" disabled={it.disabled} onClick={()=>{close();it.onSelect()}} className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-base hover:bg-surface-2 disabled:opacity-40 ${it.danger?'text-overtime':'text-ink'}`}>{it.label}</button>)}
    </div>,trigger.current?.closest('dialog[open]')??document.body)}
  </div>
}
