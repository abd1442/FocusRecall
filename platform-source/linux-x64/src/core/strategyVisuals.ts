import copy from './strategyVisualCopy.json'
import type { AppLanguage } from './localization'

// Each canonical action gets its own visual argument. Related field-guide
// artwork is reused only when it explains that action, not merely its topic.
export const STRATEGY_VISUALS = {
 'recall-attempt':{type:'principle',id:'familiarity'},
 'cue-ladder':{type:'principle',id:'retrieve'},
 'question-design':{type:'strategy',id:'question'},
 'spacing-return':{type:'principle',id:'spacing'},
 'spacing-adjust':{type:'strategy',id:'adjust'},
 'explain-step':{type:'principle',id:'explain'},
 'evidence-claim':{type:'field',id:'sources'},
 'compare-concepts':{type:'strategy',id:'contrast'},
 'worked-example':{type:'strategy',id:'example'},
 'fade-support':{type:'principle',id:'examples'},
 'interleave':{type:'principle',id:'mix'},
 'error-retry':{type:'principle',id:'feedback'},
 'feedback-specific':{type:'strategy',id:'feedback'},
 'predict-check':{type:'strategy',id:'prediction'},
 'delayed-check':{type:'strategy',id:'delay'},
 'choose-target':{type:'principle',id:'reflect'},
 'restart-note':{type:'strategy',id:'restart'},
 'plan-feasible':{type:'strategy',id:'feasible'},
 'one-interruption':{type:'field',id:'switching'},
 'thought-parking':{type:'principle',id:'attention'},
 'rest-recovery':{type:'principle',id:'rest'},
 'rest-accessible':{type:'strategy',id:'accessible'},
 'stuck-break':{type:'field',id:'incubation'},
 'return-small':{type:'field',id:'starting'}
} as const
export type StrategyVisualId=keyof typeof STRATEGY_VISUALS
export type StrategySceneId=keyof typeof copy
export const strategySceneText=(id:StrategySceneId,language:AppLanguage)=>copy[id][language]
