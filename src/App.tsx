import { useState, useCallback } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import { createDefaultChart } from '@/utils/defaultChart'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import type { Chart, Slot, CellDef } from '@/types/chart'

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
          const cellMap = generateCellMap(prev.gridRows, prev.gridCols)
          const blocked = cellMap.some((cell) => {
            if (cell.kind === 'covered') return false
            const slot = getSlot(prev, cell.slotIndex)
            if (!slot) return false
            const row = Math.floor(cell.slotIndex / prev.gridCols)
            const col = cell.slotIndex % prev.gridCols
            return row >= newRows || col >= newCols
          })
          if (blocked) return prev
        }
        return { ...prev, gridRows: newRows, gridCols: newCols }
      })
    },
    [],
  )

  return (
    <div className="app">
      <ControlPanel
        chart={chart}
        onSlotFill={handleSlotFill}
        onGridResize={handleGridResize}
      />
      <GridArea chart={chart} onSlotClear={handleSlotClear} />
    </div>
  )
}

export default App
