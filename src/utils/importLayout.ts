import type { Chart, CellDef, HeroConfig } from '@/types/chart'
import { getSlot } from '@/utils/chart'
import { generateCellMap } from '@/utils/cellMap'

// Logical slot indices of empty (non-covered, unfilled) cells in the current grid.
export function getEmptySlotIndices(chart: Chart): number[] {
  const cellMap = generateCellMap(chart.gridRows, chart.gridCols, chart.heroConfig)
  return cellMap
    .filter((c): c is Exclude<CellDef, { kind: 'covered' }> => c.kind !== 'covered')
    .filter((c) => getSlot(chart, c.slotIndex) === null)
    .map((c) => c.slotIndex)
}

// Logical slot count (number of non-covered cells) of a grid.
function slotCount(rows: number, cols: number, heroConfig: HeroConfig): number {
  return generateCellMap(rows, cols, heroConfig).filter((c) => c.kind !== 'covered').length
}

// Slot indices that appear when the grid grows from its current rows to newRows.
// generateCellMap numbers slotIndex sequentially over non-covered cells, row by
// row, so the appended rows take a contiguous run of indices starting exactly at
// the pre-expansion slot count. The old approach derived these from
// gridRows*gridCols, which counts covered hero cells too — wrong for hybrid
// layouts, where it skipped real indices and overshot past the end (B9).
export function getExpansionSlotIndices(chart: Chart, newRows: number): number[] {
  if (newRows <= chart.gridRows) return []
  const before = slotCount(chart.gridRows, chart.gridCols, chart.heroConfig)
  const after = slotCount(newRows, chart.gridCols, chart.heroConfig)
  const added: number[] = []
  for (let i = before; i < after; i++) added.push(i)
  return added
}
