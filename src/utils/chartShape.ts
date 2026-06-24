export function isSlotShaped(el: unknown): boolean {
  if (el === null) return true
  if (typeof el !== 'object') return false
  const s = el as Record<string, unknown>
  return typeof s.scryfallId === 'string' && Array.isArray(s.imageUris)
}

export function isChartShaped(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.gridRows === 'number' &&
    typeof c.gridCols === 'number' &&
    Array.isArray(c.slots) &&
    (c.slots as unknown[]).every(isSlotShaped)
  )
}
