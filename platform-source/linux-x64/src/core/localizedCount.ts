import type { AppLanguage } from './localization'

type Pair = readonly [string, string]
const words = {
  en: { session:['session','sessions'], day:['day','days'], studyDay:['study day','study days'], activeDay:['active day','active days'], subject:['subject','subjects'], record:['record','records'], answer:['answer','answers'], answeredSession:['answered session','answered sessions'], ratedSession:['rated session','rated sessions'], usableAnswer:['usable answer','usable answers'], answeredObservation:['answered observation','answered observations'], event:['event','events'], note:['note','notes'], distraction:['distraction','distractions'], program:['program or site','programs and sites'], part:['part','parts'] },
  es: { session:['sesión','sesiones'], day:['día','días'], studyDay:['día de estudio','días de estudio'], activeDay:['día activo','días activos'], subject:['materia','materias'], record:['registro','registros'], answer:['respuesta','respuestas'], answeredSession:['sesión con respuesta','sesiones con respuesta'], ratedSession:['sesión con valoración','sesiones con valoración'], usableAnswer:['respuesta utilizable','respuestas utilizables'], answeredObservation:['observación con respuesta','observaciones con respuesta'], event:['evento','eventos'], note:['nota','notas'], distraction:['distracción','distracciones'], program:['programa o sitio','programas y sitios'], part:['parte','partes'] },
  fr: { session:['séance','séances'], day:['jour','jours'], studyDay:['jour d’étude','jours d’étude'], activeDay:['jour actif','jours actifs'], subject:['matière','matières'], record:['entrée','entrées'], answer:['réponse','réponses'], answeredSession:['séance renseignée','séances renseignées'], ratedSession:['séance évaluée','séances évaluées'], usableAnswer:['réponse exploitable','réponses exploitables'], answeredObservation:['observation renseignée','observations renseignées'], event:['événement','événements'], note:['note','notes'], distraction:['distraction','distractions'], program:['programme ou site','programmes et sites'], part:['partie','parties'] },
  'pt-BR': { session:['sessão','sessões'], day:['dia','dias'], studyDay:['dia de estudo','dias de estudo'], activeDay:['dia ativo','dias ativos'], subject:['matéria','matérias'], record:['registro','registros'], answer:['resposta','respostas'], answeredSession:['sessão respondida','sessões respondidas'], ratedSession:['sessão avaliada','sessões avaliadas'], usableAnswer:['resposta utilizável','respostas utilizáveis'], answeredObservation:['observação respondida','observações respondidas'], event:['evento','eventos'], note:['nota','notas'], distraction:['distração','distrações'], program:['programa ou site','programas e sites'], part:['parte','partes'] },
  de: { session:['Sitzung','Sitzungen'], day:['Tag','Tage'], studyDay:['Lerntag','Lerntage'], activeDay:['aktiver Tag','aktive Tage'], subject:['Fach','Fächer'], record:['Eintrag','Einträge'], answer:['Antwort','Antworten'], answeredSession:['Sitzung mit Antwort','Sitzungen mit Antwort'], ratedSession:['Sitzung mit Bewertung','Sitzungen mit Bewertung'], usableAnswer:['verwertbare Antwort','verwertbare Antworten'], answeredObservation:['Beobachtung mit Antwort','Beobachtungen mit Antwort'], event:['Ereignis','Ereignisse'], note:['Notiz','Notizen'], distraction:['Ablenkung','Ablenkungen'], program:['Programm oder Website','Programme und Websites'], part:['Teil','Teile'] },
  'zh-Hans': { session:['次学习','次学习'], day:['天','天'], studyDay:['个学习日','个学习日'], activeDay:['个活跃日','个活跃日'], subject:['个科目','个科目'], record:['条记录','条记录'], answer:['条回答','条回答'], answeredSession:['次已填写的学习','次已填写的学习'], ratedSession:['次已评分的学习','次已评分的学习'], usableAnswer:['条可用回答','条可用回答'], answeredObservation:['条已填写的观察记录','条已填写的观察记录'], event:['次事件','次事件'], note:['条笔记','条笔记'], distraction:['次分心','次分心'], program:['个程序或网站','个程序或网站'], part:['个部分','个部分'] }
} as const
export type CountUnit = keyof typeof words.en
export const COUNT_UNITS = Object.keys(words.en) as CountUnit[]
// Arabic has six cardinal categories. The one/dual forms express the quantity
// themselves; do not prepend a second digit to them. Other forms retain digits.
const ar: Record<CountUnit, { one: string; two: string; few: string; many: string; other: string }> = {
  session:{one:'جلسة واحدة',two:'جلستان',few:'جلسات',many:'جلسةً',other:'جلسة'},
  day:{one:'يوم واحد',two:'يومان',few:'أيام',many:'يومًا',other:'يوم'},
  studyDay:{one:'يوم دراسة واحد',two:'يوما دراسة',few:'أيام دراسة',many:'يوم دراسة',other:'يوم دراسة'},
  activeDay:{one:'يوم نشط واحد',two:'يومان نشطان',few:'أيام نشطة',many:'يومًا نشطًا',other:'يوم نشط'},
  subject:{one:'مادة واحدة',two:'مادتان',few:'مواد',many:'مادةً',other:'مادة'},
  record:{one:'سجل واحد',two:'سجلان',few:'سجلات',many:'سجلًا',other:'سجل'},
  answer:{one:'إجابة واحدة',two:'إجابتان',few:'إجابات',many:'إجابةً',other:'إجابة'},
  answeredSession:{one:'جلسة واحدة بإجابة',two:'جلستان بإجابة',few:'جلسات بإجابات',many:'جلسةً بإجابة',other:'جلسة بإجابة'},
  ratedSession:{one:'جلسة واحدة بتقييم',two:'جلستان بتقييم',few:'جلسات بتقييم',many:'جلسةً بتقييم',other:'جلسة بتقييم'},
  usableAnswer:{one:'إجابة واحدة قابلة للاستخدام',two:'إجابتان قابلتان للاستخدام',few:'إجابات قابلة للاستخدام',many:'إجابةً قابلة للاستخدام',other:'إجابة قابلة للاستخدام'},
  answeredObservation:{one:'ملاحظة واحدة بإجابة',two:'ملاحظتان بإجابة',few:'ملاحظات بإجابات',many:'ملاحظةً بإجابة',other:'ملاحظة بإجابة'},
  event:{one:'حدث واحد',two:'حدثان',few:'أحداث',many:'حدثًا',other:'حدث'},
  note:{one:'ملاحظة واحدة',two:'ملاحظتان',few:'ملاحظات',many:'ملاحظةً',other:'ملاحظة'},
  distraction:{one:'حالة تشتّت واحدة',two:'حالتا تشتّت',few:'حالات تشتّت',many:'حالة تشتّت',other:'حالة تشتّت'},
  program:{one:'برنامج أو موقع واحد',two:'برنامجان أو موقعان',few:'برامج ومواقع',many:'برنامجًا أو موقعًا',other:'برنامج أو موقع'},
  part:{one:'جزء واحد',two:'جزآن',few:'أجزاء',many:'جزءًا',other:'جزء'}
}
const rules = new Map<AppLanguage, Intl.PluralRules>()
const numbers = new Map<AppLanguage, Intl.NumberFormat>()

/** Standalone counted phrases, not arbitrary noun inflection or user-text rewriting. */
export function localizedCount(value: number, unit: CountUnit, language: AppLanguage): string {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (!rules.has(language)) rules.set(language, new Intl.PluralRules(language))
  if (!numbers.has(language)) numbers.set(language, new Intl.NumberFormat(language))
  const category = rules.get(language)!.select(value), n = numbers.get(language)!.format(value)
  if (language === 'ar') {
    const forms = ar[unit]
    if (category === 'one' || category === 'two') return forms[category]
    return `\u2068${n}\u2069 ${forms[category === 'zero' ? 'few' : category as 'few' | 'many' | 'other']}`
  }
  const pair: Pair = words[language][unit]
  return n + (language === 'zh-Hans' ? '' : ' ') + pair[category === 'one' ? 0 : 1]
}

/** Canonical evidence units only; unknown stored labels remain verbatim. */
export function localizedEvidenceCount(value:number, unit:string, language:AppLanguage):string {
  const known:Record<string,CountUnit>={sessions:'session','study days':'studyDay',days:'day',events:'event'}
  return Object.hasOwn(known,unit)?localizedCount(value,known[unit],language):new Intl.NumberFormat(language).format(value)+' '+unit
}
