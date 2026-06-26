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
  createChart: () => void
  deleteChart: (id: string) => void
  updateChart: (updater: (prev: Chart) => Chart) => void
  renameChart: (id: string, name: string) => void
  setActiveId: (id: string) => void
  dismissReconstructionError: () => void
  dismissReconstructionWarning: () => void
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

  // Persist after every settled state change. Suppressed while isReconstructing
  // so the empty placeholder chart is never written before reconstruction
  // resolves — on failure the placeholder is removed and existing charts persist.
  useEffect(() => {
    if (state.isReconstructing) return
    persist(state.charts, state.activeId)
  }, [state])

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

  return {
    charts,
    activeId,
    activeChart,
    isReconstructing: state.isReconstructing ?? false,
    reconstructionError: state.reconstructionError ?? null,
    reconstructionWarning: state.reconstructionWarning ?? null,
    createChart,
    deleteChart,
    updateChart,
    renameChart,
    setActiveId,
    dismissReconstructionError,
    dismissReconstructionWarning,
  }
}
