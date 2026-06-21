import styles from './Grid.module.css'

// Temporary demo constants — replaced by chart config in Phase 3
const DEMO_ROWS = 5
const DEMO_COLS = 5
const DEMO_GAP = 4
const DEMO_PADDING = 16

export default function GridArea() {
  return (
    <main className={styles.area}>
      <div
        className={styles.canvas}
        style={{ padding: DEMO_PADDING, width: 'clamp(400px, 70vw, 900px)' }}
      >
        <div
          className={styles.grid}
          style={{
            gridTemplateRows: `repeat(${DEMO_ROWS}, 1fr)`,
            gridTemplateColumns: `repeat(${DEMO_COLS}, 1fr)`,
            gap: DEMO_GAP,
          }}
        >
          {Array.from({ length: DEMO_ROWS * DEMO_COLS }).map((_, i) => (
            <div key={i} className={styles.cell} />
          ))}
        </div>
      </div>
    </main>
  )
}
