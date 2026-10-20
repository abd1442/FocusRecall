const isRtl = (): boolean => document.documentElement.dir === 'rtl'

/** Delegate native-like radio arrows without intercepting Tab or AT chords. */
export function radioKeyboard(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const forward = isRtl() ? 'ArrowLeft' : 'ArrowRight'
  const back = isRtl() ? 'ArrowRight' : 'ArrowLeft'
  const delta = e.key === forward || e.key === 'ArrowDown' ? 1 : e.key === back || e.key === 'ArrowUp' ? -1 : 0
  if (!delta) return
  const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]')].filter(b => !b.disabled)
  if (!radios.length) return
  const from = radios.indexOf(document.activeElement as HTMLButtonElement)
  const next = radios[(Math.max(0, from) + delta + radios.length) % radios.length]
  e.preventDefault()
  next.focus()
  if (next.getAttribute('aria-checked') !== 'true') next.click()
}
