import { describe, expect, it } from 'vitest'
import { mergeMarkdown, noteFile, notionId, notionParagraphs, validateStrokes } from './notes'
import { normalizeAppearance, paletteFor, DEFAULT_APPEARANCE } from './appearance'

describe('note destinations and preserved content',()=>{
  it('recognizes page and block IDs without using an arbitrary external API host',()=>{
    expect(notionId('https://www.notion.so/My-note-0123456789abcdef0123456789abcdef?pvs=4')).toBe('01234567-89ab-cdef-0123-456789abcdef')
    expect(notionId('01234567-89ab-cdef-0123-456789abcdef')).toBe('01234567-89ab-cdef-0123-456789abcdef')
    expect(notionId('https://www.notion.so/0123456789abcdef0123456789abcdef#fedcba9876543210fedcba9876543210')).toBe('fedcba98-7654-3210-fedc-ba9876543210')
    expect(()=>notionId('not a page')).toThrow()
  })
  it('rejects traversal, absolute paths, device names and unsafe filenames',()=>{
    for(const path of ['../secret.md','C:\\secret.md','/secret.md','Folder/../../a','NUL.md','folder/COM1.md','folder//a.md','a?.md'])expect(()=>noteFile(path),path).toThrow()
    expect(noteFile('Study\\Math')).toBe('Study/Math.md')
    expect(noteFile('ملاحظات/درس.md')).toBe('ملاحظات/درس.md')
  })
  it('inserts under the chosen heading without changing unrelated content, then updates only its own note',()=>{
    const existing='# My file\r\n\r\n## Study notes\r\nOriginal notes.\r\n\r\n## Other\r\nKeep me.\r\n'
    const first=mergeMarkdown(existing,'note-1','Math','First recall','Study notes','2026-10-13')
    expect(first.indexOf('First recall')).toBeLessThan(first.indexOf('Original notes.'))
    const second=mergeMarkdown(first,'note-1','Math','Updated recall','Study notes','2026-10-13')
    expect(second).not.toContain('First recall');expect(second).toContain('Keep me.');expect(second).toContain('Original notes.')
    expect(second.match(/<!-- learnalyt:note-1 -->/g)).toHaveLength(1)
    expect(second).toContain('\r\n')
  })
  it('does not erase a partially edited marker region',()=>{
    expect(()=>mergeMarkdown('keep\n<!-- learnalyt:x -->broken','x','title','new','','today')).toThrow()
  })
  it('keeps long Unicode text within Notion run limits and preserves line breaks',()=>{
    const blocks=notionParagraphs('😀'.repeat(2200)+'\n\nآخر سطر')
    expect(blocks[0].paragraph.rich_text[0].text.content.length).toBeLessThanOrEqual(2000)
    expect(blocks.map((b)=>b.paragraph.rich_text.map((t)=>t.text.content).join('')).join('')).toContain('آخر سطر')
    expect(blocks.some((b)=>!b.paragraph.rich_text.length)).toBe(true)
  })
  it('validates finite, bounded pressure-sensitive stroke data',()=>{
    const strokes=[{tool:'pen' as const,color:'#233B56',width:5,points:[{x:10,y:20,pressure:0.3},{x:20,y:40,pressure:1}]}]
    expect(validateStrokes(strokes)).toEqual(strokes)
    expect(()=>validateStrokes([{...strokes[0],points:[{x:NaN,y:20,pressure:1}]}])).toThrow()
  })
})
describe('editable appearance',()=>{
  it('validates custom values, roundness and fonts without weakening old defaults',()=>{
    const a=normalizeAppearance({customLight:{bg:'#abcdef',text:'red'},roundness:99,density:'compact',fontUi:''})
    expect(a.customLight).toEqual({bg:'#abcdef'});expect(a.roundness).toBe(2);expect(a.fontUi).toBe(DEFAULT_APPEARANCE.fontUi)
    expect(normalizeAppearance({}).density).toBe('comfortable')
    expect(paletteFor({...a,mode:'light'},false).bg).toBe('#abcdef')
    expect(paletteFor({...a,mode:'light',highContrast:true},false).bg).not.toBe('#abcdef')
  })
})
