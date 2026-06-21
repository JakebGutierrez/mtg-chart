import type { Chart, Slot } from '@/types/chart'
import SearchPanel from '@/components/SearchPanel'
import styles from './ControlPanel.module.css'

interface Props {
  chart: Chart
  onSlotFill: (slot: Slot) => void
}

export default function ControlPanel({ chart, onSlotFill }: Props) {
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
            <span className={styles.value}>{chart.gridCols}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Height</span>
            <span className={styles.value}>{chart.gridRows}</span>
          </div>
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
