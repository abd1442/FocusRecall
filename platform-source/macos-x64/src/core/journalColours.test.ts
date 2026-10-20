import { describe,it,expect } from 'vitest'
import { APPROVED_COLOURS,PAPER_COLOURS,SAGE_COLOURS,JOURNAL_LAYOUTS,journalChoices,journalColour,journalId } from './journalColours'
import { normalizeAppearance } from './appearance'
import { themeById } from './themes'

// The beta.27 colour layouts are no longer offered; they remain the source of the
// one-time migration to the theme system, so every id must still resolve.
describe('beta.27 colour layouts',()=>{
 it('keeps all 50 proposals and the Paper & Ink and Sage layouts readable for migration',()=>{
  expect(APPROVED_COLOURS).toHaveLength(50)
  const covered=new Set<string>()
  for(const l of JOURNAL_LAYOUTS){const rows=journalChoices(l.id);expect(rows[0].id).toBe(l.defaultId);expect(rows[1].id).toBe(l.referenceId);rows.filter(p=>/^\d/.test(p.id)).forEach(p=>covered.add(p.id))}
  expect(covered.size).toBe(50)
  expect(journalColour('windows-approved-11','light')?.id).toBe('01')
  expect(journalColour('windows-not-a-palette','dark')).toBeUndefined()
  expect(journalColour('paper-auto','dark')?.id).toBe('paper-dark')
 })
 for(const row of [...PAPER_COLOURS,...SAGE_COLOURS,...APPROVED_COLOURS])for(const id of [journalId(row),'windows-'+journalId(row)]){
  it(`${id} migrates to an approved light and dark theme`,()=>{
   const a=normalizeAppearance({colourId:id,accentId:'palette',mode:row.mode})
   expect(themeById(a.lightTheme,'light'),a.lightTheme).toBeDefined()
   expect(themeById(a.darkTheme,'dark'),a.darkTheme).toBeDefined()
   expect(a.colourId).toBe(id)
   expect(a.mode).toBe(row.mode)
   expect(normalizeAppearance(JSON.parse(JSON.stringify(a)))).toEqual(a)
  })
 }
})
