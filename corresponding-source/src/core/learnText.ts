import copy from './learnCopy.json'
import type { AppLanguage } from './localization'
import type { LegacyLessonId } from './learn'
export interface LessonCopy {title:string;objective:string;intro:string;instruction:string;explanation:string;question:string;options:string;feedback:string;revisit:string;items?:string;panels?:string}
export function lessonText(id:LegacyLessonId,language:AppLanguage):LessonCopy {
  const entry=(copy as Record<LegacyLessonId,Record<AppLanguage,LessonCopy>>)[id]?.[language]
  if(!entry)throw Error('Missing Learn translation.')
  return entry
}
