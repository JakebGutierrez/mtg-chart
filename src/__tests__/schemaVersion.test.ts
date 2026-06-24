import { describe, it, expect, vi } from 'vitest'
import { migrateAll } from '@/utils/schemaVersion'
import type { Chart, Slot } from '@/types/chart'

function makeSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    kind: 'scryfall',
    scryfallId: 'abc',
    oracleId: 'xyz',
    cardName: 'Test Card',
    setCode: 'tst',
    collectorNumber: '1',
    layout: 'normal',
    selectedFaceIndex: 0,
    imageUris: [{ artCrop: 'https://example.com/art.jpg' }],
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1.0,
    ...overrides,
  }
}

function makeChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 'test-id',
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
    slots: [],
    ...overrides,
  }
}

describe('migrateAll', () => {
  it('returns charts unchanged when schemaVersion is current (3)', () => {
    const chart = makeChart({ schemaVersion: 3 })
    const result = migrateAll([chart])
    expect(result[0]).toEqual({ ...chart, schemaVersion: 3 })
  })

  it('logs a warning and returns chart as-is when schemaVersion is higher than current', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chart = makeChart({ schemaVersion: 99 })
    const result = migrateAll([chart])
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(result[0]).toBe(chart)
    warnSpy.mockRestore()
  })

  it('handles an empty array', () => {
    expect(migrateAll([])).toEqual([])
  })

  it('sets schemaVersion to 3 on all charts in the array', () => {
    const charts = [makeChart({ id: 'a', schemaVersion: 3 }), makeChart({ id: 'b', schemaVersion: 3 })]
    const result = migrateAll(charts)
    expect(result.every((c) => c.schemaVersion === 3)).toBe(true)
  })

  describe('v2 → v3 migration', () => {
    it('bumps schemaVersion from 2 to 3', () => {
      const chart = makeChart({ schemaVersion: 2 })
      const [result] = migrateAll([chart])
      expect(result.schemaVersion).toBe(3)
    })

    it('adds heroConfig: [] when missing', () => {
      const chart = makeChart({ schemaVersion: 2 })
      const [result] = migrateAll([chart])
      expect(result.heroConfig).toEqual([])
    })

    it('preserves existing heroConfig when present', () => {
      const existing = [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }]
      const chart = makeChart({ schemaVersion: 2, heroConfig: existing })
      const [result] = migrateAll([chart])
      expect(result.heroConfig).toEqual(existing)
    })
  })

  describe('v1 → v2 migration', () => {
    it('bumps schemaVersion from 1 to 3 (runs both migrations)', () => {
      const chart = makeChart({ schemaVersion: 1 })
      const [result] = migrateAll([chart])
      expect(result.schemaVersion).toBe(3)
    })

    it('adds crop defaults to filled slots that lack them', () => {
      const v1Slot = {
        ...makeSlot(),
        cropX: undefined,
        cropY: undefined,
        cropScale: undefined,
      } as unknown as Slot
      const chart = makeChart({ schemaVersion: 1, slots: [v1Slot, null] })
      const [result] = migrateAll([chart])
      const slot = result.slots[0] as Slot
      expect(slot.cropX).toBe(0.5)
      expect(slot.cropY).toBe(0.5)
      expect(slot.cropScale).toBe(1.0)
    })

    it('preserves existing crop values on slots that already have them', () => {
      const slot = makeSlot({ cropX: 0.3, cropY: 0.7, cropScale: 1.5 })
      const chart = makeChart({ schemaVersion: 1, slots: [slot] })
      const [result] = migrateAll([chart])
      const s = result.slots[0] as Slot
      expect(s.cropX).toBe(0.3)
      expect(s.cropY).toBe(0.7)
      expect(s.cropScale).toBe(1.5)
    })

    it('leaves null slots as null', () => {
      const chart = makeChart({ schemaVersion: 1, slots: [null, null] })
      const [result] = migrateAll([chart])
      expect(result.slots[0]).toBeNull()
      expect(result.slots[1]).toBeNull()
    })
  })
})
