// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadOrInit } from '@/hooks/useCharts'
import type { Chart } from '@/types/chart'

// Minimal in-memory localStorage stub for the node environment
const store = new Map<string, string>()
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
  get length() {
    return store.size
  },
  key: (index: number) => [...store.keys()][index] ?? null,
}

function makeStoredChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 'stored-id',
    name: 'Stored Chart',
    schemaVersion: 2,
    gridRows: 4,
    gridCols: 4,
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

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', localStorageStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadOrInit', () => {
  it('returns a fresh default chart when localStorage is empty', () => {
    const { charts, activeId } = loadOrInit()
    expect(charts).toHaveLength(1)
    expect(activeId).toBe(charts[0].id)
    expect(charts[0].schemaVersion).toBe(4)
  })

  it('restores charts and active ID from valid stored JSON', () => {
    const chart = makeStoredChart({ id: 'chart-a' })
    localStorageStub.setItem('mtg-chart:charts', JSON.stringify([chart]))
    localStorageStub.setItem('mtg-chart:activeId', 'chart-a')

    const { charts, activeId } = loadOrInit()
    expect(charts).toHaveLength(1)
    expect(charts[0].id).toBe('chart-a')
    expect(activeId).toBe('chart-a')
    expect(charts[0].schemaVersion).toBe(4)
  })

  it('falls back to a fresh default when stored JSON is malformed', () => {
    localStorageStub.setItem('mtg-chart:charts', 'not valid json{{{')
    const { charts, activeId } = loadOrInit()
    expect(charts).toHaveLength(1)
    expect(activeId).toBe(charts[0].id)
  })

  it('falls back to charts[0].id when activeId in storage does not match any chart', () => {
    const chart = makeStoredChart({ id: 'chart-b' })
    localStorageStub.setItem('mtg-chart:charts', JSON.stringify([chart]))
    localStorageStub.setItem('mtg-chart:activeId', 'nonexistent-id')

    const { charts, activeId } = loadOrInit()
    expect(activeId).toBe(charts[0].id)
  })
})
