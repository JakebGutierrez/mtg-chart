import { useCallback, useRef } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import { useExport } from '@/hooks/useExport'
import { useCharts } from '@/hooks/useCharts'
import type { Slot, CellDef, NumericStyleField, NameDisplayMode } from '@/types/chart'

const STYLE_LIMITS: Record<NumericStyleField, [min: number, max: number]> = {
  cellGap: [0, 32],
  padding: [0, 64],
  cornerRadius: [0, 32],
}

function App() {
  const { charts, activeId, activeChart, createChart, deleteChart, updateChart, renameChart, setActiveId } =
    useCharts()

  // All handlers use the functional-updater form of updateChart so mutations always
  // run against the freshest prev chart, not a potentially stale render-time snapshot.

  const handleSlotFill = useCallback(
    (slot: Slot) => {
      updateChart((prev) => {
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
    [updateChart],
  )

  const handleSlotClear = useCallback(
    (slotIndex: number) => {
      updateChart((prev) => {
        const slots = [...prev.slots]
        slots[slotIndex] = null
        return { ...prev, slots }
      })
    },
    [updateChart],
  )

  const handleGridResize = useCallback(
    (dimension: 'rows' | 'cols', delta: 1 | -1) => {
      updateChart((prev) => {
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
    [updateChart],
  )

  const handleBgColorChange = useCallback(
    (value: string) => {
      updateChart((prev) => ({ ...prev, backgroundColor: value }))
    },
    [updateChart],
  )

  const handleStyleStep = useCallback(
    (field: NumericStyleField, delta: number) => {
      updateChart((prev) => {
        const [min, max] = STYLE_LIMITS[field]
        const next = (prev[field] as number) + delta
        if (next < min || next > max) return prev
        return { ...prev, [field]: next }
      })
    },
    [updateChart],
  )

  const handleSlotUpdate = useCallback(
    (slotIndex: number, updated: Slot) => {
      updateChart((prev) => {
        const slots = [...prev.slots]
        slots[slotIndex] = updated
        return { ...prev, slots }
      })
    },
    [updateChart],
  )

  const handleTitleChange = useCallback(
    (value: string) => {
      updateChart((prev) => ({ ...prev, title: value }))
    },
    [updateChart],
  )

  const handleNameDisplayChange = useCallback(
    (mode: NameDisplayMode) => {
      updateChart((prev) => ({ ...prev, nameDisplayMode: mode }))
    },
    [updateChart],
  )

  const handleFaceToggle = useCallback(
    (slotIndex: number) => {
      updateChart((prev) => {
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
    [updateChart],
  )

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
        onSelectChart={setActiveId}
        onCreateChart={createChart}
        onDeleteChart={deleteChart}
        onRenameChart={renameChart}
        exporting={exporting}
        exportScale={exportScale}
        onScaleChange={setExportScale}
        onExport={triggerExport}
      />
      <GridArea
        chart={activeChart}
        onSlotClear={handleSlotClear}
        onSlotUpdate={handleSlotUpdate}
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
