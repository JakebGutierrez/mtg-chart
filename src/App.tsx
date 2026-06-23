import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import { useExport } from '@/hooks/useExport'
import { useCharts } from '@/hooks/useCharts'
import type { Chart, Slot, CellDef, NumericStyleField, NameDisplayMode } from '@/types/chart'

const STYLE_LIMITS: Record<NumericStyleField, [min: number, max: number]> = {
  cellGap: [0, 32],
  padding: [0, 64],
  cornerRadius: [0, 32],
}

interface History {
  past: Chart[]
  future: Chart[]
}

function App() {
  const { charts, activeId, activeChart, createChart, deleteChart, updateChart, renameChart, setActiveId } =
    useCharts()

  // Option B: per-chart undo/redo history lives here in App, above useCharts.
  // History is session-only — not persisted to localStorage.
  // Only content mutations push history; chart-level ops and handleSlotImageUpdate do not.
  const [history, setHistory] = useState<History>({ past: [], future: [] })

  // Wraps updateChart with history push. Runs the updater against activeChart first to
  // detect no-ops (same reference returned) and skip the history push in that case.
  // Known tradeoff: the no-op check runs on render-time activeChart while updateChart
  // runs the updater on the freshest prev inside the reducer. In practice these are
  // always the same — handleSlotImageUpdate (the only other updateChart caller) fires
  // from an async export Promise, a separate event-loop task that is never batched
  // with user interactions in this app.
  const updateChartWithHistory = useCallback(
    (updater: (prev: Chart) => Chart) => {
      if (updater(activeChart) !== activeChart) {
        setHistory((h) => ({
          past: [...h.past.slice(-49), activeChart],
          future: [],
        }))
      }
      updateChart(updater)
    },
    [updateChart, activeChart],
  )

  // History resets synchronously when switching charts so canUndo/canRedo are
  // immediately correct for the newly active chart.
  const handleSelectChart = useCallback(
    (id: string) => {
      setHistory({ past: [], future: [] })
      setActiveId(id)
    },
    [setActiveId],
  )

  const handleCreateChart = useCallback(() => {
    setHistory({ past: [], future: [] })
    createChart()
  }, [createChart])

  const handleDeleteChart = useCallback(
    (id: string) => {
      if (id === activeId) setHistory({ past: [], future: [] })
      deleteChart(id)
    },
    [activeId, deleteChart],
  )

  const undo = useCallback(() => {
    if (history.past.length === 0) return
    const snapshot = history.past[history.past.length - 1]
    setHistory((h) => ({
      past: h.past.slice(0, -1),
      future: [activeChart, ...h.future.slice(0, 49)],
    }))
    updateChart(() => snapshot)
  }, [history, activeChart, updateChart])

  const redo = useCallback(() => {
    if (history.future.length === 0) return
    const snapshot = history.future[0]
    setHistory((h) => ({
      past: [...h.past.slice(-49), activeChart],
      future: h.future.slice(1),
    }))
    updateChart(() => snapshot)
  }, [history, activeChart, updateChart])

  // Stable keyboard listener via ref — avoids re-registering on every history change.
  // useLayoutEffect (not useEffect) closes the window between commit and the native
  // keydown firing, preventing a keystroke from calling a stale closure.
  const undoRedoRef = useRef({ undo, redo })
  useLayoutEffect(() => {
    undoRedoRef.current = { undo, redo }
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+Z = undo; Cmd/Ctrl+Shift+Z = redo; Ctrl+Y = redo (Windows)
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z'
      const isRedo =
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') ||
        (e.ctrlKey && !e.metaKey && e.key === 'y')
      if (!isUndo && !isRedo) return
      e.preventDefault()
      if (isRedo) undoRedoRef.current.redo()
      else undoRedoRef.current.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // All handlers use the functional-updater form of updateChartWithHistory so mutations
  // always run against the freshest prev chart, not a potentially stale render-time snapshot.

  const handleSlotFill = useCallback(
    (slot: Slot) => {
      updateChartWithHistory((prev) => {
        const cellMap = generateCellMap(prev.gridRows, prev.gridCols)
        const target = cellMap.find(
          (c): c is Exclude<CellDef, { kind: 'covered' }> =>
            c.kind !== 'covered' && getSlot(prev, c.slotIndex) === null,
        )
        if (!target) return prev
        const slots = [...prev.slots]
        slots[target.slotIndex] = slot
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory],
  )

  const handleSlotClear = useCallback(
    (slotIndex: number) => {
      updateChartWithHistory((prev) => {
        const slots = [...prev.slots]
        slots[slotIndex] = null
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory],
  )

  const handleSlotMove = useCallback(
    (from: number, to: number) => {
      updateChartWithHistory((prev) => {
        if (from === to) return prev
        const slots = [...prev.slots]
        slots[to] = getSlot(prev, from) ?? null
        slots[from] = getSlot(prev, to) ?? null
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory],
  )

  const handleGridResize = useCallback(
    (dimension: 'rows' | 'cols', delta: 1 | -1) => {
      updateChartWithHistory((prev) => {
        const newRows = dimension === 'rows' ? prev.gridRows + delta : prev.gridRows
        const newCols = dimension === 'cols' ? prev.gridCols + delta : prev.gridCols
        if (newRows < 1 || newRows > 10 || newCols < 1 || newCols > 10) return prev
        if (delta === -1) {
          const cellMap = generateCellMap(prev.gridRows, prev.gridCols)
          const cards = cellMap
            .filter((c): c is Exclude<CellDef, { kind: 'covered' }> => c.kind !== 'covered')
            .map((c) => getSlot(prev, c.slotIndex))
            .filter((s): s is Slot => s !== null)
          return { ...prev, gridRows: newRows, gridCols: newCols, slots: cards }
        }
        return { ...prev, gridRows: newRows, gridCols: newCols }
      })
    },
    [updateChartWithHistory],
  )

  const handleBgColorChange = useCallback(
    (value: string) => {
      updateChartWithHistory((prev) => ({ ...prev, backgroundColor: value }))
    },
    [updateChartWithHistory],
  )

  const handleStyleStep = useCallback(
    (field: NumericStyleField, delta: number) => {
      updateChartWithHistory((prev) => {
        const [min, max] = STYLE_LIMITS[field]
        const next = (prev[field] as number) + delta
        if (next < min || next > max) return prev
        return { ...prev, [field]: next }
      })
    },
    [updateChartWithHistory],
  )

  const handleSlotUpdate = useCallback(
    (slotIndex: number, updated: Slot) => {
      updateChartWithHistory((prev) => {
        const slots = [...prev.slots]
        slots[slotIndex] = updated
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory],
  )

  const handleTitleChange = useCallback(
    (value: string) => {
      updateChartWithHistory((prev) => ({ ...prev, title: value }))
    },
    [updateChartWithHistory],
  )

  const handleNameDisplayChange = useCallback(
    (mode: NameDisplayMode) => {
      updateChartWithHistory((prev) => ({ ...prev, nameDisplayMode: mode }))
    },
    [updateChartWithHistory],
  )

  const handleFaceToggle = useCallback(
    (slotIndex: number) => {
      updateChartWithHistory((prev) => {
        const slot = getSlot(prev, slotIndex)
        if (!slot || slot.imageUris.length <= 1) return prev
        const slots = [...prev.slots]
        slots[slotIndex] = {
          ...slot,
          selectedFaceIndex: (slot.selectedFaceIndex === 0 ? 1 : 0) as 0 | 1,
        }
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory],
  )

  // NOT history-tracked: transparent image URI cache refresh on 404 during export.
  const handleSlotImageUpdate = useCallback(
    (slotIndex: number, imageUris: Slot['imageUris']) => {
      updateChart((prev) => {
        const slot = getSlot(prev, slotIndex)
        if (!slot) return prev
        const slots = [...prev.slots]
        slots[slotIndex] = { ...slot, imageUris }
        return { ...prev, slots }
      })
    },
    [updateChart],
  )

  const gridRef = useRef<HTMLDivElement>(null)
  const {
    exporting,
    error: exportError,
    warning: exportWarning,
    scale: exportScale,
    setScale: setExportScale,
    dismissError,
    dismissWarning,
    triggerExport,
  } = useExport(activeChart, handleSlotImageUpdate, gridRef)

  return (
    <div className="app">
      <ControlPanel
        chart={activeChart}
        charts={charts}
        activeId={activeId}
        onSlotFill={handleSlotFill}
        onGridResize={handleGridResize}
        onBgColorChange={handleBgColorChange}
        onStyleStep={handleStyleStep}
        onTitleChange={handleTitleChange}
        onNameDisplayChange={handleNameDisplayChange}
        onSelectChart={handleSelectChart}
        onCreateChart={handleCreateChart}
        onDeleteChart={handleDeleteChart}
        onRenameChart={renameChart}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        exporting={exporting}
        exportScale={exportScale}
        onScaleChange={setExportScale}
        onExport={triggerExport}
      />
      <GridArea
        chart={activeChart}
        onSlotClear={handleSlotClear}
        onSlotUpdate={handleSlotUpdate}
        onSlotMove={handleSlotMove}
        onFaceToggle={handleFaceToggle}
        gridRef={gridRef}
        exportError={exportError}
        exportWarning={exportWarning}
        onDismissError={dismissError}
        onDismissWarning={dismissWarning}
      />
    </div>
  )
}

export default App
