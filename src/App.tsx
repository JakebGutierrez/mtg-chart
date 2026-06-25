import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import ImportModal from '@/components/ImportModal'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import { useExport } from '@/hooks/useExport'
import { useCharts } from '@/hooks/useCharts'
import { sortSlots, shuffleSlots } from '@/utils/sort'
import type { SortKey } from '@/utils/sort'
import { encodeChart } from '@/utils/shareLink'
import type { Chart, Slot, ScryfallSlot, CellDef, NumericStyleField, NameDisplayMode, DisplayMode, Layout, HeroConfig } from '@/types/chart'

type LayoutMode = 'uniform' | 'commander' | 'partner'

const COMMANDER_HERO_CONFIG: HeroConfig = [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }]
const PARTNER_HERO_CONFIG: HeroConfig = [
  { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
  { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
]

function getLayoutMode(heroConfig: HeroConfig): LayoutMode {
  if (heroConfig.length === 0) return 'uniform'
  if (heroConfig.length >= 2) return 'partner'
  return 'commander'
}

const STYLE_LIMITS: Record<NumericStyleField, [min: number, max: number]> = {
  cellGap: [0, 32],
  padding: [0, 64],
  cornerRadius: [0, 32],
}

interface History {
  past: Chart[]
  future: Chart[]
}

type CropValues = { cropX: number; cropY: number; cropScale: number }

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

  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // History resets synchronously when switching charts so canUndo/canRedo are
  // immediately correct for the newly active chart.
  const handleSelectChart = useCallback(
    (id: string) => {
      setHistory({ past: [], future: [] })
      setSelectedSlotIndex(null)
      setActiveId(id)
    },
    [setActiveId],
  )

  const handleCreateChart = useCallback(() => {
    setHistory({ past: [], future: [] })
    setSelectedSlotIndex(null)
    createChart()
  }, [createChart])

  const handleDeleteChart = useCallback(
    (id: string) => {
      if (id === activeId) {
        setHistory({ past: [], future: [] })
        setSelectedSlotIndex(null)
      }
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
    setSelectedSlotIndex(null)
    updateChart(() => snapshot)
  }, [history, activeChart, updateChart])

  const redo = useCallback(() => {
    if (history.future.length === 0) return
    const snapshot = history.future[0]
    setHistory((h) => ({
      past: [...h.past.slice(-49), activeChart],
      future: h.future.slice(1),
    }))
    setSelectedSlotIndex(null)
    updateChart(() => snapshot)
  }, [history, activeChart, updateChart])

  // Stable keyboard listener via ref — avoids re-registering on every history change.
  // useLayoutEffect (not useEffect) closes the window between commit and the native
  // keydown firing, preventing a keystroke from calling a stale closure.
  const undoRedoRef = useRef({ undo, redo, importActive: false })
  useLayoutEffect(() => {
    undoRedoRef.current = { undo, redo, importActive: showImportModal }
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Block undo/redo while the import modal is open — runLoop has pre-assigned
      // slot indices and does not cancel on chart changes, so mutating the chart
      // mid-import can cause cards to land in the wrong slots.
      if (undoRedoRef.current.importActive) return
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
        const cellMap = generateCellMap(prev.gridRows, prev.gridCols, prev.heroConfig)
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
      if (slotIndex === selectedSlotIndex) setSelectedSlotIndex(null)
      updateChartWithHistory((prev) => {
        const slots = [...prev.slots]
        slots[slotIndex] = null
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory, selectedSlotIndex],
  )

  const handleSlotMove = useCallback(
    (from: number, to: number) => {
      // Keep the crop selection tracking the card that moved, not the index it left.
      if (selectedSlotIndex === from) setSelectedSlotIndex(to)
      else if (selectedSlotIndex === to) setSelectedSlotIndex(from)
      updateChartWithHistory((prev) => {
        if (from === to) return prev
        const slots = [...prev.slots]
        slots[to] = getSlot(prev, from) ?? null
        slots[from] = getSlot(prev, to) ?? null
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory, selectedSlotIndex],
  )

  const handleGridResize = useCallback(
    (dimension: 'rows' | 'cols', delta: 1 | -1) => {
      // Shrink recompacts slots into a new dense array, making any selectedSlotIndex
      // stale (it may now point to a different card or out-of-bounds). Clear it.
      if (delta === -1) setSelectedSlotIndex(null)
      updateChartWithHistory((prev) => {
        const newRows = dimension === 'rows' ? prev.gridRows + delta : prev.gridRows
        const newCols = dimension === 'cols' ? prev.gridCols + delta : prev.gridCols
        if (newRows < 1 || newRows > 10 || newCols < 1 || newCols > 10) return prev
        // Block shrink if any hero would extend beyond the new grid dimensions
        if (prev.heroConfig.some((h) => h.row + h.rowSpan > newRows || h.col + h.colSpan > newCols)) return prev
        if (delta === -1) {
          const cellMap = generateCellMap(prev.gridRows, prev.gridCols, prev.heroConfig)
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

  const handleDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      updateChartWithHistory((prev) => ({ ...prev, displayMode: mode }))
    },
    [updateChartWithHistory],
  )

  const handleLayoutModeChange = useCallback(
    (mode: LayoutMode) => {
      if (getLayoutMode(activeChart.heroConfig) === mode) return
      const hasCards = activeChart.slots.some((s) => s !== null)
      if (hasCards && !window.confirm('Changing the layout will clear all placed cards. Continue?')) return
      const heroConfig = mode === 'commander' ? COMMANDER_HERO_CONFIG
        : mode === 'partner' ? PARTNER_HERO_CONFIG
        : []
      const layout: Layout = mode === 'uniform' ? 'uniform' : 'hybrid'
      updateChartWithHistory((prev) => ({ ...prev, heroConfig, layout, slots: [] }))
    },
    [activeChart, updateChartWithHistory],
  )

  const handleSort = useCallback(
    (key: SortKey) => {
      updateChartWithHistory((prev) => ({ ...prev, slots: sortSlots(prev.slots, key) }))
    },
    [updateChartWithHistory],
  )

  const handleShuffle = useCallback(() => {
    updateChartWithHistory((prev) => ({ ...prev, slots: shuffleSlots(prev.slots) }))
  }, [updateChartWithHistory])

  const handleClearCards = useCallback(() => {
    if (!window.confirm('Clear all cards from this chart?')) return
    setSelectedSlotIndex(null)
    updateChartWithHistory((prev) => ({ ...prev, slots: [] }))
  }, [updateChartWithHistory])

  const handleCopyLink = useCallback((): Promise<void> => {
    const encoded = encodeChart(activeChart)
    const url = `${window.location.origin}${window.location.pathname}?c=${encodeURIComponent(encoded)}`
    return navigator.clipboard.writeText(url)
  }, [activeChart])

  const handleFaceToggle = useCallback(
    (slotIndex: number) => {
      updateChartWithHistory((prev) => {
        const slot = getSlot(prev, slotIndex)
        if (!slot || slot.kind !== 'scryfall' || slot.imageUris.length <= 1) return prev
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

  const handleCellSelect = useCallback((slotIndex: number | null) => {
    setSelectedSlotIndex(slotIndex)
  }, [])

  // Crop drag: push the pre-drag chart to history once on mousedown, then
  // apply live updates without history during the drag. This gives a single
  // undo step that reverts the entire drag, not one step per pixel moved.
  const handleCropDragBegin = useCallback(() => {
    setHistory((h) => ({
      past: [...h.past.slice(-49), activeChart],
      future: [],
    }))
  }, [activeChart])

  const handleCropLive = useCallback(
    (crop: CropValues) => {
      if (selectedSlotIndex === null) return
      updateChart((prev) => {
        const slot = getSlot(prev, selectedSlotIndex)
        if (!slot) return prev
        const slots = [...prev.slots]
        slots[selectedSlotIndex] = { ...slot, ...crop }
        return { ...prev, slots }
      })
    },
    [updateChart, selectedSlotIndex],
  )

  // Used for discrete crop changes (zoom slider, reset) — each gets its own undo entry.
  const handleCropChange = useCallback(
    (crop: CropValues) => {
      if (selectedSlotIndex === null) return
      updateChartWithHistory((prev) => {
        const slot = getSlot(prev, selectedSlotIndex)
        if (!slot) return prev
        const slots = [...prev.slots]
        slots[selectedSlotIndex] = { ...slot, ...crop }
        return { ...prev, slots }
      })
    },
    [updateChartWithHistory, selectedSlotIndex],
  )

  // Import: push a single undo snapshot before any cards are placed.
  const handleImportBegin = useCallback(() => {
    setHistory((h) => ({
      past: [...h.past.slice(-49), activeChart],
      future: [],
    }))
  }, [activeChart])

  // Import: place a card at a specific pre-assigned slot index (no history push per card).
  const handleSlotPlace = useCallback(
    (slotIndex: number, slot: Slot) => {
      updateChart((prev) => {
        const slots = [...prev.slots]
        slots[slotIndex] = slot
        return { ...prev, slots }
      })
    },
    [updateChart],
  )

  // Import: expand grid rows to fit imported cards (no history push — covered by handleImportBegin).
  const handleImportExpand = useCallback(
    (newRows: number) => {
      updateChart((prev) => {
        if (newRows <= prev.gridRows || newRows > 10) return prev
        return { ...prev, gridRows: newRows }
      })
    },
    [updateChart],
  )

  // NOT history-tracked: transparent image URI cache refresh on 404 during export.
  const handleSlotImageUpdate = useCallback(
    (slotIndex: number, imageUris: ScryfallSlot['imageUris']) => {
      updateChart((prev) => {
        const slot = getSlot(prev, slotIndex)
        if (!slot || slot.kind !== 'scryfall') return prev
        const slots = [...prev.slots]
        slots[slotIndex] = { ...slot, imageUris }
        return { ...prev, slots }
      })
    },
    [updateChart],
  )

  const selectedSlot =
    selectedSlotIndex !== null ? (getSlot(activeChart, selectedSlotIndex) ?? null) : null

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
      <button
        className="menuToggle"
        type="button"
        aria-label="Toggle controls"
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((o) => !o)}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
      {mobileMenuOpen && (
        <div className="backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
      <ControlPanel
        chart={activeChart}
        charts={charts}
        activeId={activeId}
        mobileOpen={mobileMenuOpen}
        onSlotFill={handleSlotFill}
        onGridResize={handleGridResize}
        onBgColorChange={handleBgColorChange}
        onStyleStep={handleStyleStep}
        onTitleChange={handleTitleChange}
        onNameDisplayChange={handleNameDisplayChange}
        onDisplayModeChange={handleDisplayModeChange}
        onLayoutModeChange={handleLayoutModeChange}
        onSelectChart={handleSelectChart}
        onCreateChart={handleCreateChart}
        onDeleteChart={handleDeleteChart}
        onRenameChart={renameChart}
        canUndo={history.past.length > 0 && !showImportModal}
        canRedo={history.future.length > 0 && !showImportModal}
        onUndo={undo}
        onRedo={redo}
        exporting={exporting}
        exportScale={exportScale}
        onScaleChange={setExportScale}
        onExport={triggerExport}
        selectedSlot={selectedSlot}
        onCropDragBegin={handleCropDragBegin}
        onCropLive={handleCropLive}
        onCropChange={handleCropChange}
        onOpenImport={() => setShowImportModal(true)}
        onClearCards={handleClearCards}
        onSort={handleSort}
        onShuffle={handleShuffle}
        onCopyLink={handleCopyLink}
      />
      {showImportModal && (
        <ImportModal
          chart={activeChart}
          onImportBegin={handleImportBegin}
          onSlotPlace={handleSlotPlace}
          onExpandGrid={handleImportExpand}
          onClose={() => setShowImportModal(false)}
        />
      )}
      <GridArea
        chart={activeChart}
        onSlotClear={handleSlotClear}
        onSlotUpdate={handleSlotUpdate}
        onSlotMove={handleSlotMove}
        onFaceToggle={handleFaceToggle}
        selectedSlotIndex={selectedSlotIndex}
        onCellSelect={handleCellSelect}
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
