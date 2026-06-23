import { describe, it, expect, vi } from 'vitest'
import { migrateAll } from '@/utils/schemaVersion'
import type { Chart } from '@/types/chart'

function makeChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 'test-id',
    name: 'Test',
    schemaVersion: 1,
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
    slots: [],
    ...overrides,
  }
}

describe('migrateAll', () => {
  it('returns charts unchanged when schemaVersion === 1', () => {
    const chart = makeChart({ schemaVersion: 1 })
    const result = migrateAll([chart])
    expect(result[0]).toEqual({ ...chart, schemaVersion: 1 })
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

  it('sets schemaVersion to current on all charts in the array', () => {
    const charts = [makeChart({ id: 'a', schemaVersion: 1 }), makeChart({ id: 'b', schemaVersion: 1 })]
    const result = migrateAll(charts)
    expect(result.every((c) => c.schemaVersion === 1)).toBe(true)
  })
})
