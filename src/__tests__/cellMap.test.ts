import { describe, it, expect } from 'vitest'
import { generateCellMap } from '@/utils/cellMap'

describe('generateCellMap', () => {
  it('length is always rows × cols', () => {
    expect(generateCellMap(4, 5)).toHaveLength(20)
  })

  it('every cell has kind: slot in uniform mode', () => {
    const cells = generateCellMap(3, 3)
    expect(cells.every((c) => c.kind === 'slot')).toBe(true)
  })

  it('slotIndex values are 0-based, sequential, no gaps', () => {
    const cells = generateCellMap(2, 3)
    cells.forEach((cell, i) => {
      if (cell.kind === 'slot') expect(cell.slotIndex).toBe(i)
    })
  })

  it('a 1×1 grid produces a single cell with slotIndex: 0', () => {
    const cells = generateCellMap(1, 1)
    expect(cells).toHaveLength(1)
    expect(cells[0]).toEqual({ kind: 'slot', slotIndex: 0 })
  })

  it('a 3×2 grid produces 6 cells with correct slot indices', () => {
    const cells = generateCellMap(3, 2)
    expect(cells).toHaveLength(6)
    cells.forEach((cell, i) => {
      expect(cell).toEqual({ kind: 'slot', slotIndex: i })
    })
  })

  describe('hero layout', () => {
    it('commander preset: 2×2 hero at (0,0) in 4×4 grid', () => {
      const cells = generateCellMap(4, 4, [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
      expect(cells).toHaveLength(16)
      // origin is hero
      expect(cells[0]).toEqual({ kind: 'hero', slotIndex: 0, rowSpan: 2, colSpan: 2 })
      // (0,1), (1,0), (1,1) are covered
      expect(cells[1]).toEqual({ kind: 'covered' })
      expect(cells[4]).toEqual({ kind: 'covered' })
      expect(cells[5]).toEqual({ kind: 'covered' })
      // (0,2) is the next slot
      expect(cells[2]).toEqual({ kind: 'slot', slotIndex: 1 })
    })

    it('slot indices after hero are sequential with no gaps', () => {
      const cells = generateCellMap(3, 4, [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
      const nonCovered = cells.filter((c) => c.kind !== 'covered')
      nonCovered.forEach((cell, i) => {
        if (cell.kind === 'slot' || cell.kind === 'hero') {
          expect(cell.slotIndex).toBe(i)
        }
      })
    })

    it('partner preset: two 2×1 heroes at (0,0) and (0,1) in 4×4 grid', () => {
      const cells = generateCellMap(4, 4, [
        { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
        { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      ])
      expect(cells).toHaveLength(16)
      expect(cells[0]).toEqual({ kind: 'hero', slotIndex: 0, rowSpan: 2, colSpan: 1 })
      expect(cells[1]).toEqual({ kind: 'hero', slotIndex: 1, rowSpan: 2, colSpan: 1 })
      // (1,0) and (1,1) are covered
      expect(cells[4]).toEqual({ kind: 'covered' })
      expect(cells[5]).toEqual({ kind: 'covered' })
      // (0,2) is slot slotIndex 2
      expect(cells[2]).toEqual({ kind: 'slot', slotIndex: 2 })
    })

    it('empty heroConfig is identical to no heroConfig argument', () => {
      expect(generateCellMap(3, 3, [])).toEqual(generateCellMap(3, 3))
    })

    it('length is still rows × cols with heroConfig', () => {
      const cells = generateCellMap(4, 4, [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
      expect(cells).toHaveLength(16)
    })
  })
})
