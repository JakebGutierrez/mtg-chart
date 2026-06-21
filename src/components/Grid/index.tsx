import type { Chart } from '@/types/chart'
import { generateCellMap } from '@/utils/cellMap'
import styles from './Grid.module.css'

interface Props {
  chart: Chart
}

export default function GridArea({ chart }: Props) {
  const cellMap = generateCellMap(chart.gridRows, chart.gridCols)

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
            return (
              <div
                key={cell.slotIndex}
                className={styles.cell}
                style={{ borderRadius: chart.cornerRadius }}
              />
            )
          })}
        </div>
      </div>
    </main>
  )
}
