import { clipboard, ClipboardItem } from 'electron'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { lstat,mkdir,readFile,realpath,rename,unlink,writeFile } from 'node:fs/promises'
import { EMPTY_DESTINATION, mergeMarkdown, noteFile, validateStrokes, type NoteInput, type StudyNote } from '@core/notes'
import type { Db } from './db/database'
import type { SettingsRepo } from './repos/settings'
import { DATA_IDENTITY } from '@core/identity'

export class NotesService {
  private pendingSaves = 0
  get isBusy(): boolean { return this.pendingSaves > 0 }
  private externalQueues=new Map<string,Promise<void>>()
  private revisions=new Map<string,number>()
  private sendingNotes=new Map<string,number>()
  constructor(private db: Db, private settings: SettingsRepo, _request: typeof fetch = fetch, private externalWriter?:(note:NoteInput)=>Promise<string>) {}
  // Legacy IPC clients cannot reconnect or upload to the removed integration.
  configured(): boolean { return false }
  setToken(token: string): void {
    if (token.trim()) throw new Error('Notion integration has been removed. Use Obsidian or save locally.')
    this.settings.writeRaw('notionTokenEncrypted', null)
  }
  async sections(_page: string): Promise<{id:string;label:string;placement:'inside'|'after'}[]> {
    throw new Error('Notion integration has been removed. Use Obsidian or save locally.')
  }
  list(itemId: number, blockId?: number): StudyNote[] {
    const rows = blockId === undefined ? this.db.prepare('SELECT * FROM study_notes WHERE item_id = ? ORDER BY updated_at DESC').all(itemId) : this.db.prepare('SELECT * FROM study_notes WHERE item_id = ? AND block_id = ? ORDER BY updated_at DESC').all(itemId, blockId)
    return (rows as Record<string, unknown>[]).map((r) => ({ id: String(r.id), itemId: Number(r.item_id), blockId: r.block_id as number | null, title: String(r.title), text: String(r.text), strokes: JSON.parse(String(r.strokes)), image: r.image as string | null, destination: JSON.parse(String(r.destination)), updatedAt: String(r.updated_at), link: r.link as string | null, status: r.status as StudyNote['status'], error: r.error as string | null }))
  }
  search(query: string): StudyNote[] {
    const rows = this.db.prepare("SELECT DISTINCT item_id FROM study_notes").all() as { item_id: number }[]
    const needle = query.toLocaleLowerCase()
    return rows.flatMap(r => this.list(r.item_id)).filter(n => `${n.title}\n${n.text}`.toLocaleLowerCase().includes(needle)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  /** Remove only a standalone local note; exported files and session recall are separate. */
  delete(id: string): void {
    if (!/^[a-z0-9-]{1,80}$/i.test(id)) throw new Error('Invalid note ID.')
    if (this.sendingNotes.has(id)) throw new Error('Wait for this note to finish sending before deleting it.')
    const note=this.db.prepare('SELECT block_id FROM study_notes WHERE id=?').get(id) as {block_id:number|null}|undefined
    if(note && note.block_id!==null)throw new Error('This note belongs to a session. Edit it from the session instead.')
    this.db.prepare('DELETE FROM study_notes WHERE id=? AND block_id IS NULL').run(id)
    this.revisions.delete(id)
  }
  async save(input: NoteInput, sync: boolean): Promise<StudyNote> {
    // SQLite is committed before any vault operation can wait or fail.
    const saved=this.saveLocal(input),revision=(this.revisions.get(input.id)??0)+1
    this.revisions.set(input.id,revision)
    if(!sync || input.destination.kind==='none')return saved
    const snapshot:NoteInput=JSON.parse(JSON.stringify(input))
    // "Notes" and "Notes.md" name the same vault file. Queue their writes
    // together so simultaneous exports cannot read an old version and lose a note.
    let key=`removed:${snapshot.id}`
    if(snapshot.destination.kind==='obsidian'){
      try{key=resolve(snapshot.destination.vaultPath,noteFile(snapshot.destination.file)).toLowerCase()}
      catch{/* Invalid destinations are reported below after the local save. */}
    }
    const previous=this.externalQueues.get(key)??Promise.resolve()
    this.pendingSaves++
    this.sendingNotes.set(input.id,(this.sendingNotes.get(input.id)??0)+1)
    const task=previous.then(async()=>{
      if(this.revisions.get(snapshot.id)!==revision)return
      try{
        if(snapshot.destination.kind!=='obsidian')throw new Error('This old destination is no longer supported. Choose Obsidian; your note is saved locally.')
        const link=await (this.externalWriter?this.externalWriter(snapshot):this.writeObsidian(snapshot))
        if(!this.db.open || this.revisions.get(snapshot.id)!==revision)return
        this.db.transaction(()=>{
          this.db.prepare("UPDATE study_notes SET status='synced',error=NULL,link=? WHERE id=?").run(link,snapshot.id)
          if(snapshot.blockId!==null)this.db.prepare('UPDATE blocks SET notes_link=? WHERE id=?').run(link,snapshot.blockId)
        })()
      }catch(err){
        if(this.db.open && this.revisions.get(snapshot.id)===revision)this.db.prepare("UPDATE study_notes SET status='failed',error=? WHERE id=?").run(err instanceof Error?err.message:String(err),snapshot.id)
      }
    })
    const settled=task.then(()=>undefined,()=>undefined);this.externalQueues.set(key,settled)
    try{await task;return this.db.open?this.list(input.itemId,input.blockId??undefined).find(n=>n.id===input.id)!:saved}
    finally{this.pendingSaves--;const remaining=(this.sendingNotes.get(input.id)??1)-1;if(remaining)this.sendingNotes.set(input.id,remaining);else this.sendingNotes.delete(input.id);if(this.externalQueues.get(key)===settled)this.externalQueues.delete(key)}
  }
  private saveLocal(input: NoteInput): StudyNote {
    return this.db.transaction(() => {
      if (!/^[a-z0-9-]{1,80}$/i.test(input.id) || input.text.length > 150000 || input.title.length > 200 || input.image && (!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(input.image) || input.image.length > 8_000_000)) throw new Error('The note is too large or invalid.')
      validateStrokes(input.strokes)
      const old = this.db.prepare('SELECT item_id, block_id FROM study_notes WHERE id = ?').get(input.id) as { item_id: number; block_id: number | null } | undefined
      if (old && (old.item_id !== input.itemId || old.block_id !== null && old.block_id !== input.blockId)) throw new Error('This note belongs to another subject or session.')
      if (input.blockId !== null && !this.db.prepare('SELECT id FROM blocks WHERE id = ? AND item_id = ?').get(input.blockId, input.itemId)) throw new Error('The note does not match this session subject.')
      const previousLink = this.db.prepare('SELECT link FROM study_notes WHERE id = ?').get(input.id) as {link:string|null}|undefined
      this.db.prepare(`INSERT INTO study_notes (id,item_id,block_id,title,text,strokes,image,destination,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET status=CASE WHEN title=excluded.title AND text=excluded.text AND strokes=excluded.strokes AND image IS excluded.image AND destination=excluded.destination AND status='synced' THEN status ELSE 'local' END,
        link=CASE WHEN destination=excluded.destination THEN link ELSE NULL END,
        block_id=excluded.block_id,title=excluded.title,text=excluded.text,strokes=excluded.strokes,image=excluded.image,destination=excluded.destination,updated_at=excluded.updated_at,error=NULL`).run(input.id,input.itemId,input.blockId,input.title,input.text,JSON.stringify(input.strokes),input.image,JSON.stringify({ ...EMPTY_DESTINATION, ...input.destination }),new Date().toISOString())
      const saved=this.list(input.itemId, input.blockId ?? undefined).find((n) => n.id === input.id)!
      if(input.blockId!==null&&saved.link)this.db.prepare('UPDATE blocks SET notes_link=? WHERE id=?').run(saved.link,input.blockId)
      else if(input.blockId!==null && previousLink?.link)this.db.prepare('UPDATE blocks SET notes_link=NULL WHERE id=? AND notes_link=?').run(input.blockId,previousLink.link)
      return saved
    })()
  }
  private async safePath(vault: string, filename: string): Promise<string> {
    if (!vault) throw new Error('Choose your Obsidian vault folder in Settings or this note.')
    const root = await realpath(vault), target = resolve(root, noteFile(filename)), rel = relative(root, target)
    if (rel.startsWith('..') || resolve(root, rel) !== target) throw new Error('The file must stay inside the selected vault.')
    let cursor = root
    for (const part of rel.split(sep)) { cursor=join(cursor,part);try{if((await lstat(cursor)).isSymbolicLink())throw new Error('Choose a note without symbolic links or junctions inside the vault.')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e} }
    return target
  }
  private async writeObsidian(note: NoteInput): Promise<string> {
    const d = note.destination, file = await this.safePath(d.vaultPath,d.file)
    await mkdir(dirname(file), { recursive: true })
    let existing='',existed=false;try{existing=await readFile(file,'utf8');existed=true}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
    let imageFile: string | undefined
    if (note.image) {
      imageFile = `A14Pomodoro-${note.id}.png`
      // Keep an existing attachment's name, including notes sent before the rename.
      const candidates=DATA_IDENTITY.drawingPrefixes.map(prefix=>`${prefix}-${note.id}.png`)
      const linked=candidates.find(name=>existing.includes(`](${name})`))
      if(linked)imageFile=linked
      else for(const name of candidates){try{const info=await lstat(join(dirname(file),name));if(info.isSymbolicLink())throw new Error('The drawing path is a symbolic link.');if(info.isFile()){imageFile=name;break}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
      const imagePath = join(dirname(file),imageFile)
      try{if((await lstat(imagePath)).isSymbolicLink())throw new Error('The drawing path is a symbolic link.')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
      await writeFile(imagePath, Buffer.from(note.image.split(',')[1], 'base64'))
    }
    const merged = mergeMarkdown(existing,note.id,note.title,note.text,d.heading,new Date().toLocaleDateString(),imageFile)
    const temporary = `${file}.focusrecall-${randomUUID()}.tmp`
    try {
      await writeFile(temporary,merged,{encoding:'utf8',flag:'wx'})
      // Detect another editor's changes during preparation. Atomic replacement
      // still cannot coordinate an uncooperative writer after this last check.
      let current:string|null=null
      try{current=await readFile(file,'utf8')}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
      if(current!==(existed?existing:null))throw new Error('The Obsidian file changed while sending. Your note is saved locally. Try sending again.')
      await rename(temporary,file)
    } finally {try{await unlink(temporary)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
    return `obsidian://open?vault=${encodeURIComponent(d.vaultName || basename(resolve(d.vaultPath)))}&file=${encodeURIComponent(noteFile(d.file).replace(/\.md$/i,''))}`
  }
  async copy(note: NoteInput, image: boolean): Promise<void> { if (image && note.image) await clipboard.write([new ClipboardItem({ 'image/png': new Blob([Buffer.from(note.image.split(',')[1],'base64')],{type:'image/png'}) })]); else await clipboard.writeText(note.text) }
}
