/** Spatial navigation for a roving grid. Null cells are outside the data.
 * Rows follow visual top-to-bottom order; columns follow the reading direction.
 * Stop at edges rather than silently wrapping into a different row or year.
 */
export function gridDestination(rows: readonly (readonly (string | null)[])[], current: string, key: string, rtl = false, control = false): string | null {
  const row = rows.findIndex(r => r.includes(current))
  if (row < 0) return null
  const column = rows[row].indexOf(current)
  if (control && (key === 'Home' || key === 'End')) {
    const cells = rows.flat().filter((v): v is string => v !== null)
    return (key === 'Home' ? cells[0] : cells.at(-1)) ?? current
  }
  if (key === 'Home' || key === 'End') {
    const cells = rows[row].filter((v): v is string => v !== null)
    return (key === 'Home' ? cells[0] : cells.at(-1)) ?? current
  }
  const dr = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0
  const dc = key === 'ArrowRight' ? (rtl ? -1 : 1) : key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0
  if (!dr && !dc) return null
  for (let r = row + dr, c = column + dc; r >= 0 && r < rows.length && c >= 0 && c < rows[r].length; r += dr, c += dc) {
    if (rows[r][c] !== null) return rows[r][c]
  }
  return current
}
