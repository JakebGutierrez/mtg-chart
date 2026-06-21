import { useMemo } from 'react'
import type { Chart, Slot } from '@/types/chart'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import SearchPanel from '@/components/SearchPanel'
import styles from './ControlPanel.module.css'

interface Props {
  chart: Chart
  onSlotFill: (slot: Slot) => void
  onGridResize: (dimension: 'rows' | 'cols', delta: 1 | -1) => void
}

export default function ControlPanel({ chart, onSlotFill, onGridResize }: Props) {
  const cellMap = useMemo(
    () => generateCellMap(chart.gridRows, chart.gridCols),
    [chart.gridRows, chart.gridCols],
  )

  const colShrinkBlocked =
    chart.gridCols > 1 &&
    cellMap.some((cell) => {
      if (cell.kind === 'covered') return false
      const slot = getSlot(chart, cell.slotIndex)
      return slot !== null && cell.slotIndex % chart.gridCols === chart.gridCols - 1
    })

  const rowShrinkBlocked =
    chart.gridRows > 1 &&
    cellMap.some((cell) => {
      if (cell.kind === 'covered') return false
      const slot = getSlot(chart, cell.slotIndex)
      return slot !== null && Math.floor(cell.slotIndex / chart.gridCols) === chart.gridRows - 1
    })

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.logo}>MTG Chart</span>
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Search</h2>
          <SearchPanel chart={chart} onSlotFill={onSlotFill} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Grid</h2>
          <div className={styles.row}>
            <span className={styles.label}>Width</span>
            <div className={styles.stepper}>
              <button
                className={styles.stepperBtn}
                type="button"
                aria-label="Decrease columns"
                disabled={chart.gridCols <= 1 || colShrinkBlocked}
                onClick={() => onGridResize('cols', -1)}
              >
                −
              </button>
              <span className={styles.stepperValue}>{chart.gridCols}</span>
              <button
                className={styles.stepperBtn}
                type="button"
                aria-label="Increase columns"
                disabled={chart.gridCols >= 10}
                onClick={() => onGridResize('cols', 1)}
              >
                +
              </button>
            </div>
          </div>
          {colShrinkBlocked && (
            <p className={styles.shrinkWarning}>Remove cards in the last column first.</p>
          )}
          <div className={styles.row}>
            <span className={styles.label}>Height</span>
            <div className={styles.stepper}>
              <button
                className={styles.stepperBtn}
                type="button"
                aria-label="Decrease rows"
                disabled={chart.gridRows <= 1 || rowShrinkBlocked}
                onClick={() => onGridResize('rows', -1)}
              >
                −
              </button>
              <span className={styles.stepperValue}>{chart.gridRows}</span>
              <button
                className={styles.stepperBtn}
                type="button"
                aria-label="Increase rows"
                disabled={chart.gridRows >= 10}
                onClick={() => onGridResize('rows', 1)}
              >
                +
              </button>
            </div>
          </div>
          {rowShrinkBlocked && (
            <p className={styles.shrinkWarning}>Remove cards in the last row first.</p>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Style</h2>
          <div className={styles.row}>
            <span className={styles.label}>Background</span>
            <span className={styles.value}>{chart.backgroundColor}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Gap</span>
            <span className={styles.value}>{chart.cellGap}px</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Padding</span>
            <span className={styles.value}>{chart.padding}px</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Corner Radius</span>
            <span className={styles.value}>{chart.cornerRadius}px</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Names</h2>
          <div className={styles.row}>
            <span className={styles.label}>Mode</span>
            <span className={styles.value}>{chart.nameDisplayMode}</span>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <button className={styles.exportBtn} type="button" disabled>
          Export PNG
        </button>
      </footer>
    </aside>
  )
}
