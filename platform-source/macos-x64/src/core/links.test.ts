import { describe, expect, it } from 'vitest'
import { checkLink } from './links'

describe('checkLink', () => {
  it('recognises a Spotify playlist and says what is wrong otherwise', () => {
    expect(checkLink('https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS?si=abc', 'spotify')).toMatchObject({
      ok: true,
      message: 'Playlist recognised',
      target: 'spotify:playlist:37i9dQZF1DX8Uebhn9wzrS'
    })
    expect(checkLink('https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX', 'spotify')).toMatchObject({ ok: false, message: 'This is a Spotify link, but not to a playlist' })
    expect(checkLink('hello', 'spotify').ok).toBe(false)
    expect(checkLink('  ', 'spotify')).toMatchObject({ empty: true, ok: true })
  })
  it('recognises Notion pages', () => {
    expect(checkLink('https://www.notion.so/Structures-2a1b3c', 'notion').ok).toBe(true)
    expect(checkLink('notion://www.notion.so/abc', 'notion').ok).toBe(true)
    expect(checkLink('https://example.com/page', 'notion')).toMatchObject({ ok: false, message: 'This is a web link, but not to notion.so' })
  })
  it('accepts web links, app links and file paths for resources', () => {
    expect(checkLink('https://coursera.org/learn/x', 'resource').message).toBe('Web link')
    expect(checkLink('www.example.com', 'resource').target).toBe('https://www.example.com')
    expect(checkLink('obsidian://open?vault=a', 'resource').message).toBe('App link')
    expect(checkLink('C:\\Books\\Structures.pdf', 'resource').message).toBe('File or folder on this computer')
    expect(checkLink('just words', 'resource').ok).toBe(false)
  })
})
