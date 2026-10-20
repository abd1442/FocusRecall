import { t } from '../../i18n'
import { useEffect, useState } from 'react'

/** Outside the busy results subtree, so pending and completion can be announced.
 * Retained hidden sections remain hidden to assistive technology as well. */
export function AnalysisAnnouncement({pending,failed}:{pending:boolean;failed:boolean}):React.JSX.Element {
  const [message,setMessage]=useState('')
  const text=failed?'':pending?t('Reading your sessions…'):t('Analysis complete.')
  useEffect(()=>setMessage(text),[text])
  return <p role="status" aria-atomic="true" className="sr-only" data-analysis-announcement>{message}</p>
}

export function AnalysisStatus({failed,retry}:{failed:boolean;retry:()=>void}):React.JSX.Element {
  return failed?<div role="alert"><p>{t('Could not calculate this view. Try again.')}</p><button type="button" className="min-h-11 text-focus" onClick={retry}>{t('Try again')}</button></div>:<p className="text-muted">{t('Reading your sessions…')}</p>
}
