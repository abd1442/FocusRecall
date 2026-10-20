// Small, dependency-free colour toolkit: sRGB <-> OKLab/OKLCH, WCAG contrast,
// CIEDE2000 and colour-vision-deficiency simulation (Machado et al. 2009, severity 1).

const clamp01 = (x) => Math.min(1, Math.max(0, x))
export const hexToRgb = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) }
export const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
function oklabToLinRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}
const inGamut = (lin) => lin.every((v) => v >= -0.0005 && v <= 1.0005)
export const oklabToHex = (lab) => rgbToHex(oklabToLinRgb(lab).map((v) => fromLin(clamp01(v))))
export function hexToOklch(hex) { const [L, a, b] = hexToOklab(hex); return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360] }
/** OKLCH to hex, reducing chroma until the colour fits sRGB (keeps lightness and hue). */
export function oklch(L, C, H) {
  let c = C
  for (let i = 0; i < 60; i++) {
    const lab = [L, c * Math.cos((H * Math.PI) / 180), c * Math.sin((H * Math.PI) / 180)]
    if (inGamut(oklabToLinRgb(lab)) || c <= 0.0005) return oklabToHex(lab)
    c *= 0.95
  }
  return oklabToHex([L, 0, 0])
}
/** Perceptual mix in OKLab: t = share of b. */
export function mix(a, b, t) { const p = hexToOklab(a), q = hexToOklab(b); return oklabToHex(p.map((v, i) => v + (q[i] - v) * t)) }
export function shiftL(hex, dL) { const [L, C, H] = hexToOklch(hex); return oklch(clamp01(L + dL), C, H) }

export const luminance = (hex) => { const [r, g, b] = hexToRgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** Move lightness (keeping hue) until the colour reaches `target` contrast against `bg`. */
export function ensureContrast(hex, bg, target) {
  if (contrast(hex, bg) >= target) return hex
  const [L, C, H] = hexToOklch(hex)
  const dir = luminance(bg) > 0.18 ? -1 : 1
  for (let i = 1; i <= 100; i++) {
    const c = oklch(clamp01(L + dir * i * 0.006), C, H)
    if (contrast(c, bg) >= target) return c
  }
  return dir < 0 ? '#000000' : '#FFFFFF'
}
/** Pick whichever of the candidates contrasts most with bg. */
export const bestOn = (bg, ...candidates) => candidates.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best))

// ── CIE Lab / CIEDE2000 ────────────────────────────────────────────────
function hexToLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLin)
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
export function deltaE00(h1, h2) {
  const [L1, a1, b1] = hexToLab(h1), [L2, a2, b2] = hexToLab(h2)
  const rad = Math.PI / 180, deg = 180 / Math.PI
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const h1p = (Math.atan2(b1, a1p) * deg + 360) % 360, h2p = (Math.atan2(b2, a2p) * deg + 360) % 360
  const dLp = L2 - L1, dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360 }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad)
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2
  let hbp = h1p + h2p
  if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360; hbp /= 2 }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))
}

// ── Colour-vision deficiency simulation ─────────────────────────────────
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]]
}
export function simulate(hex, type) {
  if (type === 'normal') return hex
  const lin = hexToRgb(hex).map(toLin), M = CVD[type]
  return rgbToHex(M.map((row) => fromLin(clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))))
}
export const CVD_TYPES = ['normal', 'protan', 'deutan', 'tritan']
export const CVD_MATRICES = CVD
