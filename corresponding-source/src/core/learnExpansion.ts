import copy from './learnExpansionCopy.json'
import type { AppLanguage } from './localization'

// Original visual essays. Related canonical strategies remain unchanged.
export const EXPANDED_LESSONS = [
 {id:'chunking',concept:'compare-concepts',related:['explain-step'],kind:'visual',group:'understand'},
 {id:'workspace',concept:'fade-support',related:['thought-parking'],kind:'visual',group:'understand'},
 {id:'incubation',concept:'stuck-break',related:['rest-accessible'],kind:'visual',group:'adapt'},
 {id:'mentalset',concept:'compare-concepts',related:['worked-example'],kind:'visual',group:'adapt'},
 {id:'starting',concept:'return-small',related:['plan-feasible'],kind:'visual',group:'adapt'},
 {id:'palace',concept:'cue-ladder',related:['recall-attempt'],kind:'visual',group:'remember'},
 {id:'sleep',concept:'spacing-return',related:['rest-recovery'],kind:'visual',group:'remember'},
 {id:'transfer',concept:'compare-concepts',related:['explain-step'],kind:'visual',group:'understand'},
 {id:'exam',concept:'question-design',related:['spacing-return','error-retry'],kind:'visual',group:'practice'},
 {id:'difficulty',concept:'fade-support',related:['worked-example','cue-ladder'],kind:'visual',group:'practice'},
 {id:'together',concept:'explain-step',related:['feedback-specific','evidence-claim'],kind:'visual',group:'understand'},
 {id:'switching',concept:'one-interruption',related:['restart-note','thought-parking'],kind:'visual',group:'adapt'},
 {id:'sources',concept:'evidence-claim',related:['compare-concepts'],kind:'visual',group:'notice'},
 {id:'context',concept:'spacing-return',related:['delayed-check','recall-attempt'],kind:'visual',group:'remember'},
 {id:'forgetting',concept:'cue-ladder',related:['compare-concepts','spacing-return'],kind:'visual',group:'remember'},
 {id:'motivation',concept:'plan-feasible',related:['return-small','choose-target'],kind:'visual',group:'adapt'},
 {id:'targeted',concept:'error-retry',related:['feedback-specific','delayed-check'],kind:'visual',group:'practice'},
 {id:'pressure',concept:'plan-feasible',related:['question-design','rest-accessible'],kind:'visual',group:'practice'},
 {id:'methods',concept:'compare-concepts',related:['delayed-check','explain-step'],kind:'visual',group:'notice'}
] as const
export type ExpansionId=typeof EXPANDED_LESSONS[number]['id']
export const isExpansion=(id:string):id is ExpansionId=>EXPANDED_LESSONS.some(l=>l.id===id)
export interface VisualCopy {title:string;caption:string;action:string;detail:string;labels:string;keywords:string}
export const expansionText=(id:ExpansionId,language:AppLanguage):VisualCopy=>copy[id][language]
export const EXPANSION_SOURCES = {
 chunking:[{citation:'Cowan (2014)',url:'https://doi.org/10.1007/s10648-013-9246-y'}],
 workspace:[{citation:'Sweller, van Merriënboer & Paas (2019)',url:'https://doi.org/10.1007/s10648-019-09465-5'}],
 incubation:[{citation:'Sio & Ormerod (2009)',url:'https://doi.org/10.1037/a0014212'}],
 mentalset:[{citation:'Bilalić, McLeod & Gobet (2008)',url:'https://doi.org/10.1016/j.cognition.2008.05.005'}],
 starting:[{citation:'Gollwitzer & Sheeran (2006)',url:'https://doi.org/10.1016/S0065-2601(06)38002-1'}],
 palace:[{citation:'Twomey & Kroneisen (2021)',url:'https://doi.org/10.1177/1747021821993457'}],
 sleep:[{citation:'Rasch & Born (2013)',url:'https://doi.org/10.1152/physrev.00032.2012'}],
 transfer:[{citation:'Pan & Rickard (2018)',url:'https://doi.org/10.1037/bul0000151'}],
 exam:[{citation:'Dunlosky et al. (2013)',url:'https://doi.org/10.1177/1529100612453266'}],
 difficulty:[{citation:'Bjork & Bjork (2011)',url:'https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/11/Making-Things-Hard-on-Yourself-but-in-a-Good-Way-20111.pdf'},{citation:'Sweller, van Merriënboer & Paas (2019)',url:'https://doi.org/10.1007/s10648-019-09465-5'}],
 together:[{citation:'Smith et al. (2009)',url:'https://doi.org/10.1126/science.1165919'}],
 switching:[{citation:'Rubinstein, Meyer & Evans (2001)',url:'https://doi.org/10.1037/0096-1523.27.4.763'}],
 sources:[{citation:'Wineburg & McGrew (2019)',url:'https://doi.org/10.1177/016146811912101102'}],
 context:[{citation:'Smith, Glenberg & Bjork (1978)',url:'https://doi.org/10.3758/BF03197465'},{citation:'Smith & Vela (2001)',url:'https://doi.org/10.3758/BF03196157'}],
 forgetting:[{citation:'Wixted (2004)',url:'https://doi.org/10.1146/annurev.psych.55.090902.141555'},{citation:'Rowland, Bates & DeLosh (2014)',url:'https://doi.org/10.3389/fpsyg.2014.01343'}],
 motivation:[{citation:'Bureau et al. (2022)',url:'https://doi.org/10.3102/00346543211042426'}],
 targeted:[{citation:'Macnamara, Hambrick & Oswald (2014)',url:'https://doi.org/10.1177/0956797614535810'},{citation:'Rohrer & Taylor (2006)',url:'https://doi.org/10.1002/acp.1266'}],
 pressure:[{citation:'von der Embse et al. (2018)',url:'https://doi.org/10.1016/j.jad.2017.11.048'}],
 methods:[{citation:'Clinton-Lisell & Litzinger (2024)',url:'https://doi.org/10.3389/fpsyg.2024.1428732'},{citation:'Pashler et al. (2008)',url:'https://doi.org/10.1111/j.1539-6053.2009.01038.x'}]
} satisfies Record<ExpansionId,{citation:string;url:string}[]>
