import type { CellDef, CellMap, HeroConfig } from '@/types/chart'

export function generateCellMap(rows: number, cols: number, heroConfig: HeroConfig = []): CellMap {
  const heroOrigins = new Map<number, HeroConfig[number]>()
  const coveredSet = new Set<number>()

  for (const hero of heroConfig) {
    heroOrigins.set(hero.row * cols + hero.col, hero)
    for (let dr = 0; dr < hero.rowSpan; dr++) {
      for (let dc = 0; dc < hero.colSpan; dc++) {
        if (dr === 0 && dc === 0) continue
        const r = hero.row + dr
        const c = hero.col + dc
        if (r < rows && c < cols) coveredSet.add(r * cols + c)
      }
    }
  }

  const cells: CellDef[] = []
  let slotIndex = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = r * cols + c
      if (coveredSet.has(key)) {
        cells.push({ kind: 'covered' })
      } else if (heroOrigins.has(key)) {
        const hero = heroOrigins.get(key)!
        cells.push({ kind: 'hero', slotIndex, rowSpan: hero.rowSpan, colSpan: hero.colSpan })
        slotIndex++
      } else {
        cells.push({ kind: 'slot', slotIndex })
        slotIndex++
      }
    }
  }

  return cells
}
