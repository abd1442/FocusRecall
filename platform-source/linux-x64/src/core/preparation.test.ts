import { describe,it,expect } from 'vitest'
import { DEFAULT_PREPARATION_CHECKS,PreparationGate,preparationBounds } from './preparation'
import { DEFAULT_SETTINGS } from './settings'
describe('pre-session preparation',()=>{
  it('keeps exactly the phone and distracting-app reminders as defaults',()=>{
    expect(DEFAULT_PREPARATION_CHECKS).toEqual(['Phone away or silenced','Distracting tabs and apps closed'])
    expect(DEFAULT_SETTINGS.preparationChecks).toEqual([...DEFAULT_PREPARATION_CHECKS])
  })
  it('centres a large preparation sheet and keeps scaled sheets within small or offset monitors',()=>{
    expect(preparationBounds({x:0,y:0,width:1920,height:1080},1)).toEqual({x:510,y:340,width:900,height:400})
    const work={x:-1366,y:0,width:1366,height:768},b=preparationBounds(work,1.5)
    expect(b.width).toBe(1318);expect(b.height).toBe(600)
    expect(b.x).toBe(work.x+24);expect(b.y).toBe(84)
  })
  it('keeps the goal and target without creating a session until confirmation',()=>{
    const gate=new PreparationGate(),input={itemId:1,timerMode:'flow' as const,targetSeconds:1500,goal:'Chapter 2'}
    gate.begin({input,subject:'Physics',tip:0});input.targetSeconds=60
    expect(gate.get()?.input.targetSeconds).toBe(1500)
    let starts=0;expect(gate.commit(i=>{starts++;return i.goal})).toBe('Chapter 2');expect(starts).toBe(1)
    expect(()=>gate.commit(()=>starts++)).toThrow();expect(starts).toBe(1)
  })
  it('rejects duplicate preparation, preserves failed starts and safely cancels',()=>{
    const gate=new PreparationGate(),p={input:{itemId:1,timerMode:'fixed' as const,targetSeconds:1200},subject:'Math',tip:1}
    gate.begin(p);expect(()=>gate.begin(p)).toThrow()
    expect(()=>gate.commit(()=>{throw Error('Save failed')})).toThrow('Save failed');expect(gate.get()).not.toBeNull()
    gate.cancel();gate.cancel();expect(gate.get()).toBeNull();gate.begin(p)
  })
})
