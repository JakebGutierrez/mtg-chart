import { useState } from 'react'
import './App.css'
import ControlPanel from '@/components/ControlPanel'
import GridArea from '@/components/Grid'
import { createDefaultChart } from '@/utils/defaultChart'
import type { Chart } from '@/types/chart'

function App() {
  const [chart] = useState<Chart>(createDefaultChart)

  return (
    <div className="app">
      <ControlPanel chart={chart} />
      <GridArea chart={chart} />
    </div>
  )
}

export default App
