function isSlotShaped(el: unknown): boolean {
  if (el === null) return true
  if (typeof el !== 'object') return false
  const s = el as Record<string, unknown>
  if (s.kind === 'scryfall') {
    return typeof s.scryfallId === 'string' && Array.isArray(s.imageUris)
  }
  if (s.kind === 'custom') {
    return (
      typeof s.localImageDataUrl === 'string' &&
      typeof s.label === 'string' &&
      typeof s.cropX === 'number' &&
      typeof s.cropY === 'number' &&
      typeof s.cropScale === 'number'
    )
  }
  return false
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
