import { describe, it, expect } from 'vitest'
import { getEmptySlotIndices, getExpansionSlotIndices } from '@/utils/importLayout'
import type { Chart, HeroConfig, Slot } from '@/types/chart'

const COMMANDER: HeroConfig = [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }]
const PARTNER: HeroConfig = [
  { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
  { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
]

function makeChart(
  rows: number,
  cols: number,
  heroConfig: HeroConfig = [],
  slots: Array<Slot | null> = [],
): Chart {
  return {
    id: 'c',
    name: 'c',
    schemaVersion: 4,
    gridRows: rows,
    gridCols: cols,
    layout: heroConfig.length ? 'hybrid' : 'uniform',
    heroConfig,
    displayMode: 'landscape',
    nameDisplayMode: 'none',
    title: '',
    backgroundColor: '#000',
    cellGap: 4,
    padding: 16,
    cornerRadius: 4,
    slots,
  }
}

const filled = { kind: 'scryfall' } as unknown as Slot

describe('getExpansionSlotIndices (B9)', () => {
  it('5x5 commander expanding to 6 rows adds [22..26]', () => {
    // 5x5 commander = 22 logical slots (0–21); the new bottom row is 22–26.
    expect(getExpansionSlotIndices(makeChart(5, 5, COMMANDER), 6)).toEqual([22, 23, 24, 25, 26])
  })

  it('uniform 3x3 expanding to 4 rows adds [9,10,11] (regression guard)', () => {
    expect(getExpansionSlotIndices(makeChart(3, 3), 4)).toEqual([9, 10, 11])
  })

  it('5x5 partner expanding to 6 rows adds [23..27]', () => {
    // partner covers 2 cells → 23 logical slots (0–22); the new row is 23–27.
    expect(getExpansionSlotIndices(makeChart(5, 5, PARTNER), 6)).toEqual([23, 24, 25, 26, 27])
  })

  it('returns [] when newRows does not exceed the current rows', () => {
    expect(getExpansionSlotIndices(makeChart(5, 5), 5)).toEqual([])
    expect(getExpansionSlotIndices(makeChart(5, 5), 4)).toEqual([])
  })
})

describe('getEmptySlotIndices', () => {
  it('reports empty (null + out-of-bounds) logical indices in a uniform grid', () => {
    // idx 0 filled; idx 1 null; idx 2,3 out-of-bounds → treated as empty.
    expect(getEmptySlotIndices(makeChart(2, 2, [], [filled, null]))).toEqual([1, 2, 3])
  })

  it('reports all 22 logical slots empty in an empty 5x5 commander', () => {
    expect(getEmptySlotIndices(makeChart(5, 5, COMMANDER))).toEqual(
      Array.from({ length: 22 }, (_, i) => i),
    )
  })
})
