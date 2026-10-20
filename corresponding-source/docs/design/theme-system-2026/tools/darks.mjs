// Dark themes, round 2 (2026-10-17). The owner rejected round 1 as too vibrant and chose
// Pewter Dim as the best. Every dark now follows Pewter Dim's recipe:
//   - dim, not deep: canvas OKLCH L 0.25–0.29 (round 1 was ~0.20)
//   - near-neutral surfaces: chroma <= 0.022, mostly <= 0.015
//   - text ~10–12:1 instead of 13–14:1
//   - accents and stages muted: chroma <= ~0.09 (citrine, the approved reference, is 0.117)
// Colours are written as [L, C, H] in OKLCH so the restraint is explicit and auditable.
import { oklch } from './color.mjs'

const c = (v) => oklch(v[0], v[1], v[2])

/**
 * One recipe for every dim dark. Per theme: undertone hue and strength, canvas lightness,
 * text tint, accent, mark, the four stages, and optionally a sidebar override.
 */
function dim(o) {
  const { hue, tint = 0.01, L = 0.27, textHue = 85, textTint = 0.012 } = o
  const S = (dl, k = 1) => oklch(L + dl, tint * k, hue)
  return {
    id: o.id, name: o.name, mode: 'dark', pairsWith: o.pairsWith, family: o.family, mood: o.mood, tagline: o.tagline, story: o.story,
    isDefault: !!o.isDefault, candidate: o.candidate ?? null,
    canvas: S(0), sunken: S(-0.035), base: S(0.035), raised: S(0.07), border: S(0.13, 1.1),
    text: oklch(0.93, textTint, textHue), text2: oklch(0.8, textTint * 1.15, textHue),
    accent: c(o.accent), onAccent: oklch(0.25, Math.min(o.accent[1] * 0.5, 0.04), o.accent[2]), mark: c(o.mark),
    focus: c(o.focus ?? o.accent), recall: c(o.recall), rest: c(o.rest), overtime: c(o.overtime),
    illu: { line: oklch(0.9, textTint, textHue), wash: S(0.08), highlight: c(o.illu ?? o.mark) },
    nav: { bg: o.navBg ? c(o.navBg) : S(-0.025), active: o.navActive ? c(o.navActive) : oklch(L + 0.12, Math.max(tint * 1.4, 0.012), o.navHue ?? hue) },
    chart: { shift: 0, chroma: o.chartChroma ?? 0.075, ...(o.warmOnly ? { warmOnly: true } : {}) }
  }
}

// Shared muted stage defaults (sky, lilac, sea-glass, apricot). Themes override where they need a different note.
const ST = { focus: [0.77, 0.06, 245], recall: [0.78, 0.06, 305], rest: [0.79, 0.055, 175], overtime: [0.77, 0.075, 50] }

// ───────────── Default-dark candidates (to pair with Ivory & Ink) ─────────────
const CANDIDATES = [
  dim({ id: 'ink-night', name: 'Ink Night', candidate: 'A', pairsWith: 'ivory-ink', family: 'Brand', mood: ['deep', 'brand', 'quiet'],
    tagline: 'Round 2: deep ink, ivory type, a softened amber.',
    story: 'The original idea with the volume turned down. The canvas is lifted from 0.21 to 0.25 lightness and the blue undertone halved, so it reads as ink-grey rather than navy. Amber drops from chroma 0.125 to 0.085, so the Start button is still the brightest object but no longer glows. Ivory text sits at about 11:1 instead of 13:1.',
    hue: 245, tint: 0.022, L: 0.25, accent: [0.8, 0.085, 75], mark: [0.8, 0.085, 75], ...ST, overtime: [0.76, 0.075, 40] }),
  dim({ id: 'ink-dim', name: 'Ink Dim', isDefault: true, candidate: 'B', pairsWith: 'ivory-ink', family: 'Brand', mood: ['dim', 'soft', 'brand'],
    tagline: 'Pewter Dim\'s lightness with an ink undertone and muted amber.',
    story: 'Closest to the theme you liked best. It uses Pewter Dim\'s surface lightness, so it sits at a dim grey rather than a dark room, and keeps a gentle ink-blue undertone so it still belongs to FocusRecall. Amber is the only warm note, softened to a honey tone.',
    hue: 245, tint: 0.014, L: 0.285, accent: [0.81, 0.08, 78], mark: [0.81, 0.08, 78], ...ST }),
  dim({ id: 'ink-rail', name: 'Ink Rail', candidate: 'C', pairsWith: 'ivory-ink', family: 'Brand', mood: ['neutral', 'branded', 'structured'],
    tagline: 'Neutral pewter workspace, a deep-ink sidebar, amber actions.',
    story: 'Puts the brand in one place only: the sidebar is solid brand ink, as on the logo board, and the workspace is a neutral pewter like Pewter Dim. Content areas carry no tint at all, so subject colours and charts read exactly, while the app still looks unmistakably FocusRecall.',
    hue: 260, tint: 0.005, L: 0.28, accent: [0.81, 0.085, 78], mark: [0.81, 0.085, 78], ...ST,
    navBg: [0.27, 0.04, 245], navActive: [0.37, 0.05, 245] }),
  dim({ id: 'ink-slate', name: 'Ink Slate', candidate: 'D', pairsWith: 'ivory-ink', family: 'Brand', mood: ['cool', 'calm', 'ink-first'],
    tagline: 'Slate-blue dim with steel-ink actions; amber only as a mark.',
    story: 'Mirrors the light theme\'s logic: in Ivory & Ink the action colour is ink and amber is only a mark, and here it is the same, with ink lifted to a steel blue that stays legible on slate. It is the calmest candidate, with no warm fill anywhere except the bookmark.',
    hue: 240, tint: 0.02, L: 0.29, accent: [0.79, 0.06, 240], mark: [0.8, 0.085, 75], ...ST, focus: [0.79, 0.06, 240], recall: [0.79, 0.055, 310] }),
  dim({ id: 'ink-brass', name: 'Ink & Brass', candidate: 'E', pairsWith: 'ivory-ink', family: 'Brand', mood: ['warm', 'library at night', 'mature'],
    tagline: 'Warm graphite, brass actions, an ink-blue Focus stage.',
    story: 'A warm-neutral dark, like a lamp-lit desk, with brass (amber taken down to a metal tone) for actions and the brand ink lifted to sky for the Focus stage, so the brand is still present in pressing and doing. The least "blue" of the candidates.',
    hue: 70, tint: 0.008, L: 0.27, accent: [0.79, 0.07, 85], mark: [0.79, 0.07, 85], ...ST, focus: [0.77, 0.055, 245] })
]

// ───────────── Dark library, round 2 ─────────────
const LIBRARY = [
  {
    // The owner's reference ("the best"): original seeds kept exactly.
    id: 'pewter-dim', name: 'Pewter Dim', mode: 'dark', pairsWith: 'graphite',
    family: 'Soft', mood: ['dim', 'soft contrast', 'modern'],
    tagline: 'A dim (not black) mode: pewter grey with a citrine accent.',
    story: 'The reference for every dark theme in round 2. Surfaces sit around 25–30% lightness and text contrast is held near 10:1 instead of 15:1, which avoids halation. Citrine on pewter is a modern, gentle pairing, and the only yellow action colour in the dark set.',
    canvas: '#26282C', sunken: '#202226', base: '#2E3035', raised: '#373A40', border: '#474A51',
    text: '#E3E4E2', text2: '#BEC0C3',
    accent: '#E9C46A', onAccent: '#2A2208', mark: '#E9C46A',
    // Round 2: citrine kept; the other stages muted to the shared dark cap (were #C7AEE6, #86CFB4, #F08F6E).
    focus: '#E9C46A', recall: c([0.79, 0.07, 305]), rest: c([0.8, 0.07, 170]), overtime: c([0.77, 0.085, 40]),
    illu: { line: '#E8E8E4', wash: '#3A3D44', highlight: '#E9C46A' },
    nav: { bg: '#222428', active: '#42464E' },
    chart: { shift: 0, chroma: 0.085 }
  },
  dim({ id: 'graphite-night', name: 'Graphite Night', pairsWith: 'graphite', family: 'Neutral', mood: ['minimal', 'neutral', 'technical'],
    tagline: 'Neutral graphite, a quiet azure, one muted vermilion signal.',
    story: 'Kept from round 1 but lifted to dim, and the azure taken from chroma 0.11 to 0.07 so it reads as a calm blue rather than a highlight. Still zero tint in the surfaces, so subject colours and charts read exactly as chosen.',
    hue: 260, tint: 0.003, L: 0.26, textHue: 90, textTint: 0.004, accent: [0.78, 0.07, 250], mark: [0.72, 0.1, 35], ...ST, focus: [0.78, 0.07, 250] }),
  dim({ id: 'indigo-hour', name: 'Indigo Hour', pairsWith: 'cobalt', family: 'Cool', mood: ['dreamy', 'nocturnal', 'soft'],
    tagline: 'Dusk indigo, periwinkle and pale starlight.',
    story: 'Round 1 was the most chromatic dark; now the indigo lives only as a faint undertone (0.02), the periwinkle is a soft lavender-blue and the starlight mark is pale. It keeps the twilight mood without glowing.',
    hue: 280, tint: 0.02, L: 0.265, textHue: 280, textTint: 0.012, accent: [0.79, 0.07, 278], mark: [0.86, 0.065, 88], ...ST, focus: [0.79, 0.07, 278], recall: [0.8, 0.06, 340] }),
  dim({ id: 'chalkboard', name: 'Chalkboard', pairsWith: 'matcha', family: 'Expressive', mood: ['playful', 'classroom', 'matte'],
    tagline: 'Matte slate board, chalk text, pink and blue chalk.',
    story: 'Kept and made more matte: chalk colours are now real pastels (chroma ≤ 0.065), the slate is a little lighter, and the Focus stage is a dusty blue chalk rather than ice blue. Pink chalk for actions, yellow chalk for marks.',
    hue: 175, tint: 0.012, L: 0.27, textHue: 140, textTint: 0.008, accent: [0.8, 0.06, 5], mark: [0.86, 0.075, 95],
    focus: [0.79, 0.05, 235], recall: [0.79, 0.055, 300], rest: [0.81, 0.06, 140], overtime: [0.78, 0.07, 55] }),
  dim({ id: 'espresso', name: 'Espresso', pairsWith: 'library', family: 'Warm', mood: ['cosy', 'evening', 'muted'],
    tagline: 'Dim mocha grey, an enamel-blue action, crema mark.',
    story: 'Round 1 was a deep brown room. Now the brown is only an undertone on a dim grey, the kind of warmth you notice rather than see, and the enamel blue is very muted. It is the warm counterpart to Pewter Dim.',
    hue: 55, tint: 0.012, L: 0.265, textHue: 75, textTint: 0.016, accent: [0.79, 0.05, 230], mark: [0.82, 0.065, 85],
    // Stages separated by lightness, not saturation, so they stay apart for colour-blind users.
    focus: [0.79, 0.05, 230], recall: [0.7, 0.06, 350], rest: [0.85, 0.05, 165], overtime: [0.75, 0.08, 60] }),
  dim({ id: 'evergreen', name: 'Evergreen', pairsWith: 'celadon', family: 'Natural', mood: ['natural', 'restful', 'muted'],
    tagline: 'Moss-grey dim, sage actions, lantern mark.',
    story: 'The green is now an undertone in grey stone rather than a forest-black, and the mint accent became a sage (chroma 0.096 → 0.055). It reads as quiet and natural, not "green theme".',
    hue: 160, tint: 0.013, L: 0.265, textHue: 140, textTint: 0.01, accent: [0.8, 0.055, 155], mark: [0.83, 0.065, 85], ...ST, focus: [0.8, 0.055, 155], rest: [0.79, 0.05, 225] }),
  dim({ id: 'aubergine', name: 'Aubergine', pairsWith: 'wisteria', family: 'Elegant', mood: ['elegant', 'soft', 'velvet'],
    tagline: 'Plum-grey dim, dusty mauve, rose-gold mark.',
    story: 'Orchid on velvet became dusty mauve on a plum-grey: the elegance stays, the saturation goes. Rose-gold marks give a little warmth.',
    hue: 315, tint: 0.013, L: 0.265, textHue: 320, textTint: 0.01, accent: [0.8, 0.06, 315], mark: [0.82, 0.05, 40], ...ST, focus: [0.8, 0.06, 315], recall: [0.79, 0.055, 0] }),
  dim({ id: 'deep-sea', name: 'Deep Sea', pairsWith: 'lagoon', family: 'Cool', mood: ['cool', 'calm', 'coastal'],
    tagline: 'Blue-grey dim, a soft coral action, sea-glass focus.',
    story: 'Keeps the coral/aqua idea but both are now muted: coral is a dusty shell pink-orange and aqua a sea-glass. The canvas is a dim harbour grey with a light blue undertone.',
    hue: 215, tint: 0.016, L: 0.265, textHue: 200, textTint: 0.01, accent: [0.79, 0.065, 35], mark: [0.85, 0.06, 80], ...ST, focus: [0.8, 0.055, 190], overtime: [0.8, 0.07, 75] }),
  dim({ id: 'lichen', name: 'Lichen', pairsWith: 'matcha', family: 'Earthy', mood: ['earthy', 'organic', 'muted'],
    tagline: 'Olive-grey stone, a soft lichen accent, persimmon mark.',
    story: 'Chartreuse dropped to a soft lichen (chroma 0.117 → 0.07) on an olive-grey dim stone. Still the one non-blue, non-grey dark, now gentle enough for long sessions.',
    hue: 110, tint: 0.012, L: 0.27, textHue: 100, textTint: 0.012, accent: [0.83, 0.07, 115], mark: [0.78, 0.075, 45], ...ST, focus: [0.83, 0.07, 115] }),
  dim({ id: 'darkroom', name: 'Darkroom', pairsWith: 'terracotta', family: 'Night', mood: ['late night', 'low blue light', 'warm'],
    tagline: 'Low-blue late-night mode: warm umber dim, muted terracotta.',
    story: 'Still the purpose-built after-midnight theme with almost no blue emission, but no longer a red safelight: an umber dim with parchment text and a muted terracotta. Charts lean on lightness steps and labels (documented trade-off).',
    hue: 35, tint: 0.014, L: 0.235, textHue: 65, textTint: 0.028, accent: [0.74, 0.085, 38], mark: [0.8, 0.08, 70],
    focus: [0.74, 0.085, 38], recall: [0.76, 0.05, 0], rest: [0.8, 0.06, 105], overtime: [0.84, 0.08, 85], warmOnly: true })
]

export const DARKS = [...CANDIDATES, ...LIBRARY]
export const DEFAULT_DARK_CANDIDATES = CANDIDATES.map((t) => t.id)
