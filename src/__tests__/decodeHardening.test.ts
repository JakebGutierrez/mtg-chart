// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import LZString from 'lz-string'
import { loadOrInit } from '@/hooks/useCharts'
import { encodeShareLink } from '@/utils/shareLink'
import type { Chart } from '@/types/chart'

const store = new Map<string, string>()
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  get length() { return store.size },
  key: (index: number) => [...store.keys()][index] ?? null,
}

function makeChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 'c1',
    name: 'Tampered',
    schemaVersion: 4,
    gridRows: 3,
    gridCols: 3,
    layout: 'uniform',
    heroConfig: [],
    displayMode: 'landscape',
    nameDisplayMode: 'none',
    title: '',
    backgroundColor: '#0b0c0e',
    cellGap: 4,
    padding: 16,
    cornerRadius: 4,
    slots: [],
    ...overrides,
  }
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', localStorageStub)
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('loadOrInit hardens a tampered compact link', () => {
  it('clamps dims, drops bad hero, sanitizes bg, and caps the stub array', () => {
    const { encoded } = encodeShareLink(makeChart())
    const payload = JSON.parse(LZString.decompressFromEncodedURIComponent(encoded)!) as {
      c: Record<string, unknown>
      s: unknown[]
    }
    payload.c.gridRows = 9999
    payload.c.gridCols = 2
    payload.c.heroConfig = [{ row: 0, col: 0, rowSpan: 1e9, colSpan: 1e9 }]
    payload.c.backgroundColor = 'url(https://attacker/x.png)'
    payload.s = Array.from({ length: 50 }, () => ({ id: 'x' }))
    const tampered = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
    window.history.pushState({}, '', `/?c=${tampered}`)

    // Must not freeze (huge hero span never reaches generateCellMap) or throw.
    const state = loadOrInit()
    const placeholder = state.charts[state.charts.length - 1]

    expect(placeholder.gridRows).toBe(10)
    expect(placeholder.gridCols).toBe(2)
    expect(placeholder.heroConfig).toEqual([])
    expect(placeholder.backgroundColor).toBe('#0b0c0e')
    // 10x2 uniform = 20 logical slots; 50 stubs are capped to 20.
    expect(state.pendingReconstruction).toHaveLength(20)
  })
})
