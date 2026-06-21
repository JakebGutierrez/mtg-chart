import styles from './ControlPanel.module.css'

export default function ControlPanel() {
  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.logo}>MTG Chart</span>
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Search</h2>
          <div className={styles.placeholder}>Search panel</div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Grid</h2>
          <div className={styles.row}>
            <span className={styles.label}>Width</span>
            <span className={styles.value}>5</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Height</span>
            <span className={styles.value}>5</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Style</h2>
          <div className={styles.row}>
            <span className={styles.label}>Background</span>
            <span className={styles.value}>#0b0c0e</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Gap</span>
            <span className={styles.value}>4px</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Padding</span>
            <span className={styles.value}>16px</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Corner Radius</span>
            <span className={styles.value}>4px</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Names</h2>
          <div className={styles.placeholder}>None · Sidebar · Overlay</div>
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
