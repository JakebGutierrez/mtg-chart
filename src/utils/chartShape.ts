function isSlotShaped(el: unknown): boolean {
  if (el === null) return true
  if (typeof el !== 'object') return false
  const s = el as Record<string, unknown>
  if (s.kind === 'scryfall') {
    if (typeof s.scryfallId !== 'string') return false
    // imageUris must be a non-empty array of faces that each carry a string
    // artCrop, and selectedFaceIndex (if present) must index within it. This
    // rejects corrupt/tampered stored slots that would crash render/export (B8).
    if (!Array.isArray(s.imageUris) || s.imageUris.length === 0) return false
    const facesOk = s.imageUris.every(
      (f) => typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>).artCrop === 'string',
    )
    if (!facesOk) return false
    if (s.selectedFaceIndex !== undefined) {
      if (
        typeof s.selectedFaceIndex !== 'number' ||
        !Number.isInteger(s.selectedFaceIndex) ||
        s.selectedFaceIndex < 0 ||
        s.selectedFaceIndex >= s.imageUris.length
      ) {
        return false
      }
    }
    return true
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
