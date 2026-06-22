import type { Chart, CellMap, Slot } from '@/types/chart'
import { getSlot } from '@/utils/chart'
import styles from './NameDisplay.module.css'

interface OverlayProps {
  mode: 'overlay'
  slot: Slot
}

interface SidebarProps {
  mode: 'sidebar'
  chart: Chart
  cellMap: CellMap
}

type Props = OverlayProps | SidebarProps

export default function NameDisplay(props: Props) {
  if (props.mode === 'overlay') {
    return (
      <div className={styles.overlay}>
        <span className={styles.overlayText}>{props.slot.cardName}</span>
      </div>
    )
  }

  const { chart, cellMap } = props

  const rows = Array.from({ length: chart.gridRows }, (_, r) => {
    const names: string[] = []
    for (let c = 0; c < chart.gridCols; c++) {
      const cell = cellMap[r * chart.gridCols + c]
      if (!cell || cell.kind === 'covered') continue
      const slot = getSlot(chart, cell.slotIndex)
      if (slot) names.push(slot.cardName)
    }
    return names
  })

  return (
    <div
      className={styles.sidebar}
      style={{
        gridTemplateRows: `repeat(${chart.gridRows}, 1fr)`,
        gap: chart.cellGap,
      }}
    >
      {rows.map((names, r) => (
        <div key={r} className={styles.sidebarRow}>
          {names.map((name, i) => (
            <span key={i} className={styles.sidebarName}>
              {name}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
