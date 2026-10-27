import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SettingLabelContext, useSettingLabel } from './components/settingLabel'
import { applyLanguage } from './i18n'
import { catalogs, LANGUAGES, translate } from '@core/localization'

function Control({label}: {label?:string}) {
  return createElement('input', {'aria-label':useSettingLabel(label)})
}

beforeEach(() => vi.stubGlobal('document', {documentElement:{lang:'en',dir:'ltr'}}))

afterEach(() => {
  applyLanguage('en')
  vi.unstubAllGlobals()
})

it('scopes inherited setting names and keeps paired control names distinct', () => {
  const html = renderToStaticMarkup(createElement('div', null,
    createElement(SettingLabelContext.Provider, {value:'Chime'}, createElement(Control)),
    createElement(SettingLabelContext.Provider, {value:'Shortest and longest rest'},
      createElement(Control, {label:'Shortest rest'}), createElement(Control, {label:'Longest rest'})),
    createElement(SettingLabelContext.Provider, {value:'Volume'}, createElement(Control))))
  expect(html).toContain('aria-label="Chime"')
  expect(html).toContain('aria-label="Shortest rest"')
  expect(html).toContain('aria-label="Longest rest"')
  expect(html).toContain('aria-label="Volume"')
  expect(html).not.toContain('aria-label="Shortest and longest rest"')
})

it('uses the selected language for explicit and inherited setting names', () => {
  for (const {id} of LANGUAGES) {
    applyLanguage(id)
    const rowName=translate(id,'Daily study reminder')
    const html=renderToStaticMarkup(createElement(SettingLabelContext.Provider,{value:rowName},
      createElement(Control),createElement(Control,{label:'Shortest rest'})))
    expect(html).toContain(`aria-label="${rowName}"`)
    expect(html).toContain(`aria-label="${translate(id,'Shortest rest')}"`)
    if(id!=='en')for(const key of ['Pen','Highlighter','Eraser','start of the session','switched to during the session','split afterwards (times estimated)']) {
      expect(catalogs[id][key]).toBeTruthy()
      expect(translate(id,key)).not.toBe(key)
    }
  }
})
