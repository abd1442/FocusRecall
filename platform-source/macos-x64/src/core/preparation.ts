import type { StartBlockInput } from './api'
import type { PreparationSuggestion } from './personalInsights'

export const DEFAULT_PREPARATION_CHECKS = ['Phone away or silenced','Distracting tabs and apps closed'] as const

// `tip` remains in the wire shape for compatibility. Advice selection now uses
// stable concepts and the shared local exposure history, never this index.
export interface Preparation { input:StartBlockInput; subject:string; tip:number; suggestions?:PreparationSuggestion[] }
/** Screen coordinates are DIP; keep the preparation sheet inside its work area. */
export function preparationBounds(work:{x:number;y:number;width:number;height:number},scale:number) {
  const width=Math.round(Math.min(900*scale,Math.max(1,work.width-48))),height=Math.round(Math.min(400*scale,Math.max(1,work.height-48)))
  return {x:Math.round(work.x+(work.width-width)/2),y:Math.round(work.y+(work.height-height)/2),width,height}
}
/** No database session or timer exists until commit succeeds. */
export class PreparationGate {
  private pending:Preparation|null=null
  get():Preparation|null { return this.pending }
  begin(p:Preparation):Preparation { if(this.pending)throw Error('A preparation panel is already open.');this.pending={...p,input:{...p.input}};return this.pending }
  cancel():void { this.pending=null }
  commit<T>(start:(input:StartBlockInput)=>T):T { if(!this.pending)throw Error('No session is waiting to start.');const result=start(this.pending.input);this.pending=null;return result }
}
