import { useMemo } from 'react'
import type { Chart } from '@/types/chart'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import styles from './Grid.module.css'

interface Props {
  chart: Chart
}

export default function GridArea({ chart }: Props) {
  const cellMap = useMemo(
    () => generateCellMap(chart.gridRows, chart.gridCols),
    [chart.gridRows, chart.gridCols],
  )

  return (
    <main className={styles.area}>
      <div
        className={styles.canvas}
        style={{
          padding: chart.padding,
          background: chart.backgroundColor,
          width: 'clamp(400px, 70vw, 900px)',
        }}
      >
        <div
          className={styles.grid}
          style={{
            gridTemplateRows: `repeat(${chart.gridRows}, 1fr)`,
            gridTemplateColumns: `repeat(${chart.gridCols}, 1fr)`,
            gap: chart.cellGap,
          }}
        >
          {cellMap.map((cell) => {
            if (cell.kind === 'covered') return null
            const slot = getSlot(chart, cell.slotIndex)
            return (
              <div
                key={cell.slotIndex}
                className={styles.cell}
                style={{ borderRadius: chart.cornerRadius }}
              >
                {slot && (
                  <img
                    src={slot.imageUris[slot.selectedFaceIndex].artCrop}
                    alt={slot.cardName}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
