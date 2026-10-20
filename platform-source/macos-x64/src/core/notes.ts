import { DATA_IDENTITY } from './identity'
export interface StrokePoint { x: number; y: number; pressure: number }
export interface Stroke { tool: 'pen' | 'highlighter' | 'eraser'; color: string; width: number; points: StrokePoint[] }
export interface NoteDestination { kind: 'none' | 'obsidian' | 'notion'; vaultPath: string; vaultName: string; file: string; heading: string; page: string; parentBlock: string; placement: 'inside' | 'after' }
export const EMPTY_DESTINATION: NoteDestination = { kind: 'none', vaultPath: '', vaultName: '', file: '', heading: '', page: '', parentBlock: '', placement: 'inside' }
export interface StudyNote { id: string; itemId: number; blockId: number | null; title: string; text: string; strokes: Stroke[]; image: string | null; destination: NoteDestination; updatedAt: string; link: string | null; status: 'local' | 'synced' | 'failed'; error: string | null }
export type NoteInput = Pick<StudyNote, 'id' | 'itemId' | 'blockId' | 'title' | 'text' | 'strokes' | 'image' | 'destination'>

/** A session can contain several independent notes. Only its canonical recall
 * note may seed recall text/drawings or be updated by the recall whiteboard. */
export function findRecallNote(rows:StudyNote[], itemId:number, blockId:number, id=`recall-${blockId}`):StudyNote|undefined {
  return rows.find(row=>row.id===id&&row.itemId===itemId&&row.blockId===blockId)
}

/** Dirty checks compare editable content, independently of sync status/timestamps. */
export function noteDraftSignature(note: NoteInput): string {
  const {id, itemId, blockId, title, text, strokes, image, destination} = note
  return JSON.stringify({id, itemId, blockId, title, text, strokes, image, destination})
}

export function loadRecallNoteDraft(draft: NoteInput, rows: StudyNote[], text?: string, drawing?: {strokes:Stroke[];image:string|null}): {draft:NoteInput;baseline:string;hasLocal:boolean} {
  const own = draft.blockId === null ? undefined : findRecallNote(rows,draft.itemId,draft.blockId,draft.id)
  if (own) return {draft:{...own,text:text??own.text,...(drawing??{})},baseline:noteDraftSignature(own),hasLocal:true}
  const next = {...draft,destination:rows[0]?.destination??draft.destination}
  return {draft:next,baseline:noteDraftSignature({...next,text:'',strokes:[],image:null}),hasLocal:false}
}

export function notionId(value: string): string {
  let text=value.trim()
  try{const url=new URL(text);text=/[a-f0-9]{32}/i.test(url.hash.replace(/-/g,''))?url.hash:url.pathname}catch{text=text.split('?')[0]}
  text=text.replace(/-/g,'')
  const match = text.match(/[a-f0-9]{32}(?=[?/#&]|$)/i)
  if (!match) throw new Error('Paste a Notion page or block link, or its 32-character ID.')
  const id = match[0]
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
}

/** Restrict direct vault writes to a relative Markdown filename. */
export function noteFile(value: string): string {
  const file = value.trim().replace(/\\/g, '/')
  if (!file || /^(\/|[a-z]:)/i.test(file) || file.split('/').some((part) => !part || part === '..' || part === '.' || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) throw new Error('Choose a Markdown file inside the vault, for example Study/Math.md.')
  return /\.md$/i.test(file) ? file : `${file}.md`
}

/** Only replace this application's delimited note. All other file content is retained. */
export function mergeMarkdown(existing: string, id: string, title: string, text: string, heading: string, date: string, imageFile?: string): string {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Invalid note ID.')
  const newline = existing.includes('\r\n') ? '\r\n' : '\n'
  const start = `<!-- ${DATA_IDENTITY.obsidianMarker}:${id} -->`, end = `<!-- /${DATA_IDENTITY.obsidianMarker}:${id} -->`
  const clean = (v: string) => v.replace(/[\r\n]/g, ' ').trim()
  const body = [start, `### ${clean(title) || 'Study note'} · ${date}`, '', text.replace(/\r\n?/g, '\n'), ...(imageFile ? ['', `![](${imageFile.split('/').map(encodeURIComponent).join('/')})`] : []), end].join('\n').replace(/\n/g, newline)
  const from = existing.indexOf(start), to = existing.indexOf(end, from)
  if (from >= 0 && to >= from) return existing.slice(0, from) + body + existing.slice(to + end.length)
  if (from >= 0 || existing.includes(end)) throw new Error('This note’s markers were changed in Obsidian. Restore them or save as a new note.')
  if (heading.trim()) {
    const lines = existing.split(/\r?\n/), index = lines.findIndex((line) => /^#{1,6}\s/.test(line) && line.replace(/^#{1,6}\s+/, '').trim() === heading.trim())
    if (index >= 0) { lines.splice(index + 1, 0, '', body, ''); return lines.join(newline) }
    return existing + (existing.endsWith(newline) ? newline : newline + newline) + `## ${clean(heading)}` + newline + newline + body + newline
  }
  return existing + (existing ? newline + newline : '') + body + newline
}

export function notionParagraphs(text: string): { object: 'block'; type: 'paragraph'; paragraph: { rich_text: { type: 'text'; text: { content: string } }[] } }[] {
  // Each rich-text run stays below Notion's 2000-character limit, including Unicode.
  const chunks: string[] = []
  for (const line of text.split(/\r?\n/)) { const chars = [...line]; if (!chars.length) chunks.push(''); for (let i = 0; i < chars.length; i += 900) chunks.push(chars.slice(i, i + 900).join('')) }
  return chunks.map((content) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: content ? [{ type: 'text', text: { content } }] : [] } }))
}

export function validateStrokes(value: Stroke[]): Stroke[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('The drawing is too large.')
  let points = 0
  for (const s of value) {
    if (!['pen', 'highlighter', 'eraser'].includes(s.tool) || !/^#[a-f0-9]{6}$/i.test(s.color) || !Number.isFinite(s.width) || s.width < 1 || s.width > 40 || !Array.isArray(s.points)) throw new Error('Invalid drawing.')
    points += s.points.length
    if (points > 200000 || s.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1200 || p.y < 0 || p.y > 700 || !Number.isFinite(p.pressure) || p.pressure < 0 || p.pressure > 1)) throw new Error('Invalid drawing points.')
  }
  return value
}
