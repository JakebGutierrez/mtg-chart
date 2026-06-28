import type { Chart, Slot, CellDef } from '@/types/chart'
import { generateCellMap } from '@/utils/cellMap'

export function getSlot(chart: Chart, slotIndex: number): Slot | null {
  return chart.slots[slotIndex] ?? null
}

// Returns the slot index that a fill action should target.
// Prefers an explicitly selected empty cell; falls back to the first empty
// non-covered cell in visual order; returns null when the grid is full.
export function resolveSlotFillTarget(
  chart: Chart,
  selectedSlotIndex: number | null,
): number | null {
  const cellMap = generateCellMap(chart.gridRows, chart.gridCols, chart.heroConfig)
  if (
    selectedSlotIndex !== null &&
    getSlot(chart, selectedSlotIndex) === null &&
    cellMap.some((c) => c.kind !== 'covered' && c.slotIndex === selectedSlotIndex)
  ) {
    return selectedSlotIndex
  }
  const target = cellMap.find(
    (c): c is Exclude<CellDef, { kind: 'covered' }> =>
      c.kind !== 'covered' && getSlot(chart, c.slotIndex) === null,
  )
  return target ? target.slotIndex : null
}
