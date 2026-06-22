import { useState, useCallback } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import { createDefaultChart } from '@/utils/defaultChart'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import type { Chart, Slot, CellDef, NumericStyleField } from '@/types/chart'

const STYLE_LIMITS: Record<NumericStyleField, [min: number, max: number]> = {
  cellGap: [0, 32],
  padding: [0, 64],
  cornerRadius: [0, 32],
}

function App() {
  const [chart, setChart] = useState<Chart>(createDefaultChart)

  // Slot-finding lives inside the functional updater so it always reads from prev,
  // not from the render-time chart snapshot — prevents a rapid double-click from
  // targeting the same slot twice.
  const handleSlotFill = useCallback((slot: Slot) => {
    setChart((prev) => {
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
  }, [])

  const handleSlotClear = useCallback((slotIndex: number) => {
    setChart((prev) => {
      const slots = [...prev.slots]
      slots[slotIndex] = null
      return { ...prev, slots }
    })
  }, [])

  const handleGridResize = useCallback(
    (dimension: 'rows' | 'cols', delta: 1 | -1) => {
      setChart((prev) => {
        const newRows = dimension === 'rows' ? prev.gridRows + delta : prev.gridRows
        const newCols = dimension === 'cols' ? prev.gridCols + delta : prev.gridCols
        if (newRows < 1 || newRows > 10 || newCols < 1 || newCols > 10) return prev
        if (delta === -1) {
          // Repack visible cards in row-major order into the new grid
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
    [],
  )

  const handleBgColorChange = useCallback((value: string) => {
    setChart((prev) => ({ ...prev, backgroundColor: value }))
  }, [])

  const handleStyleStep = useCallback((field: NumericStyleField, delta: number) => {
    setChart((prev) => {
      const [min, max] = STYLE_LIMITS[field]
      const next = (prev[field] as number) + delta
      if (next < min || next > max) return prev
      return { ...prev, [field]: next }
    })
  }, [])

  const handleSlotUpdate = useCallback((slotIndex: number, updated: Slot) => {
    setChart((prev) => {
      const slots = [...prev.slots]
      slots[slotIndex] = updated
      return { ...prev, slots }
    })
  }, [])

  const handleFaceToggle = useCallback((slotIndex: number) => {
    setChart((prev) => {
      const slot = getSlot(prev, slotIndex)
      if (!slot || slot.imageUris.length <= 1) return prev
      const slots = [...prev.slots]
      slots[slotIndex] = {
        ...slot,
        selectedFaceIndex: (slot.selectedFaceIndex === 0 ? 1 : 0) as 0 | 1,
      }
      return { ...prev, slots }
    })
  }, [])

  return (
    <div className="app">
      <ControlPanel
        chart={chart}
        onSlotFill={handleSlotFill}
        onGridResize={handleGridResize}
        onBgColorChange={handleBgColorChange}
        onStyleStep={handleStyleStep}
      />
      <GridArea
        chart={chart}
        onSlotClear={handleSlotClear}
        onSlotUpdate={handleSlotUpdate}
        onFaceToggle={handleFaceToggle}
      />
    </div>
  )
}

export default App
