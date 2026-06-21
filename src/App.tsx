import { useState, useCallback } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import { createDefaultChart } from '@/utils/defaultChart'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import type { Chart, Slot } from '@/types/chart'

function App() {
  const [chart, setChart] = useState<Chart>(createDefaultChart)

  // Slot-finding lives inside the functional updater so it always reads from prev,
  // not from the render-time chart snapshot — prevents a rapid double-click from
  // targeting the same slot twice.
  const handleSlotFill = useCallback((slot: Slot) => {
    setChart((prev) => {
      const cellMap = generateCellMap(prev.gridRows, prev.gridCols)
      const target = cellMap.find(
        (c) => c.kind !== 'covered' && getSlot(prev, c.slotIndex) === null,
      )
      if (!target || target.kind === 'covered') return prev
      const slots = [...prev.slots]
      slots[target.slotIndex] = slot
      return { ...prev, slots }
    })
  }, [])

  return (
    <div className="app">
      <ControlPanel chart={chart} onSlotFill={handleSlotFill} />
      <GridArea chart={chart} />
    </div>
  )
}

export default App
