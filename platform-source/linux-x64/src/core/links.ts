// Checking links typed or pasted into link fields, so the field can say at
// once whether it understood them.
import { spotifyUri } from './rest'

export type LinkKind = 'spotify' | 'notion' | 'resource'

export interface LinkCheck {
  /** Nothing typed: no message. */
  empty: boolean
  ok: boolean
  /** "Playlist recognised", or what is wrong. */
  message: string
  /** What "Test" opens. */
  target: string | null
}

/** Check a link for the kind of field it is in. */
export function checkLink(text: string, kind: LinkKind): LinkCheck {
  const t = text.trim()
  if (!t) return { empty: true, ok: true, message: '', target: null }
  if (kind === 'spotify') {
    const uri = spotifyUri(t)
    if (uri) return { empty: false, ok: true, message: 'Playlist recognised', target: uri }
    if (/spotify\.com\/(intl-[a-z-]+\/)?(album|track|artist|show|episode)\//i.test(t) || /^spotify:(album|track|artist):/i.test(t))
      return { empty: false, ok: false, message: 'This is a Spotify link, but not to a playlist', target: null }
    return { empty: false, ok: false, message: 'Not a Spotify playlist link. In Spotify: the playlist’s ⋯ menu, Share, Copy link to playlist.', target: null }
  }
  if (kind === 'notion') {
    const web = /^https?:\/\/(www\.)?notion\.(so|site)\/\S+/i.test(t)
    const app = /^notion:\/\/\S+/i.test(t)
    if (web || app) return { empty: false, ok: true, message: 'Notion page recognised', target: t }
    if (/^https?:\/\//i.test(t)) return { empty: false, ok: false, message: 'This is a web link, but not to notion.so', target: null }
    return { empty: false, ok: false, message: 'Not a Notion page link. In Notion: Share, Copy link.', target: null }
  }
  // Resources: a web link, an app link, or a file or folder path.
  if (/^https?:\/\/[^\s.]+\.[^\s]+/i.test(t)) return { empty: false, ok: true, message: 'Web link', target: t }
  if (/^(notion|obsidian|spotify|mailto):\S+/i.test(t)) return { empty: false, ok: true, message: 'App link', target: t }
  if (/^[a-z]:[\\/]/i.test(t) || /^\\\\[^\\]+\\/.test(t)) return { empty: false, ok: true, message: 'File or folder on this computer', target: t }
  if (/^www\./i.test(t)) return { empty: false, ok: true, message: 'Web link', target: `https://${t}` }
  return { empty: false, ok: false, message: 'Not a link or a file path that FocusRecall understands', target: null }
}
