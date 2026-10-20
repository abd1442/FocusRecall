import { describe, expect, it } from 'vitest'
import { ADVICE_CATALOG } from './adviceCatalog'
import { adviceBrief } from './adviceBrief'
import brief from './adviceBriefCopy.json'
import { LANGUAGES } from './localization'
import { adviceText } from './adviceText'

describe('concise advice presentation', () => {
  it('covers every strategy in all seven languages without replacing the full scientific scope', () => {
    expect(Object.keys(brief).sort()).toEqual(ADVICE_CATALOG.map(c=>c.id).sort())
    for(const concept of ADVICE_CATALOG)for(const {id:language} of LANGUAGES){
      const prompt=adviceBrief(concept.id,language)
      expect(prompt.trim()).toBe(prompt)
      expect(prompt.length).toBeGreaterThan(5)
      expect(prompt.length).toBeLessThan(110)
      expect(prompt).not.toMatch(/(?<![\p{L}\p{N}])(?:TODO|TBD|guarantee|proven best|mastery)(?![\p{L}\p{N}])/iu)
      expect(adviceText(concept.id,language).detail.length).toBeGreaterThan(20)
    }
    expect(adviceText('worked-example','en').detail).toContain('mathematics')
    expect(adviceText('rest-recovery','en').detail).toContain('not scientific optima')
    expect(adviceText('predict-check','en').detail).toContain('do not measure retained learning')
  })
  it('retains essential task qualifications in the brief prompts and fails on missing translations', () => {
    expect(adviceBrief('interleave','en')).toContain('basics')
    expect(adviceBrief('interleave','en')).toContain('related')
    expect(adviceBrief('worked-example','en')).toContain('New method?')
    expect(()=>adviceBrief('unknown','ar')).toThrow('Missing concise advice translation')
  })
})
