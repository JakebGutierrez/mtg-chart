import { describe, it, expect } from 'vitest'
import { getSlot, resolveSlotFillTarget } from '@/utils/chart'
import type { Chart, Slot } from '@/types/chart'

function makeSlot(): Slot {
  return {
    kind: 'scryfall',
    scryfallId: 'abc123',
    oracleId: 'oracle-1',
    cardName: 'Lightning Bolt',
    setCode: 'lea',
    collectorNumber: '161',
    layout: 'normal',
    selectedFaceIndex: 0,
    imageUris: [{ artCrop: 'https://example.com/art.jpg' }],
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1.0,
    cmc: null,
    colors: null,
    typeLine: null,
  }
}

function makeChart(slots: Array<Slot | null> = [], overrides: Partial<Omit<Chart, 'slots'>> = {}): Chart {
  return {
    id: 'test',
    name: 'Test',
    schemaVersion: 2,
    gridRows: 3,
    gridCols: 3,
    layout: 'uniform',
    heroConfig: [],
    displayMode: 'landscape',
    nameDisplayMode: 'none',
    title: '',
    backgroundColor: '#000',
    cellGap: 4,
    padding: 16,
    cornerRadius: 4,
    ...overrides,
    slots,
  }
}

describe('getSlot', () => {
  it('returns the slot when present', () => {
    const slot = makeSlot()
    const chart = makeChart([slot])
    expect(getSlot(chart, 0)).toBe(slot)
  })

  it('returns null for an index beyond slots.length', () => {
    const chart = makeChart([makeSlot()])
    expect(getSlot(chart, 5)).toBeNull()
  })

  it('returns null for an index within slots.length where the slot is null', () => {
    const chart = makeChart([makeSlot(), null, makeSlot()])
    expect(getSlot(chart, 1)).toBeNull()
  })
})

describe('resolveSlotFillTarget', () => {
  it('returns the first empty slot when nothing is selected', () => {
    const chart = makeChart([makeSlot(), null, null])
    expect(resolveSlotFillTarget(chart, null)).toBe(1)
  })

  it('targets the selected slot when it is empty', () => {
    const chart = makeChart([makeSlot(), null, null])
    expect(resolveSlotFillTarget(chart, 2)).toBe(2)
  })

  it('falls back to first empty when the selected slot is already filled', () => {
    const chart = makeChart([makeSlot(), null, null])
    expect(resolveSlotFillTarget(chart, 0)).toBe(1)
  })

  it('returns null when the grid is full and nothing is selected', () => {
    const chart = makeChart(Array.from({ length: 9 }, () => makeSlot()))
    expect(resolveSlotFillTarget(chart, null)).toBeNull()
  })

  it('returns null when the grid is full even if a filled slot is selected', () => {
    const chart = makeChart(Array.from({ length: 9 }, () => makeSlot()))
    expect(resolveSlotFillTarget(chart, 3)).toBeNull()
  })

  it('falls back to first empty when the selected index is out of bounds for the current grid', () => {
    // Index 8 is valid in a 3×3 grid but does not exist in a 2×2 grid.
    // The cellMap.some() guard catches this and falls back to first empty (0).
    const chart = makeChart([], { gridRows: 2, gridCols: 2 })
    expect(resolveSlotFillTarget(chart, 8)).toBe(0)
  })
})
