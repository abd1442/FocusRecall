import { t as uiText } from '../i18n'
import { confirmAction } from './appDialogs'
import { useEffect, useRef, useState } from 'react'
import type { Stroke } from '@core/notes'
import { Button } from './ui'

export function Whiteboard({ strokes, onChange }: { strokes: Stroke[]; onChange: (strokes: Stroke[], image: string | null) => void }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null), active = useRef<Stroke | null>(null), pointer = useRef<number | null>(null)
  const [tool, setTool] = useState<Stroke['tool']>('pen'), [color, setColor] = useState('#233B56'), [width, setWidth] = useState(5), [undo, setUndo] = useState<Stroke[][]>([]), [redo, setRedo] = useState<Stroke[][]>([])
  const paint = (next: Stroke[]): void => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return
    ctx.clearRect(0,0,1200,700)
    for (const s of next) {
      ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';ctx.globalAlpha=s.tool==='highlighter'?0.25:1;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineCap='round';ctx.lineJoin='round'
      s.points.forEach((p,i)=>{ const size=s.width*(s.tool==='highlighter'?2:1)*(0.3+p.pressure*1.4);ctx.lineWidth=size;if(i){ctx.beginPath();ctx.moveTo(s.points[i-1].x,s.points[i-1].y);ctx.lineTo(p.x,p.y);ctx.stroke()}else{ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.fill()} })
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'
  }
  useEffect(()=>paint(strokes),[strokes])
  const commit=(next:Stroke[]):void=>{ paint(next);if(!next.length){onChange(next,null);return}const image=document.createElement('canvas');image.width=1200;image.height=700;const ctx=image.getContext('2d')!;ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,1200,700);ctx.drawImage(canvas.current!,0,0);onChange(next,image.toDataURL('image/png')) }
  const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1200,(e.clientX-r.left)/r.width*1200)),y:Math.max(0,Math.min(700,(e.clientY-r.top)/r.height*700)),pressure:e.pointerType==='pen'?e.pressure || 0.1:0.5}}
  const finish=(e:React.PointerEvent<HTMLCanvasElement>)=>{if(pointer.current!==e.pointerId||!active.current)return;const next=[...strokes,active.current];active.current=null;pointer.current=null;setUndo([...undo,strokes]);setRedo([]);commit(next)}
  return <div className="flex flex-col gap-3"><div className="flex flex-wrap items-center gap-2" aria-label={uiText("Drawing tools")}>
    {(['pen','highlighter','eraser'] as const).map((t)=><Button key={t} size="sm" aria-pressed={tool===t} className={tool===t?'ring-2 ring-recall':''} onClick={()=>setTool(t)}>{uiText(t==='pen'?'Pen':t==='highlighter'?'Highlighter':'Eraser')}</Button>)}
    {['#233B56','#A23D4D','#2D7656','#7D4D9E','#D69527'].map((c)=><button key={c} type="button" aria-label={uiText("Ink {value0}", {value0: (c)})} aria-pressed={color===c} onClick={()=>setColor(c)} className={`size-8 rounded-full border-2 ${color===c?'ring-2 ring-recall ring-offset-2':''}`} style={{background:c,borderColor:'var(--tf-border)'}} />)}
    <select aria-label={uiText("Pen width")} className="rounded-lg border border-line bg-surface px-2 py-2" value={width} onChange={(e)=>setWidth(Number(e.target.value))}><option value={2}>{uiText("Fine")}</option><option value={5}>{uiText("Medium")}</option><option value={10}>{uiText("Wide")}</option></select>
    <Button size="sm" disabled={!strokes.length&&!undo.length} onClick={()=>{setRedo([...redo,strokes]);commit(undo.length?undo[undo.length-1]:strokes.slice(0,-1));setUndo(undo.slice(0,-1))}}>{uiText("Undo")}</Button><Button size="sm" disabled={!redo.length} onClick={()=>{setUndo([...undo,strokes]);commit(redo[redo.length-1]);setRedo(redo.slice(0,-1))}}>{uiText("Redo")}</Button><Button size="sm" disabled={!strokes.length} onClick={async()=>{if(await confirmAction('Clear this drawing? You can undo while Draw stays open.','Clear drawing','Clear whiteboard?',true)){setUndo([...undo,strokes]);setRedo([]);commit([])}}}>{uiText("Clear")}</Button>
  </div><canvas ref={canvas} width={1200} height={700} aria-label={uiText("Whiteboard. Draw with a pen, mouse or touch; pen pressure changes stroke width.")} className="w-full rounded-xl border border-line bg-white" style={{touchAction:'none',aspectRatio:'12 / 7'}}
    onPointerDown={(e)=>{if(pointer.current!==null||e.button!==0)return;e.preventDefault();pointer.current=e.pointerId;active.current={tool,color,width,points:[point(e)]};e.currentTarget.setPointerCapture(e.pointerId);paint([...strokes,active.current])}}
    onPointerMove={(e)=>{if(pointer.current!==e.pointerId||!active.current)return;active.current.points.push(point(e));paint([...strokes,active.current])}}
    onPointerUp={finish} onPointerCancel={finish} />
    <p className="text-sm text-muted">{uiText("Pen pressure, mouse and touch supported. Switching to Type keeps your drawing.")}</p>
  </div>
}
