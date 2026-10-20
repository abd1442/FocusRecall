/** Copy the actual report with resolved theme styles, so its PNG matches the page. */
export function reportSnapshot(element: HTMLElement): { html: string; width: number } {
  const clone = element.cloneNode(true) as HTMLElement
  const original = [element, ...element.querySelectorAll('*')]
  const copied = [clone, ...clone.querySelectorAll('*')]
  original.forEach((node, i) => {
    const style = getComputedStyle(node)
    const properties = ['display', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'padding', 'margin', 'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'flex', 'flex-direction', 'flex-wrap', 'align-items', 'align-self', 'justify-content', 'position', 'top', 'left', 'right', 'bottom', 'overflow', 'color', 'background-color', 'background-image', 'border', 'border-radius', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'white-space', 'word-break', 'list-style', 'opacity', 'fill', 'stroke', 'stroke-width']
    properties.push('direction', 'unicode-bidi')
    copied[i].setAttribute('style', properties.map((key) => `${key}:${style.getPropertyValue(key)}`).join(';'))
    for (const attr of [...copied[i].attributes]) if (attr.name.startsWith('on')) copied[i].removeAttribute(attr.name)
  })
  const width = Math.ceil(element.getBoundingClientRect().width / (Number(document.documentElement.style.zoom) || 1))
  const language = document.documentElement.lang.replace(/[^a-zA-Z-]/g, '') || 'en'
  const direction = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'
  return { width, html: `<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>html,body{margin:0;padding:0}*{box-sizing:border-box}</style></head><body>${clone.outerHTML}</body></html>` }
}
