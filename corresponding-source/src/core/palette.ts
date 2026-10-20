// Calm, mid-saturation colours for items and categories. They read on both
// light and dark backgrounds.
export const ITEM_PALETTE = [
  '#5B8DEF',
  '#4FA3A5',
  '#6BAA75',
  '#A3A84F',
  '#D9A441',
  '#D9825B',
  '#C96B7E',
  '#A77BCA',
  '#7C7FD6',
  '#8A9BA8'
] as const

export function nextPaletteColor(used: string[]): string {
  const lower = new Set(used.map((c) => c.toLowerCase()))
  return ITEM_PALETTE.find((c) => !lower.has(c.toLowerCase())) ?? ITEM_PALETTE[used.length % ITEM_PALETTE.length]
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}
