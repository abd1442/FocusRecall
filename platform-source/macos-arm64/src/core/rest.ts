// The rest stage: how long, and the music link.

export interface RestRules {
  /** Minutes of rest per 5 minutes of focus. */
  minutesPerFive: number
  minMinutes: number
  maxMinutes: number
  /** Every n-th rest in a sitting is a long one. */
  longEvery: number
  longMinutes: number
}

export const DEFAULT_REST_RULES: RestRules = { minutesPerFive: 1, minMinutes: 5, maxMinutes: 15, longEvery: 4, longMinutes: 25 }

export interface RestPlan {
  seconds: number
  long: boolean
}

/**
 * Planned rest: 1 minute per 5 minutes of focus since the last rest in this
 * sitting (so blocks chained without a rest count together), kept within
 * 5 to 15 minutes. The fourth rest of a sitting (and every fourth after) is
 * a long one.
 */
export function planRest(focusSecondsSinceLastRest: number, restsTakenInSitting: number, rules: RestRules = DEFAULT_REST_RULES): RestPlan {
  const n = restsTakenInSitting + 1
  if (rules.longEvery > 0 && n % rules.longEvery === 0) return { seconds: rules.longMinutes * 60, long: true }
  const minutes = Math.round((focusSecondsSinceLastRest / 60 / 5) * rules.minutesPerFive)
  return { seconds: Math.min(rules.maxMinutes, Math.max(rules.minMinutes, minutes)) * 60, long: false }
}

/**
 * A Spotify playlist as an app link: accepts "spotify:playlist:<id>" or a
 * share link like "https://open.spotify.com/playlist/<id>?si=…".
 */
export function spotifyUri(link: string): string | null {
  const t = link.trim()
  const uri = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(t)
  if (uri) return `spotify:playlist:${uri[1]}`
  try {
    const url = new URL(t)
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'open.spotify.com' || url.port || url.username || url.password) return null
    const path = /^\/(?:intl-[a-z-]+\/)?playlist\/([A-Za-z0-9]+)\/?$/i.exec(url.pathname)
    return path ? `spotify:playlist:${path[1]}` : null
  } catch { return null }
}

export function spotifyWebUrl(link: string): string | null {
  const uri = spotifyUri(link)
  return uri ? `https://open.spotify.com/playlist/${uri.split(':')[2]}` : null
}

export const DEFAULT_REST_SUGGESTIONS = ['Take a short walk', 'Stretch', 'Drink some water', 'Look out of a window', 'Close your eyes', 'Tidy the desk']

/** The next suggestion, never the same one twice in a row. */
export function nextSuggestion(list: string[], current: string | null, random: () => number = Math.random): string | null {
  if (!list.length) return null
  if (list.length === 1) return list[0]
  const others = list.filter((s) => s !== current)
  return others[Math.floor(random() * others.length)]
}
