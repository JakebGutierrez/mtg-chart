import { useState, useCallback, useEffect, useRef } from 'react'
import type { Chart, ScryfallSlot } from '@/types/chart'
import { createDefaultChart } from '@/utils/defaultChart'
import { migrateAll, CURRENT_SCHEMA_VERSION } from '@/utils/schemaVersion'
import { decodeSharePayload, reconstructSlots, type ShareSlotStub } from '@/utils/shareLink'
import { isChartShaped } from '@/utils/chartShape'
import { normaliseCard, type ScryfallCard } from '@/utils/scryfall'

const CHARTS_KEY = 'mtg-chart:charts'
const ACTIVE_ID_KEY = 'mtg-chart:activeId'

// Two separate writes — not atomic. A crash between them leaves one key stale.
// loadOrInit recovers by falling back to charts[0] when activeId is unrecognised,
// so the worst case is activating the wrong chart, not data loss.
function persist(charts: Chart[], activeId: string): void {
  localStorage.setItem(CHARTS_KEY, JSON.stringify(charts))
  localStorage.setItem(ACTIVE_ID_KEY, activeId)
}

const STORAGE_FULL_MESSAGE =
  'Could not save — browser storage is full. Recent changes are kept in memory but may be lost if you close the tab.'
const PERSIST_DEBOUNCE_MS = 300

// Wraps persist so a storage failure (quota exceeded, storage disabled/blocked)
// never throws out of the persistence effect and crashes the React tree. Returns
// { ok: false } instead — the in-memory chart keeps working, only the save failed.
export function safeWrite(charts: Chart[], activeId: string): { ok: boolean } {
  try {
    persist(charts, activeId)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// Idempotent storageError transition. A successful write clears the error; a
// failure sets the message but returns an already-present one *by reference* so a
// storageError setState cannot re-enter the persist effect and retry the failing
// write (no quota retry loop).
export function nextStorageError(prev: string | undefined, ok: boolean): string | undefined {
  if (ok) return undefined
  return prev ?? STORAGE_FULL_MESSAGE
}

export interface PersistScheduler {
  schedule: (charts: Chart[], activeId: string) => void
  flush: () => void
  cancel: () => void
}

// Trailing-edge debounce around a write function. Coalesces the per-frame write
// stream from live crop drags / title typing into a single localStorage write,
// while the trailing edge still persists the final value (no drag-end event
// needed). flush() forces a pending write immediately — used on pagehide so a
// debounced change survives a tab close inside the debounce window.
export function createPersistScheduler(
  write: (charts: Chart[], activeId: string) => { ok: boolean },
  onResult: (ok: boolean) => void,
  delayMs: number,
): PersistScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { charts: Chart[]; activeId: string } | null = null

  const run = () => {
    timer = null
    if (!pending) return
    const { charts, activeId } = pending
    pending = null
    onResult(write(charts, activeId).ok)
  }

  return {
    schedule(charts, activeId) {
      pending = { charts, activeId }
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(run, delayMs)
    },
    flush() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      run()
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      pending = null
    },
  }
}

function readStoredCharts(): Chart[] {
  try {
    const raw = localStorage.getItem(CHARTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isChartShaped)) {
      return migrateAll(parsed as Chart[])
    }
  } catch { /* ignore */ }
  return []
}

function loadFromStorageOrDefault(): ChartsState {
  try {
    const chartsJson = localStorage.getItem(CHARTS_KEY)
    const storedActiveId = localStorage.getItem(ACTIVE_ID_KEY)
    if (chartsJson) {
      const parsed: unknown = JSON.parse(chartsJson)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isChartShaped)) {
        const charts = migrateAll(parsed as Chart[])
        const activeId =
          storedActiveId && charts.some((c) => c.id === storedActiveId)
            ? storedActiveId
            : charts[0].id
        return { charts, activeId }
      }
    }
  } catch {
    // Fall through to fresh default
  }
  const fresh = createDefaultChart()
  return { charts: [fresh], activeId: fresh.id }
}

interface CollectionResponse {
  data: ScryfallCard[]
  not_found: unknown[]
}

interface ChartsState {
  charts: Chart[]
  activeId: string
  // Set to true only when loadOrInit decoded a valid share-link param.
  // Absent (undefined) on normal loads and after any subsequent setState.
  consumedShareParam?: true
  pendingReconstruction?: Array<ShareSlotStub | null>
  isReconstructing?: boolean
  reconstructionError?: string
  reconstructionWarning?: string
  storageError?: string
}

// Does not call persist() — the useEffect in useCharts handles all writes.
// Does not call replaceState — a post-mount useEffect in useCharts does that,
// conditional on consumedShareParam so malformed ?c= params are left untouched.
export function loadOrInit(): ChartsState {
  const param = new URLSearchParams(window.location.search).get('c')
  if (param) {
    const result = decodeSharePayload(param)

    if (result.kind === 'compact') {
      const existingCharts = readStoredCharts()
      const placeholder: Chart = {
        ...result.payload.c,
        id: crypto.randomUUID(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        slots: [],
      }
      return {
        charts: [...existingCharts, placeholder],
        activeId: placeholder.id,
        consumedShareParam: true,
        pendingReconstruction: result.payload.s,
        isReconstructing: true,
      }
    }

    if (result.kind === 'legacy') {
      const existingCharts = readStoredCharts()
      const chart = { ...result.chart, id: crypto.randomUUID() }
      return { charts: [...existingCharts, chart], activeId: chart.id, consumedShareParam: true }
    }

    // error: fall through to stored/default; leave URL intact so user can see it
    return { ...loadFromStorageOrDefault(), reconstructionError: result.message }
  }

  return loadFromStorageOrDefault()
}

export function useCharts(): {
  charts: Chart[]
  activeId: string
  activeChart: Chart
  isReconstructing: boolean
  reconstructionError: string | null
  reconstructionWarning: string | null
  storageError: string | null
  createChart: () => void
  deleteChart: (id: string) => void
  updateChart: (updater: (prev: Chart) => Chart) => void
  renameChart: (id: string, name: string) => void
  setActiveId: (id: string) => void
  dismissReconstructionError: () => void
  dismissReconstructionWarning: () => void
  dismissStorageError: () => void
} {
  const [state, setState] = useState<ChartsState>(loadOrInit)

  // Capture the initial consumedShareParam and reconstruction context into refs so
  // post-mount effects can read them without being listed as dependencies. These
  // values are only meaningful at initial load time (set by loadOrInit from the URL).
  const consumedShareParamRef = useRef(state.consumedShareParam ?? false)
  const pendingReconstructionRef = useRef(state.pendingReconstruction ?? null)
  const placeholderIdRef = useRef(state.activeId)

  // Strip ?c= only when loadOrInit successfully decoded a share link.
  // A malformed or unrelated ?c= param leaves the URL unchanged.
  useEffect(() => {
    if (consumedShareParamRef.current) {
      const url = new URL(window.location.href)
      url.searchParams.delete('c')
      window.history.replaceState(null, '', url.toString())
    }
  }, [])

  // Reconstruct slots from Scryfall when a compact share link was decoded.
  // Runs once on mount. AbortController cleanup handles StrictMode double-invoke
  // and genuine unmount (e.g. user navigates away mid-fetch).
  useEffect(() => {
    const maybeStubs = pendingReconstructionRef.current
    if (!maybeStubs) return
    // Fresh binding so TypeScript infers the non-nullable type into the async closure
    const stubs = maybeStubs

    const placeholderId = placeholderIdRef.current
    const controller = new AbortController()

    async function run() {
      try {
        const nonNullStubs = stubs.filter((s): s is ShareSlotStub => s !== null)
        const cardMap = new Map<string, ScryfallSlot>()
        let notFoundCount = 0
        let normaliseFailCount = 0

        for (let i = 0; i < nonNullStubs.length; i += 75) {
          const chunk = nonNullStubs.slice(i, i + 75)
          const res = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: chunk.map((s) => ({ id: s.id })) }),
            signal: controller.signal,
          })
          if (!res.ok) throw new Error(`Scryfall collection returned ${res.status}`)
          const body = (await res.json()) as CollectionResponse
          notFoundCount += body.not_found.length
          for (const card of body.data) {
            const slot = normaliseCard(card)
            if (!slot) { normaliseFailCount++; continue }
            cardMap.set(card.id, slot)
          }
        }

        const slots = reconstructSlots(stubs, cardMap)
        const warningCount = notFoundCount + normaliseFailCount

        setState((prev) => {
          const prevChart = prev.charts.find((c) => c.id === placeholderId)
          if (!prevChart) {
            // Placeholder was deleted mid-fetch — discard result, just clear flags
            return { ...prev, pendingReconstruction: undefined, isReconstructing: false }
          }
          const updatedChart = { ...prevChart, slots }
          return {
            ...prev,
            charts: prev.charts.map((c) => (c.id === updatedChart.id ? updatedChart : c)),
            pendingReconstruction: undefined,
            isReconstructing: false,
            reconstructionWarning:
              warningCount > 0
                ? `${warningCount} card(s) from the shared link could not be found or loaded.`
                : undefined,
          }
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return

        setState((prev) => {
          const charts = prev.charts.filter((c) => c.id !== placeholderId)
          if (charts.length === 0) {
            const fresh = createDefaultChart()
            return {
              charts: [fresh],
              activeId: fresh.id,
              isReconstructing: false,
              reconstructionError: 'Could not load cards from Scryfall. Check your connection.',
            }
          }
          const activeId = charts.some((c) => c.id === prev.activeId)
            ? prev.activeId
            : charts[0].id
          return {
            ...prev,
            charts,
            activeId,
            pendingReconstruction: undefined,
            isReconstructing: false,
            reconstructionError: 'Could not load cards from Scryfall. Check your connection.',
          }
        })
      }
    }

    void run()
    return () => controller.abort()
  }, [])

  // Stable debounced persistence scheduler — created once, survives re-renders.
  // safeWrite never throws; a quota/storage failure flips storageError via the
  // idempotent nextStorageError transition.
  const schedulerRef = useRef<PersistScheduler | null>(null)
  if (schedulerRef.current === null) {
    schedulerRef.current = createPersistScheduler(
      safeWrite,
      (ok) =>
        setState((prev) => {
          const nextErr = nextStorageError(prev.storageError, ok)
          return nextErr === prev.storageError ? prev : { ...prev, storageError: nextErr }
        }),
      PERSIST_DEBOUNCE_MS,
    )
  }

  // Schedule a debounced write after every settled state change. Suppressed while
  // isReconstructing so the empty placeholder is never written before reconstruction
  // resolves. Deps are narrowed to the persisted slice (+ isReconstructing) so a
  // storageError setState cannot re-enter this effect and retry a failing write.
  useEffect(() => {
    if (state.isReconstructing) return
    schedulerRef.current!.schedule(state.charts, state.activeId)
  }, [state.charts, state.activeId, state.isReconstructing])

  // Flush a pending debounced write when the tab is hidden/closed so the last
  // change isn't lost inside the debounce window. cancel() on unmount avoids a
  // late setState from a timer firing after teardown.
  useEffect(() => {
    const flush = () => schedulerRef.current?.flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      schedulerRef.current?.cancel()
    }
  }, [])

  const { charts, activeId } = state
  const activeChart = charts.find((c) => c.id === activeId) ?? charts[0]

  // Runs the updater against the freshest active chart from prev. Bails out without a
  // new state object when the updater returns the same reference (no-op paths like
  // out-of-range clamps or missing-slot guards), preventing spurious re-renders and
  // unnecessary localStorage writes.
  const updateChart = useCallback((updater: (prev: Chart) => Chart) => {
    setState((prev) => {
      const prevActiveChart =
        prev.charts.find((c) => c.id === prev.activeId) ?? prev.charts[0]
      const nextChart = updater(prevActiveChart)
      if (nextChart === prevActiveChart) return prev
      const charts = prev.charts.map((c) => (c.id === nextChart.id ? nextChart : c))
      return { ...prev, charts }
    })
  }, [])

  // Renames any chart by id — not restricted to the active chart, so it uses its own
  // setState path rather than going through updateChart (which only operates on the
  // active chart).
  const renameChart = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      charts: prev.charts.map((c) => (c.id === id ? { ...c, name } : c)),
    }))
  }, [])

  const createChart = useCallback(() => {
    setState((prev) => {
      const fresh = createDefaultChart()
      return { charts: [...prev.charts, fresh], activeId: fresh.id }
    })
  }, [])

  const deleteChart = useCallback((id: string) => {
    setState((prev) => {
      const remaining = prev.charts.filter((c) => c.id !== id)
      if (remaining.length === 0) {
        const fresh = createDefaultChart()
        return { charts: [fresh], activeId: fresh.id }
      }
      let activeId = prev.activeId
      if (activeId === id) {
        const deletedIndex = prev.charts.findIndex((c) => c.id === id)
        // Activate previous sibling; falls back to first remaining when index 0 is deleted
        activeId = remaining[Math.max(0, deletedIndex - 1)].id
      }
      return { charts: remaining, activeId }
    })
  }, [])

  const setActiveId = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.charts.some((c) => c.id === id)) return prev
      return { ...prev, activeId: id }
    })
  }, [])

  const dismissReconstructionError = useCallback(() => {
    setState((prev) => ({ ...prev, reconstructionError: undefined }))
  }, [])

  const dismissReconstructionWarning = useCallback(() => {
    setState((prev) => ({ ...prev, reconstructionWarning: undefined }))
  }, [])

  const dismissStorageError = useCallback(() => {
    setState((prev) => (prev.storageError ? { ...prev, storageError: undefined } : prev))
  }, [])

  return {
    charts,
    activeId,
    activeChart,
    isReconstructing: state.isReconstructing ?? false,
    reconstructionError: state.reconstructionError ?? null,
    reconstructionWarning: state.reconstructionWarning ?? null,
    storageError: state.storageError ?? null,
    createChart,
    deleteChart,
    updateChart,
    renameChart,
    setActiveId,
    dismissReconstructionError,
    dismissReconstructionWarning,
    dismissStorageError,
  }
}
