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
})
