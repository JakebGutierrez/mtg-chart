// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadOrInit,
  chartsToPersist,
  applyReconstructionSuccess,
  applyReconstructionFailure,
  safeWrite,
  type ChartsState,
} from '@/hooks/useCharts'
import { fetchCollectionSlots, RetryableReconstructionError } from '@/utils/reconstruct'
import { encodeShareLink } from '@/utils/shareLink'
import type { ScryfallCard } from '@/utils/scryfall'
import type { Chart, ScryfallSlot, Slot } from '@/types/chart'

// ─── Test doubles ──────────────────────────────────────────────────────────────

const store = new Map<string, string>()
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  get length() { return store.size },
  key: (index: number) => [...store.keys()][index] ?? null,
}

function makeChart(id: string, overrides: Partial<Chart> = {}): Chart {
  return {
    id,
    name: id,
    schemaVersion: 4,
    gridRows: 2,
    gridCols: 2,
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

function makeScryfallSlot(): ScryfallSlot {
  return {
    kind: 'scryfall',
    scryfallId: 'abc',
    oracleId: 'o',
    cardName: 'Lightning Bolt',
    setCode: 'm20',
    collectorNumber: '150',
    layout: 'normal',
    selectedFaceIndex: 0,
    imageUris: [{ artCrop: 'https://x/a.jpg', normal: 'https://x/n.jpg' }],
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1.0,
    cmc: 1,
    colors: ['R'],
    typeLine: 'Instant',
  }
}

function fakeCard(id: string): ScryfallCard {
  return {
    id,
    oracle_id: `o-${id}`,
    name: `Card ${id}`,
    set: 's',
    set_name: 'Set',
    released_at: '2020-01-01',
    collector_number: '1',
    layout: 'normal',
    image_uris: { art_crop: `https://x/${id}.jpg`, normal: `https://x/n.jpg` },
  }
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

function statusResponse(status: number): Response {
  return {
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => ({}),
  } as unknown as Response
}

const asFetch = (fn: ReturnType<typeof vi.fn>): typeof globalThis.fetch =>
  fn as unknown as typeof globalThis.fetch

const noSleep = async () => {}

// ─── fetchCollectionSlots (B5) ───────────────────────────────────────────────────

describe('fetchCollectionSlots', () => {
  it('fetches slots via the collection endpoint and skips nulls', async () => {
    const fetch = vi.fn(async () => jsonResponse({ data: [fakeCard('a'), fakeCard('b')], not_found: [] }))
    const result = await fetchCollectionSlots([{ id: 'a' }, null, { id: 'b' }], {
      fetch: asFetch(fetch),
      sleep: noSleep,
    })
    expect(result.cardMap.size).toBe(2)
    expect(result.notFoundCount).toBe(0)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('counts not_found ids returned by Scryfall', async () => {
    const fetch = vi.fn(async () => jsonResponse({ data: [], not_found: [{ id: 'gone' }] }))
    const result = await fetchCollectionSlots([{ id: 'gone' }], { fetch: asFetch(fetch), sleep: noSleep })
    expect(result.notFoundCount).toBe(1)
    expect(result.cardMap.size).toBe(0)
  })

  it('treats 429 as retryable: backs off then succeeds', async () => {
    let call = 0
    const fetch = vi.fn(async () => {
      call++
      return call === 1 ? statusResponse(429) : jsonResponse({ data: [fakeCard('a')], not_found: [] })
    })
    const sleep = vi.fn(noSleep)
    const result = await fetchCollectionSlots([{ id: 'a' }], { fetch: asFetch(fetch), sleep })
    expect(result.cardMap.size).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalled() // backed off before the retry
  })

  it('throws RetryableReconstructionError after exhausting 429 retries', async () => {
    const fetch = vi.fn(async () => statusResponse(429))
    await expect(
      fetchCollectionSlots([{ id: 'a' }], { fetch: asFetch(fetch), sleep: noSleep }),
    ).rejects.toBeInstanceOf(RetryableReconstructionError)
  })

  it('throws RetryableReconstructionError on a non-ok, non-429 status', async () => {
    const fetch = vi.fn(async () => statusResponse(500))
    await expect(
      fetchCollectionSlots([{ id: 'a' }], { fetch: asFetch(fetch), sleep: noSleep }),
    ).rejects.toBeInstanceOf(RetryableReconstructionError)
  })

  it('chunks at 75 ids with an inter-chunk delay', async () => {
    const fetch = vi.fn(async () => jsonResponse({ data: [], not_found: [] }))
    const sleep = vi.fn(noSleep)
    const stubs = Array.from({ length: 80 }, (_, i) => ({ id: `id-${i}` }))
    await fetchCollectionSlots(stubs, { fetch: asFetch(fetch), sleep })
    expect(fetch).toHaveBeenCalledTimes(2) // 75 + 5
    expect(sleep).toHaveBeenCalledTimes(1) // one delay before the 2nd chunk
  })
})

// ─── Reconstruction reducers (B1) ────────────────────────────────────────────────

describe('reconstruction reducers', () => {
  const base: ChartsState = {
    charts: [makeChart('ph', { name: 'Shared' })],
    activeId: 'ph',
    unreconstructedPlaceholderId: 'ph',
    isReconstructing: true,
    pendingReconstruction: [{ id: 'a' }],
  }

  it('failure RETAINS the placeholder, sets a retryable error, keeps exclusion + stubs', () => {
    const next = applyReconstructionFailure(base, 'ph', 'boom')
    expect(next.charts).toHaveLength(1)
    expect(next.charts[0].id).toBe('ph')
    expect(next.reconstructionError).toBe('boom')
    expect(next.isReconstructing).toBe(false)
    expect(next.unreconstructedPlaceholderId).toBe('ph') // still excluded from persistence
    expect(next.pendingReconstruction).toEqual([{ id: 'a' }]) // retained for retry
  })

  it('failure on a deleted placeholder just clears the flags', () => {
    const next = applyReconstructionFailure(base, 'nonexistent', 'boom')
    expect(next.isReconstructing).toBe(false)
    expect(next.unreconstructedPlaceholderId).toBeUndefined()
    expect(next.pendingReconstruction).toBeUndefined()
  })

  it('success fills slots and clears all reconstruction flags', () => {
    const slots: Array<Slot | null> = [makeScryfallSlot()]
    const next = applyReconstructionSuccess(base, 'ph', slots, 0)
    expect(next.charts[0].slots).toHaveLength(1)
    expect(next.isReconstructing).toBe(false)
    expect(next.unreconstructedPlaceholderId).toBeUndefined()
    expect(next.pendingReconstruction).toBeUndefined()
    expect(next.reconstructionWarning).toBeUndefined()
  })

  it('success surfaces a warning when some cards were missing', () => {
    const next = applyReconstructionSuccess(base, 'ph', [], 2)
    expect(next.reconstructionWarning).toMatch(/2 card/)
  })
})

// ─── chartsToPersist ─────────────────────────────────────────────────────────────

describe('chartsToPersist', () => {
  it('excludes the un-reconstructed placeholder, keeps everything else', () => {
    const a = makeChart('a')
    const b = makeChart('b')
    expect(chartsToPersist([a, b], 'b')).toEqual([a])
    expect(chartsToPersist([a, b], undefined)).toEqual([a, b])
  })
})

// ─── Reload simulation: no duplicate placeholder (B1) ────────────────────────────

describe('failed share-load + reload', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', localStorageStub)
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  it('keeps exactly ONE placeholder after fail → persist → reload with same ?c=', () => {
    const chart = makeChart('orig', { name: 'Shared' })
    const { encoded } = encodeShareLink(chart)
    window.history.pushState({}, '', `/?c=${encoded}`)

    // First load: one placeholder, marked un-reconstructed.
    const first = loadOrInit()
    expect(first.charts.filter((c) => c.name === 'Shared')).toHaveLength(1)
    expect(first.unreconstructedPlaceholderId).toBe(first.activeId)

    // Reconstruction fails — placeholder retained, ?c= NOT stripped.
    const failed = applyReconstructionFailure(first, first.activeId, 'network')
    expect(failed.charts.filter((c) => c.name === 'Shared')).toHaveLength(1)

    // Persist excludes the un-reconstructed placeholder (writes [] here).
    safeWrite(chartsToPersist(failed.charts, failed.unreconstructedPlaceholderId), failed.activeId)

    // Reload with the same ?c= still present → re-derives exactly one placeholder.
    const second = loadOrInit()
    expect(second.charts.filter((c) => c.name === 'Shared')).toHaveLength(1)
  })
})
