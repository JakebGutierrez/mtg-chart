import { describe, it, expect } from 'vitest'
import { getSlot } from '@/utils/chart'
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
  }
}

function makeChart(slots: Array<Slot | null>): Chart {
  return {
    id: 'test',
    name: 'Test',
    schemaVersion: 2,
    gridRows: 3,
    gridCols: 3,
    layout: 'uniform',
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
