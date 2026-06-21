import styles from './Grid.module.css'

const DEMO_ROWS = 5
const DEMO_COLS = 5

export default function GridArea() {
  return (
    <main className={styles.area}>
      <div className={styles.canvas}>
        <div
          className={styles.grid}
          style={{
            gridTemplateRows: `repeat(${DEMO_ROWS}, 1fr)`,
            gridTemplateColumns: `repeat(${DEMO_COLS}, 1fr)`,
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
