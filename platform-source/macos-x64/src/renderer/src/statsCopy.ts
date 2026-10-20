import type { FactorDef } from '@core/statsData'
import { factorCopy } from '@core/localizedStats'
import { currentLanguage } from './i18n'
import { useLogSchema } from './store/logSchema'
import { useSettings } from './store/session'
import { displayInsight as localizeInsight } from '@core/insightLocalization'
import type { PersonalInsight } from '@core/personalInsights'
import type { LogSchema } from '@core/logfields'
import type { AppLanguage } from '@core/localization'

export const factorName=(factor:FactorDef):string=>factorCopy(currentLanguage(),useLogSchema.getState().schema,factor)
export const factorOption=(factor:FactorDef,value:string):string=>factorCopy(currentLanguage(),useLogSchema.getState().schema,factor,value)
export const displayInsight=(card:PersonalInsight,schema:LogSchema,language:AppLanguage):PersonalInsight=>localizeInsight(card,schema,language,useSettings.getState().settings.distractionReasons)
