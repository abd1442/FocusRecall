import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
import { DEFAULT_SETTINGS } from './settings'
import { RestMusic } from '../main/restMusic'
import type { MusicPort, SpotifySession } from './music'
import { spotifyUri, spotifyWebUrl } from './rest'
import { EMPTY_DESTINATION, findRecallNote, loadRecallNoteDraft, noteDraftSignature, type NoteInput, type StudyNote } from './notes'
import { validateIpcArgs } from './ipcValidation'

describe('safe Spotify handoff', () => {
  const uri = 'spotify:playlist:Fictional123'
  function harness(result: SpotifySession | null = {id:'Spotify.exe', playing:true, wasPlaying:false, accepted:true}) {
    const open = vi.fn(async (_target:string) => {})
    const control = vi.fn<MusicPort['control']>(async () => result)
    const changed = vi.fn()
    return {open, control, changed, service:new RestMusic({open, control}, changed)}
  }
  it('opens without sending any global media key or claiming playback', async () => {
    const h = harness()
    expect(await h.service.command('open', uri)).toEqual({phase:'ready', message:'opened'})
    expect(h.open).toHaveBeenCalledWith(uri)
    expect(h.control).not.toHaveBeenCalled()
    await h.service.end()
    expect(h.control).not.toHaveBeenCalled()
  })
  it('requests Play explicitly and pauses only the identified session it started', async () => {
    const h = harness()
    await h.service.command('open', uri, true)
    expect(h.control).toHaveBeenCalledWith('play', expect.any(AbortSignal), undefined, true)
    await h.service.end()
    expect(h.control).toHaveBeenLastCalledWith('pause', expect.any(AbortSignal), 'Spotify.exe')
  })
  it('does not stop Spotify that was already playing', async () => {
    const h = harness({id:'Spotify.exe', playing:true, wasPlaying:true, accepted:true})
    await h.service.command('open', uri, true)
    await h.service.end()
    expect(h.control).toHaveBeenCalledTimes(1)
  })
  it('retains ownership after a rejected stop so a later cancellation can retry it', async()=>{
    const h=harness()
    await h.service.command('play',uri)
    h.control.mockResolvedValueOnce({id:'Spotify.exe',playing:true,accepted:false,wasPlaying:true})
    await h.service.end()
    expect(h.service.get().message).toBe('control-failed')
    h.control.mockResolvedValueOnce({id:'Spotify.exe',playing:false,accepted:true,wasPlaying:true})
    await h.service.command('cancel',uri)
    expect(h.control).toHaveBeenLastCalledWith('pause',expect.any(AbortSignal),'Spotify.exe')
    expect(h.service.get().phase).toBe('idle')
  })
  it('does not claim a delayed discovery finished or keep polling after cancellation',async()=>{
    const h=harness();let finish!:(value:SpotifySession|null)=>void
    h.control.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
    const opening=h.service.command('open',uri,true)
    await Promise.resolve()
    expect(h.service.get()).toEqual({phase:'opening',message:'connecting'})
    const signal=h.control.mock.calls[0][1]
    await h.service.command('cancel',uri)
    expect(signal.aborted).toBe(true)
    finish(null);await opening
    expect(h.service.get()).toEqual({phase:'idle',message:'idle'})
    expect(h.control).toHaveBeenCalledTimes(1)
  })
  it('cancels a slow open before a late Play can be issued', async () => {
    const h = harness()
    let finish!: () => void
    h.open.mockImplementation(() => new Promise<void>(resolve => {finish = resolve}))
    const pending = h.service.command('open', uri, true)
    await h.service.end(); finish(); await pending
    expect(h.control).not.toHaveBeenCalled()
    expect(h.service.get().phase).toBe('idle')
  })
  it('cancels in-flight native discovery and ignores its stale result', async () => {
    const h = harness()
    let finish!: (value:SpotifySession|null) => void
    h.control.mockImplementation(() => new Promise(resolve => {finish = resolve}))
    const pending = h.service.command('play', uri)
    const signal = h.control.mock.calls[0][1]
    await h.service.end(); expect(signal.aborted).toBe(true)
    finish({id:'Spotify.exe', playing:false, accepted:false}); await pending
    expect(h.service.get().phase).toBe('idle')
  })
  it('reports launch failures and offers an explicit browser handoff', async () => {
    const h = harness(); h.open.mockRejectedValueOnce(Error('No protocol handler'))
    expect((await h.service.command('open', uri)).message).toBe('open-failed')
    expect((await h.service.command('browser', uri)).message).toBe('browser')
    expect(h.open).toHaveBeenLastCalledWith('https://open.spotify.com/playlist/Fictional123')
    expect(h.control).not.toHaveBeenCalled()
  })
  it('reports missing media sessions and rejected requests honestly', async () => {
    const h = harness(null)
    expect((await h.service.command('play', uri)).message).toBe('unavailable')
    h.control.mockResolvedValue({id:'Spotify.exe', playing:false, accepted:false})
    expect((await h.service.command('play', uri)).message).toBe('control-failed')
    await h.service.end(); expect(h.control).toHaveBeenCalledTimes(2)
  })
  it('distinguishes a native control failure after a successful launch', async () => {
    const h = harness(); h.control.mockRejectedValueOnce(Error('Windows denied control'))
    expect((await h.service.command('open', uri, true)).message).toBe('control-failed')
    expect(h.open).toHaveBeenCalledTimes(1)
  })
  it('allows cancellation through IPC while a launch is pending', async () => {
    const h = harness(); let finish!: () => void
    h.open.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    const pending = h.service.command('open', uri, true)
    expect(() => validateIpcArgs('music:command', ['cancel'])).not.toThrow()
    expect(await h.service.command('cancel', uri)).toEqual({ phase:'idle', message:'idle' })
    finish(); await pending
    expect(h.control).not.toHaveBeenCalled()
  })
  it.each(['https://open.spotify.com/playlist/abc/extra','https://open.spotify.com/playlist/abc.evil','https://open.spotify.com.evil/playlist/abc','https://user:pass@open.spotify.com/playlist/abc'])('rejects ambiguous playlist destination %s', link => {
    expect(spotifyUri(link)).toBeNull(); expect(spotifyWebUrl(link)).toBeNull()
  })
})

describe('resilient settings reads', () => {
  it('keeps malformed and unsupported settings intact while opening a usable profile', () => {
    const db = openDatabase(':memory:')
    try {
      const settings = new SettingsRepo(db)
      db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('nextGoal', '{broken')
      settings.writeRaw('restRules', 'unexpected')
      settings.writeRaw('soundVolume', 999)
      settings.writeRaw('constructor', {prototype:'ignored'})
      const before = db.prepare('SELECT * FROM settings ORDER BY key').all()
      expect(settings.getAll().nextGoal).toBe(DEFAULT_SETTINGS.nextGoal)
      expect(settings.getAll().restRules).toEqual(DEFAULT_SETTINGS.restRules)
      expect(settings.getAll().soundVolume).toBe(DEFAULT_SETTINGS.soundVolume)
      expect(settings.readRaw('nextGoal')).toBeNull()
      expect(db.prepare('SELECT * FROM settings ORDER BY key').all()).toEqual(before)
      const one = settings.getAll(); one.restSuggestions.push('not a default')
      expect(settings.getAll().restSuggestions).not.toContain('not a default')
    } finally { db.close() }
  })
  it('packages only compiled application directories, excluding QA and authoring outputs', () => {
    const builder = readFileSync('electron-builder.yml','utf8')
    expect(builder).not.toContain('  - out/**')
    for (const name of ['main','preload','renderer']) expect(builder).toContain(`  - out/${name}/**`)
  })
  it.each([{...DEFAULT_SETTINGS.restRules,minMinutes:20,maxMinutes:5},{...DEFAULT_SETTINGS.restRules,minutesPerFive:-1},{...DEFAULT_SETTINGS.restRules,longEvery:1.5},{...DEFAULT_SETTINGS.restRules,longMinutes:-5}])('rejects invalid rest rules before a timer can start: %j', rules=>{
    expect(()=>validateIpcArgs('settings:set',['restRules',rules])).toThrow('valid rest durations')
  })
})

describe('recall-note draft safety', () => {
  const draft:NoteInput = {id:'recall-10',itemId:1,blockId:10,title:'Fictional recall',text:'New recall',strokes:[],image:null,destination:{...EMPTY_DESTINATION}}
  const note:StudyNote = {...draft,text:'Stored recall',updatedAt:'2026-10-16',link:null,status:'local',error:null}
  it('selects canonical recall by identity and ownership, never by list order', () => {
    const unrelated={...note,id:'independent-note',text:'Must remain separate'}
    expect(findRecallNote([unrelated],1,10)).toBeUndefined()
    expect(findRecallNote([{...note,itemId:2},{...note,blockId:11}],1,10)).toBeUndefined()
    expect(findRecallNote([unrelated,note],1,10)).toBe(note)
  })
  it('never opens or overwrites a different note belonging to the same session', () => {
    const loaded = loadRecallNoteDraft(draft,[{...note,id:'different-note'}])
    expect(loaded.draft.id).toBe('recall-10');expect(loaded.draft.text).toBe('New recall')
    expect(loaded.hasLocal).toBe(false);expect(loaded.baseline).not.toBe(noteDraftSignature(loaded.draft))
  })
  it('recognizes the saved recall note while warning about newly supplied text', () => {
    const loaded = loadRecallNoteDraft(draft,[note],'New recall')
    expect(loaded.hasLocal).toBe(true);expect(loaded.draft.text).toBe('New recall')
    expect(loaded.baseline).toBe(noteDraftSignature(note))
    expect(loaded.baseline).not.toBe(noteDraftSignature(loaded.draft))
    expect(loadRecallNoteDraft(draft,[note]).baseline).toBe(noteDraftSignature(loadRecallNoteDraft(draft,[note]).draft))
  })
  it('compares editable data without mistaking sync status or timestamps for changes', () => {
    expect(noteDraftSignature({...note,status:'synced',updatedAt:'later'} as StudyNote)).toBe(noteDraftSignature(note))
    expect(noteDraftSignature({...note,text:'changed'})).not.toBe(noteDraftSignature(note))
  })
})
