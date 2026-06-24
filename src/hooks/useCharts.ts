import { useState, useCallback, useEffect } from 'react'
import type { Chart } from '@/types/chart'
import { createDefaultChart } from '@/utils/defaultChart'
import { migrateAll } from '@/utils/schemaVersion'
import { decodeChart } from '@/utils/shareLink'

const CHARTS_KEY = 'mtg-chart:charts'
const ACTIVE_ID_KEY = 'mtg-chart:activeId'

// Two separate writes — not atomic. A crash between them leaves one key stale.
// loadOrInit recovers by falling back to charts[0] when activeId is unrecognised,
// so the worst case is activating the wrong chart, not data loss.
function persist(charts: Chart[], activeId: string): void {
  localStorage.setItem(CHARTS_KEY, JSON.stringify(charts))
  localStorage.setItem(ACTIVE_ID_KEY, activeId)
}

function isSlotShaped(el: unknown): boolean {
  if (el === null) return true
  if (typeof el !== 'object') return false
  const s = el as Record<string, unknown>
  return typeof s.scryfallId === 'string' && Array.isArray(s.imageUris)
}

function isChartShaped(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.gridRows === 'number' &&
    typeof c.gridCols === 'number' &&
    Array.isArray(c.slots) &&
    (c.slots as unknown[]).every(isSlotShaped)
  )
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

// Does not call persist() — the useEffect in useCharts handles all writes.
// Does not call replaceState — that side effect lives in a post-mount useEffect
// in useCharts so StrictMode's double-invocation of this initialiser is safe.
export function loadOrInit(): { charts: Chart[]; activeId: string } {
  const param = new URLSearchParams(window.location.search).get('c')
  if (param) {
    const shared = decodeChart(param)
    if (shared) {
      const existingCharts = readStoredCharts()
      const chart = { ...shared, id: crypto.randomUUID() }
      return { charts: [...existingCharts, chart], activeId: chart.id }
    }
  }

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

interface ChartsState {
  charts: Chart[]
  activeId: string
}

export function useCharts(): {
  charts: Chart[]
  activeId: string
  activeChart: Chart
  createChart: () => void
  deleteChart: (id: string) => void
  updateChart: (updater: (prev: Chart) => Chart) => void
  renameChart: (id: string, name: string) => void
  setActiveId: (id: string) => void
} {
  const [state, setState] = useState<ChartsState>(loadOrInit)

  // loadOrInit leaves ?c= in the URL so StrictMode's double-invocation sees the
  // param on both calls. After mount the param is no longer needed — strip it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('c')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Persist after every state change — keeps all setState updaters pure (no side effects).
  useEffect(() => {
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

  return { charts, activeId, activeChart, createChart, deleteChart, updateChart, renameChart, setActiveId }
}
