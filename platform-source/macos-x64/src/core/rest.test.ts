import { describe, expect, it } from 'vitest'
import { DEFAULT_REST_RULES, nextSuggestion, planRest, spotifyUri } from './rest'

const MIN = 60

describe('planRest', () => {
  it('gives 1 minute per 5 minutes of focus', () => {
    expect(planRest(50 * MIN, 0)).toEqual({ seconds: 10 * MIN, long: false })
    expect(planRest(40 * MIN, 1)).toEqual({ seconds: 8 * MIN, long: false })
  })
  it('keeps rests between 5 and 15 minutes', () => {
    expect(planRest(10 * MIN, 0).seconds).toBe(5 * MIN)
    expect(planRest(120 * MIN, 0).seconds).toBe(15 * MIN)
  })
  it('counts chained blocks since the last rest together', () => {
    // Two 25-minute blocks switched without a rest: 50 minutes, so 10 minutes of rest.
    expect(planRest(25 * MIN + 25 * MIN, 0).seconds).toBe(10 * MIN)
  })
  it('makes every fourth rest in a sitting a long one', () => {
    expect(planRest(25 * MIN, 3)).toEqual({ seconds: 25 * MIN, long: true })
    expect(planRest(25 * MIN, 7)).toEqual({ seconds: 25 * MIN, long: true })
    expect(planRest(25 * MIN, 4).long).toBe(false)
  })
  it('follows changed rules', () => {
    expect(planRest(30 * MIN, 0, { ...DEFAULT_REST_RULES, minutesPerFive: 2, maxMinutes: 20 }).seconds).toBe(12 * MIN)
    expect(planRest(30 * MIN, 1, { ...DEFAULT_REST_RULES, longEvery: 2, longMinutes: 30 }).seconds).toBe(30 * MIN)
  })
})

describe('spotifyUri', () => {
  it('accepts app links and share links', () => {
    expect(spotifyUri('spotify:playlist:37i9dQZF1DX8NTLI2TtZa6')).toBe('spotify:playlist:37i9dQZF1DX8NTLI2TtZa6')
    expect(spotifyUri('https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6?si=abc123')).toBe('spotify:playlist:37i9dQZF1DX8NTLI2TtZa6')
    expect(spotifyUri('https://open.spotify.com/intl-de/playlist/37i9dQZF1DX8NTLI2TtZa6')).toBe('spotify:playlist:37i9dQZF1DX8NTLI2TtZa6')
  })
  it('rejects anything else', () => {
    expect(spotifyUri('https://open.spotify.com/album/123')).toBeNull()
    expect(spotifyUri('lofi beats')).toBeNull()
  })
})

describe('nextSuggestion', () => {
  it('never repeats the current one', () => {
    const list = ['Walk', 'Stretch', 'Water']
    for (let i = 0; i < 20; i++) expect(nextSuggestion(list, 'Walk')).not.toBe('Walk')
    expect(nextSuggestion(['Walk'], 'Walk')).toBe('Walk')
    expect(nextSuggestion([], null)).toBeNull()
  })
})
