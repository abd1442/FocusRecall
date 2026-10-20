import { adviceConcept } from '@core/adviceCatalog'
import { adviceText } from '@core/adviceText'
import { STRATEGY_VISUALS, type StrategyVisualId } from '@core/strategyVisuals'
import { t, useLanguage } from '../../i18n'
import { Button, Dialog } from '../ui'
import { StrategyVisual } from './StrategyVisual'
import '../../tabs/learn.css'

/** Read-only example of the advice already selected. No Learn/session writes. */
export default function StudyStrategyExample({id,onClose}:{id:string;onClose:()=>void}):React.JSX.Element|null {
  const language=useLanguage(),concept=adviceConcept(id)
  if(!concept||!Object.hasOwn(STRATEGY_VISUALS,id))return null
  const copy=adviceText(concept.id,language)
  // Portal keyboard events still bubble through React parents. In particular,
  // Escape must close this example without cancelling preparation underneath.
  return <div onKeyDown={event=>event.stopPropagation()}><Dialog title={t('See a visual example')} onClose={onClose}>
    <div className="study-strategy-example" style={{containerType:'inline-size',containerName:'learn'}} data-study-example={id}>
      <p className="font-medium leading-relaxed">{copy.action}</p>
      <StrategyVisual id={id as StrategyVisualId}/>
      <p className="mt-4 leading-relaxed text-muted">{copy.detail}</p>
      <p className="mt-3 text-sm text-muted">{t('General guidance, not a finding from your records. These studies do not test FocusRecall itself.')}</p>
      <div className="mt-5 flex justify-end"><Button onClick={onClose}>{t('Return to study')}</Button></div>
    </div>
  </Dialog></div>
}
