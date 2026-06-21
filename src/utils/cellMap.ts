import type { CellDef, CellMap } from '@/types/chart'

export function generateCellMap(rows: number, cols: number): CellMap {
  const cells: CellDef[] = []
  for (let i = 0; i < rows * cols; i++) {
    cells.push({ kind: 'slot', slotIndex: i })
  }
  return cells
}
