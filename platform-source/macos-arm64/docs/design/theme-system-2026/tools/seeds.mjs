// FocusRecall theme system 2026 — hand-picked seed colours (art direction).
// Every value here is chosen by eye; build.mjs derives the remaining states
// (hover, pressed, selected, disabled, status, chart, heat ramp) and checks them.
// Proposal only: nothing here is imported by the app.

export const BRAND = { ink: '#183D56', amber: '#CC8C30', ivory: '#FFFDF7' }

/**
 * Seed fields
 *  canvas   window background          sunken  inputs, wells, chips
 *  base     cards, tiles               raised  dialogs, menus, floating panel
 *  border   default hairline           text / text2   primary and secondary text
 *  accent   primary action fill        onAccent text on accent
 *  mark     the theme's small highlight (bookmark, today marker, streak)
 *  focus / recall / rest / overtime   stage colours (graphics, >= 3:1 on base)
 *  illu     Learn illustration: line, wash, highlight
 *  nav      sidebar background and active item background
 *  chart    hue rotation and chroma for the categorical series
 */
import { DARKS } from './darks.mjs'

const LIGHTS = [
  // ───────────────────────────── DEFAULTS ─────────────────────────────
  {
    id: 'ivory-ink', name: 'Ivory & Ink', mode: 'light', isDefault: true, pairsWith: 'ink-dim',
    family: 'Brand', mood: ['warm', 'scholarly', 'calm'],
    tagline: 'Brand ivory paper, ink-blue actions, a single amber bookmark.',
    story: 'The brand board translated literally: ivory #FFFDF7 is the card stock, Ink #183D56 is the only filled colour, Amber #CC8C30 is reserved for small marks (bookmark, today, streak) so it never competes with content. Text is a deep ink rather than black, which keeps the page warm without looking sepia.',
    canvas: '#F5F1E8', sunken: '#EDE7DA', base: '#FFFDF7', raised: '#FFFEFB', border: '#E3DBCB',
    text: '#1B2F40', text2: '#4B5866',
    accent: '#183D56', onAccent: '#FFFDF7', mark: '#CC8C30',
    focus: '#245679', recall: '#6D4C8C', rest: '#2C6E6E', overtime: '#B0532C',
    illu: { line: '#183D56', wash: '#EFE4CF', highlight: '#CC8C30' },
    nav: { bg: '#EFE8D9', active: '#183D56' },
    chart: { shift: 0, chroma: 0.11 }
  },

  // ───────────────────────────── LIGHT LIBRARY ─────────────────────────────
  {
    id: 'library', name: 'Library', mode: 'light', pairsWith: 'espresso',
    family: 'Warm', mood: ['scholarly', 'warm', 'bound'],
    tagline: 'Oatmeal paper, walnut type, oxblood leather and brass.',
    story: 'Built from a reading room: bookcloth oxblood for actions, brass for the bookmark, walnut instead of grey for text. Every neutral carries the same brown undertone, so nothing reads as a stray grey. The recall indigo is the colour of an old bookbinding, which keeps it serious next to oxblood.',
    canvas: '#F0EAE0', sunken: '#E7DFD2', base: '#FBF8F2', raised: '#FFFDF9', border: '#DDD3C3',
    text: '#2B2420', text2: '#5C5149',
    accent: '#7B2D3B', onAccent: '#FBF6EF', mark: '#B8893A',
    focus: '#833445', recall: '#3F5688', rest: '#4E6E4A', overtime: '#A9621C',
    illu: { line: '#3A2E28', wash: '#E9DCC6', highlight: '#7B2D3B' },
    nav: { bg: '#E8DFD0', active: '#3A2E28' },
    chart: { shift: 6, chroma: 0.10 }
  },
  {
    id: 'terracotta', name: 'Terracotta', mode: 'light', pairsWith: 'espresso',
    family: 'Earthy', mood: ['expressive', 'sunlit', 'mediterranean'],
    tagline: 'Sun-baked plaster, terracotta tile, a deep teal shutter.',
    story: 'The one deliberately expressive warm theme. Terracotta and deep teal are near complements, so a single teal mark carries a lot of energy without a second bright colour. The plaster background is pink-beige, not yellow, which keeps terracotta from turning orange-on-orange.',
    canvas: '#F5ECE3', sunken: '#EDE1D5', base: '#FFF9F3', raised: '#FFFCF8', border: '#E6D5C5',
    text: '#3A2620', text2: '#6A5045',
    accent: '#B0472B', onAccent: '#FFF7F0', mark: '#2F6B73',
    focus: '#B0472B', recall: '#2F6670', rest: '#67803F', overtime: '#9C6A0A',
    illu: { line: '#3A2620', wash: '#F0D9C6', highlight: '#B0472B' },
    nav: { bg: '#EEDFD1', active: '#B0472B' },
    chart: { shift: 4, chroma: 0.12 }
  },
  {
    id: 'saffron', name: 'Saffron', mode: 'light', pairsWith: 'ink-brass',
    family: 'Warm', mood: ['bright', 'optimistic', 'energising'],
    tagline: 'Cream and saffron with espresso type and a slate bookmark.',
    story: 'Takes the brand amber and lets it lead: buttons are saffron with dark type (the inverse of most apps), which feels sunny but not loud. Because a yellow fill is never legible as text, links and labels use a separate deep-ochre "accent text" token — the system makes this distinction explicit for every theme.',
    canvas: '#FAF5E8', sunken: '#F2EAD5', base: '#FFFCF2', raised: '#FFFFFA', border: '#E9DDBF',
    text: '#2A2418', text2: '#5D533F',
    accent: '#D79A22', onAccent: '#2A1E05', mark: '#2F4F6F',
    focus: '#A87210', recall: '#7C4F8E', rest: '#3F7A6A', overtime: '#B5442A',
    illu: { line: '#2A2418', wash: '#F5E3B5', highlight: '#D79A22' },
    nav: { bg: '#F3EAD2', active: '#2A2418' },
    chart: { shift: 0, chroma: 0.12 }
  },
  {
    id: 'matcha', name: 'Matcha', mode: 'light', pairsWith: 'lichen',
    family: 'Natural', mood: ['earthy', 'herbal', 'grounded'],
    tagline: 'Parchment with a green cast, matcha olive and a clay-pot accent.',
    story: 'An olive, not a "success green": the accent sits at a yellow-green hue that never reads as a status colour. Umeboshi plum for recall and stream blue for rest are both muted to the same depth as the olive so the stage colours read as one family.',
    canvas: '#EEEEE2', sunken: '#E4E5D5', base: '#FAFAF2', raised: '#FEFEF8', border: '#D8DAC6',
    text: '#262B1E', text2: '#545B45',
    accent: '#56692A', onAccent: '#FBFBF2', mark: '#B0703A',
    focus: '#56692A', recall: '#8A4F6A', rest: '#3B7385', overtime: '#B05A2A',
    illu: { line: '#2E3424', wash: '#DFE5C6', highlight: '#7E9A3A' },
    nav: { bg: '#E5E7D6', active: '#3B4626' },
    chart: { shift: 6, chroma: 0.10 }
  },
  {
    id: 'celadon', name: 'Celadon', mode: 'light', pairsWith: 'evergreen',
    family: 'Soft', mood: ['tranquil', 'soft', 'airy'],
    tagline: 'Celadon glaze, jade actions and a soft clay-coral mark.',
    story: 'The lowest-energy light theme. Backgrounds are grey-green porcelain with very low chroma, so long sessions feel shaded rather than bright. Jade is the only saturated colour; the clay-coral mark is its complement, used sparingly. Rest is a sky blue — literally "looking up".',
    canvas: '#EBF1EE', sunken: '#E1E9E5', base: '#F8FBF9', raised: '#FCFEFD', border: '#D2DED8',
    text: '#1F2D29', text2: '#4C5D57',
    accent: '#30705A', onAccent: '#F6FBF9', mark: '#C47A63',
    focus: '#30705A', recall: '#775A96', rest: '#4D7DA3', overtime: '#B5602F',
    illu: { line: '#24413A', wash: '#D5E6DE', highlight: '#C47A63' },
    nav: { bg: '#E3ECE8', active: '#30705A' },
    chart: { shift: 0, chroma: 0.095 }
  },
  {
    id: 'lagoon', name: 'Lagoon', mode: 'light', pairsWith: 'deep-sea',
    family: 'Cool', mood: ['clear', 'cool', 'fresh'],
    tagline: 'Sea mist, harbour blue and a sand-coloured marker.',
    story: 'Cooler and crisper than Celadon: the accent is a harbour blue between teal and navy, surfaces are almost white with a blue-grey canvas, and text is a deep petrol instead of black. A sand-orange mark gives the warm counterweight cool themes usually lack.',
    canvas: '#EDF2F5', sunken: '#E2E9EE', base: '#FAFCFD', raised: '#FFFFFF', border: '#D3DEE5',
    text: '#14262F', text2: '#44565F',
    accent: '#0D5D82', onAccent: '#F4FBFC', mark: '#D98A4A',
    focus: '#0D5D82', recall: '#6A4FA0', rest: '#3D8662', overtime: '#C0602A',
    illu: { line: '#14323C', wash: '#D4E6EC', highlight: '#D98A4A' },
    nav: { bg: '#E4ECF1', active: '#14323C' },
    chart: { shift: 0, chroma: 0.11 }
  },
  {
    id: 'cobalt', name: 'Cobalt', mode: 'light', pairsWith: 'graphite-night',
    family: 'Cool', mood: ['crisp', 'modern', 'precise'],
    tagline: 'White paper, cobalt ink and a sunflower highlight.',
    story: 'For people who want maximum clarity: true white cards on a cool grey canvas, a confident cobalt and berry recall. It is the most saturated accent in the library, balanced by completely neutral surfaces. Best on well-lit screens.',
    canvas: '#F3F4F7', sunken: '#E9EBF0', base: '#FFFFFF', raised: '#FFFFFF', border: '#DDE1E8',
    text: '#161B26', text2: '#4A5263',
    accent: '#2D55C8', onAccent: '#FFFFFF', mark: '#E8A93A',
    focus: '#2D55C8', recall: '#A13C78', rest: '#17816F', overtime: '#C9541C',
    illu: { line: '#1E2A44', wash: '#DCE4F7', highlight: '#E8A93A' },
    nav: { bg: '#EBEEF4', active: '#2D55C8' },
    chart: { shift: 0, chroma: 0.13 }
  },
  {
    id: 'wisteria', name: 'Wisteria', mode: 'light', pairsWith: 'aubergine',
    family: 'Elegant', mood: ['elegant', 'soft', 'literary'],
    tagline: 'Lilac-grey paper, deep violet and antique gold.',
    story: 'Violet and antique gold is a classic book-jacket pairing; here violet is darkened until it behaves like an ink, and the lilac tint in the neutrals is kept just below where it would look pink. Recall moves to rose so the two stage colours never blur.',
    canvas: '#F3F0F5', sunken: '#EAE5EE', base: '#FDFBFE', raised: '#FFFEFF', border: '#DED6E5',
    text: '#261F33', text2: '#554C63',
    accent: '#5B3F8C', onAccent: '#FBF8FF', mark: '#C08A3E',
    focus: '#5B3F8C', recall: '#A2466E', rest: '#3B7C80', overtime: '#B5652A',
    illu: { line: '#2F2640', wash: '#E6DDF0', highlight: '#C08A3E' },
    nav: { bg: '#EBE5F0', active: '#5B3F8C' },
    chart: { shift: 4, chroma: 0.11 }
  },
  {
    id: 'rosewater', name: 'Rosewater', mode: 'light', pairsWith: 'aubergine',
    family: 'Soft', mood: ['gentle', 'warm', 'soft'],
    tagline: 'Blush paper, raspberry ink and a sage counterpoint.',
    story: 'Soft without being sugary: the blush lives only in the neutrals (chroma under 0.02), the raspberry is deep enough to carry white text, and a muted sage mark keeps it from becoming monochrome pink. Indigo recall gives the cool note.',
    canvas: '#F7EFEE', sunken: '#EFE3E2', base: '#FFFAF9', raised: '#FFFDFC', border: '#E8D6D5',
    text: '#33232A', text2: '#634E56',
    accent: '#A33E6E', onAccent: '#FFF8F9', mark: '#5E8466',
    focus: '#A33E6E', recall: '#5A5296', rest: '#3D7C72', overtime: '#B8642A',
    illu: { line: '#3B2830', wash: '#F2DCDD', highlight: '#A33E6E' },
    nav: { bg: '#F0E3E2', active: '#A33E6E' },
    chart: { shift: 8, chroma: 0.11 }
  },
  {
    id: 'graphite', name: 'Graphite', mode: 'light', pairsWith: 'graphite-night',
    family: 'Neutral', mood: ['minimal', 'neutral', 'swiss'],
    tagline: 'Grey paper, black buttons, a single vermilion signal.',
    story: 'Swiss-style minimal: every surface is achromatic, actions are near-black, and colour appears only where it means something — stage colours, charts, and one vermilion mark. Ideal for people who find tinted themes distracting, and the cleanest canvas for subject colours.',
    canvas: '#F3F3F2', sunken: '#E8E8E6', base: '#FFFFFF', raised: '#FFFFFF', border: '#DCDCD9',
    text: '#1A1A1A', text2: '#4D4E50',
    accent: '#1E1F22', onAccent: '#FFFFFF', mark: '#E0472A',
    focus: '#2F5FA8', recall: '#8A4E98', rest: '#2D7E6C', overtime: '#C2551F',
    illu: { line: '#1E1F22', wash: '#E7E7E4', highlight: '#E0472A' },
    nav: { bg: '#EDEDEB', active: '#1E1F22' },
    chart: { shift: 0, chroma: 0.12 }
  }
]


export const THEMES = [...LIGHTS, ...DARKS]

/** Shortlist for detailed screen previews (owner still chooses). */
export const SHORTLIST = ['ivory-ink', 'ink-dim', 'library', 'celadon', 'graphite', 'pewter-dim', 'ink-rail', 'graphite-night', 'indigo-hour', 'chalkboard']
