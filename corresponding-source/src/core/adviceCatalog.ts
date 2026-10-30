/** Original editorial applications of the research below, not quotations or
 * claims that A14 Pomodoro itself has been shown to improve learning. Stable IDs
 * are shared across languages and reserved for later Learn content. */
export type AdviceSurface = 'prepare' | 'recall' | 'rest' | 'return' | 'stats'
export type AdviceIntent = 'any' | 'understand' | 'practice' | 'remember'
export type AdviceTopic = 'retrieval' | 'spacing' | 'understanding' | 'examples' | 'feedback' | 'metacognition' | 'planning' | 'attention' | 'rest'
export interface AdviceConcept {
  id:string; version:1; topic:AdviceTopic; surfaces:AdviceSurface[];
  intent:AdviceIntent; basis:'research'|'contextual'|'practical'; sources:string[]
}
export const ADVICE_SOURCES = {
  retrieval:{citation:'Agarwal, Nunes & Blunt (2021)',url:'https://doi.org/10.1007/s10648-021-09595-9',scope:'Classroom retrieval review; effects vary across tasks and populations.'},
  spacing:{citation:'Cepeda et al. (2008)',url:'https://doi.org/10.1111/j.1467-9280.2008.02209.x',scope:'Distributed practice; useful intervals depend on the retention horizon.'},
  explanation:{citation:'Bisra et al. (2018)',url:'https://doi.org/10.1007/s10648-018-9434-x',scope:'Prompted self-explanation meta-analysis; not every fluent explanation is accurate.'},
  examples:{citation:'Barbieri et al. (2023)',url:'https://doi.org/10.1007/s10648-023-09745-1',scope:'Worked examples in mathematics; other applications are adaptations.'},
  support:{citation:'Sweller, van Merriënboer & Paas (2019)',url:'https://doi.org/10.1007/s10648-019-09465-5',scope:'Cognitive load review; support depends on prior knowledge and complexity.'},
  interleave:{citation:'Brunmair & Richter (2019)',url:'https://doi.org/10.1037/bul0000209',scope:'Interleaving meta-analysis; effects depend on materials and similarity.'},
  feedback:{citation:'Wisniewski, Zierer & Hattie (2020)',url:'https://doi.org/10.3389/fpsyg.2019.03087',scope:'Feedback meta-analysis; effects vary with information and setting.'},
  regulation:{citation:'Panadero (2017)',url:'https://doi.org/10.3389/fpsyg.2017.00422',scope:'Review of self-regulated learning models; does not validate these particular prompts.'},
  techniques:{citation:'Dunlosky et al. (2013)',url:'https://doi.org/10.1177/1529100612453266',scope:'Learning-technique review; familiarity and immediate ease do not establish durable learning.'},
  breaks:{citation:'Albulescu et al. (2022)',url:'https://doi.org/10.1371/journal.pone.0272460',scope:'Micro-break meta-analysis; well-being benefits, no significant overall performance benefit.'},
  incubation:{citation:'Sio & Ormerod (2009)',url:'https://doi.org/10.1037/a0014212',scope:'Incubation meta-analysis; benefits depend on task and break activity.'}
} as const
const concept=(id:string,topic:AdviceTopic,surfaces:AdviceSurface[],intent:AdviceIntent,basis:AdviceConcept['basis'],sources:(keyof typeof ADVICE_SOURCES)[]):AdviceConcept=>({id,version:1,topic,surfaces,intent,basis,sources})
export const ADVICE_CATALOG:readonly AdviceConcept[] = [
  concept('recall-attempt','retrieval',['prepare','recall'],'remember','research',['retrieval']),
  concept('cue-ladder','retrieval',['recall'],'remember','contextual',['retrieval','support']),
  concept('question-design','retrieval',['prepare'],'remember','practical',['retrieval']),
  concept('spacing-return','spacing',['prepare','return'],'remember','research',['spacing']),
  concept('spacing-adjust','spacing',['recall','return'],'remember','contextual',['spacing']),
  concept('explain-step','understanding',['prepare','recall'],'understand','research',['explanation']),
  concept('evidence-claim','understanding',['recall'],'understand','practical',['explanation']),
  concept('compare-concepts','understanding',['recall'],'understand','contextual',['explanation','interleave']),
  concept('worked-example','examples',['prepare'],'practice','contextual',['examples']),
  concept('fade-support','examples',['recall'],'practice','contextual',['support']),
  concept('interleave','examples',['prepare'],'practice','contextual',['interleave']),
  concept('error-retry','feedback',['recall'],'practice','contextual',['feedback']),
  concept('feedback-specific','feedback',['recall'],'any','contextual',['feedback']),
  concept('predict-check','metacognition',['recall','stats'],'any','practical',['regulation','techniques']),
  concept('delayed-check','metacognition',['return','stats'],'remember','contextual',['techniques','retrieval']),
  concept('choose-target','planning',['prepare'],'any','practical',['regulation']),
  concept('restart-note','planning',['recall','return'],'any','practical',['regulation']),
  concept('plan-feasible','planning',['prepare','return'],'any','practical',['regulation']),
  concept('one-interruption','attention',['prepare'],'any','practical',[]),
  concept('thought-parking','attention',['prepare','return'],'any','practical',[]),
  concept('rest-recovery','rest',['rest'],'any','research',['breaks']),
  concept('rest-accessible','rest',['rest'],'any','practical',[]),
  concept('stuck-break','rest',['rest'],'any','contextual',['incubation']),
  concept('return-small','planning',['return'],'any','practical',['regulation'])
]
export const adviceConcept=(id:string):AdviceConcept|undefined=>ADVICE_CATALOG.find(c=>c.id===id)
