import { LANGUAGES } from '@core/localization'
import { useId } from 'react'
import { t as uiText } from '../i18n'
import { useSettings } from '../store/session'
import { inputClass } from './ui'

export function LanguageSettings(): React.JSX.Element {
  const { settings, set } = useSettings()
  const headingId = useId()
  return <section className="rounded-xl border border-line bg-surface p-6" aria-labelledby={headingId} data-language-setting>
    <h2 id={headingId} className="text-lg font-semibold">{uiText('Language')}</h2>
    <label className="mt-3 flex max-w-lg flex-col gap-2">
      <span className="text-sm text-muted">{uiText('Choose the language used throughout A14 Pomodoro.')}</span>
      <select className={inputClass} value={settings.language} onChange={event => {
        const choice = LANGUAGES.find(language => language.id === event.target.value)
        if (choice) void set('language', choice.id)
      }} aria-label={uiText('Language')}>
        {LANGUAGES.map(language => <option key={language.id} value={language.id} lang={language.id} dir={language.direction}>{language.name}</option>)}
      </select>
    </label>
    <p className="mt-3 text-sm text-muted">{uiText('Your notes, subject names and saved answers stay unchanged.')}</p>
    {settings.language !== 'en' && <p className="mt-2 text-sm text-muted">{uiText('Translations are in preview and still need independent language review. Technical error details and original saved wording may appear in their original language.')}</p>}
  </section>
}
