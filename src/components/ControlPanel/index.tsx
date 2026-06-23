import { useState, useRef, useEffect } from 'react'
import type { Chart, Slot, NumericStyleField, NameDisplayMode } from '@/types/chart'
import type { ExportScale } from '@/hooks/useExport'
import SearchPanel from '@/components/SearchPanel'
import Stepper from '@/components/Stepper'
import styles from './ControlPanel.module.css'

interface Props {
  chart: Chart
  charts: Chart[]
  activeId: string
  onSlotFill: (slot: Slot) => void
  onGridResize: (dimension: 'rows' | 'cols', delta: 1 | -1) => void
  onBgColorChange: (value: string) => void
  onStyleStep: (field: NumericStyleField, delta: number) => void
  onTitleChange: (value: string) => void
  onNameDisplayChange: (mode: NameDisplayMode) => void
  onSelectChart: (id: string) => void
  onCreateChart: () => void
  onDeleteChart: (id: string) => void
  onRenameChart: (id: string, name: string) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  exporting: boolean
  exportScale: ExportScale
  onScaleChange: (s: ExportScale) => void
  onExport: () => void
}

function ChartPicker({
  charts,
  activeId,
  onSelectChart,
  onCreateChart,
  onDeleteChart,
  onRenameChart,
}: Pick<Props, 'charts' | 'activeId' | 'onSelectChart' | 'onCreateChart' | 'onDeleteChart' | 'onRenameChart'>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  function startEditing(chart: Chart) {
    setEditingId(chart.id)
    setDraftName(chart.name)
  }

  function commitEdit(id: string) {
    const trimmed = draftName.trim()
    if (trimmed) onRenameChart(id, trimmed)
    setEditingId(null)
  }

  return (
    <section className={styles.section}>
      <div className={styles.pickerHeader}>
        <h2 className={styles.sectionLabel}>Charts</h2>
        <button
          className={styles.pickerAdd}
          type="button"
          aria-label="New chart"
          onClick={onCreateChart}
        >
          +
        </button>
      </div>
      <ul className={styles.pickerList}>
        {charts.map((c) => {
          const isActive = c.id === activeId
          const isEditing = editingId === c.id
          return (
            <li
              key={c.id}
              className={`${styles.pickerItem}${isActive ? ` ${styles.pickerItemActive}` : ''}`}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className={styles.pickerNameInput}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitEdit(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <button
                  className={styles.pickerName}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      startEditing(c)
                    } else {
                      onSelectChart(c.id)
                    }
                  }}
                  title={isActive ? 'Click to rename' : c.name}
                >
                  {c.name}
                </button>
              )}
              {charts.length > 1 && (
                <button
                  className={styles.pickerDelete}
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => onDeleteChart(c.id)}
                >
                  ×
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function ControlPanel({
  chart,
  charts,
  activeId,
  onSlotFill,
  onGridResize,
  onBgColorChange,
  onStyleStep,
  onTitleChange,
  onNameDisplayChange,
  onSelectChart,
  onCreateChart,
  onDeleteChart,
  onRenameChart,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  exporting,
  exportScale,
  onScaleChange,
  onExport,
}: Props) {
  const occupiedCount = chart.slots.filter((s) => s != null).length

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.logo}>MTG Chart</span>
      </header>

      <div className={styles.body}>
        <ChartPicker
          charts={charts}
          activeId={activeId}
          onSelectChart={onSelectChart}
          onCreateChart={onCreateChart}
          onDeleteChart={onDeleteChart}
          onRenameChart={onRenameChart}
        />

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Search</h2>
          <SearchPanel chart={chart} onSlotFill={onSlotFill} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Grid</h2>
          <div className={styles.row}>
            <span className={styles.label}>Width</span>
            <Stepper
              value={chart.gridCols}
              min={1}
              max={10}
              decrementLabel="Decrease columns"
              incrementLabel="Increase columns"
              decrementDisabled={
                chart.gridCols <= 1 || occupiedCount > chart.gridRows * (chart.gridCols - 1)
              }
              onDecrement={() => onGridResize('cols', -1)}
              onIncrement={() => onGridResize('cols', 1)}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Height</span>
            <Stepper
              value={chart.gridRows}
              min={1}
              max={10}
              decrementLabel="Decrease rows"
              incrementLabel="Increase rows"
              decrementDisabled={
                chart.gridRows <= 1 || occupiedCount > (chart.gridRows - 1) * chart.gridCols
              }
              onDecrement={() => onGridResize('rows', -1)}
              onIncrement={() => onGridResize('rows', 1)}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Style</h2>
          <div className={styles.row}>
            <span className={styles.label}>Background</span>
            <label className={styles.colorControl}>
              <span
                className={styles.colorSwatch}
                style={{ backgroundColor: chart.backgroundColor }}
              />
              <span className={styles.colorHex}>{chart.backgroundColor}</span>
              <input
                type="color"
                className={styles.colorInput}
                value={chart.backgroundColor}
                onChange={(e) => onBgColorChange(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Gap</span>
            <Stepper
              value={chart.cellGap}
              min={0}
              max={32}
              unit="px"
              decrementLabel="Decrease gap"
              incrementLabel="Increase gap"
              onDecrement={() => onStyleStep('cellGap', -2)}
              onIncrement={() => onStyleStep('cellGap', 2)}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Padding</span>
            <Stepper
              value={chart.padding}
              min={0}
              max={64}
              unit="px"
              decrementLabel="Decrease padding"
              incrementLabel="Increase padding"
              onDecrement={() => onStyleStep('padding', -4)}
              onIncrement={() => onStyleStep('padding', 4)}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Corner Radius</span>
            <Stepper
              value={chart.cornerRadius}
              min={0}
              max={32}
              unit="px"
              decrementLabel="Decrease corner radius"
              incrementLabel="Increase corner radius"
              onDecrement={() => onStyleStep('cornerRadius', -2)}
              onIncrement={() => onStyleStep('cornerRadius', 2)}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Title</h2>
          <input
            className={styles.titleInput}
            type="text"
            aria-label="Chart title"
            placeholder="Chart title…"
            value={chart.title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Names</h2>
          <div className={styles.segmented} role="radiogroup" aria-label="Name display mode">
            {(['none', 'overlay', 'sidebar'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={chart.nameDisplayMode === mode}
                className={`${styles.segBtn}${chart.nameDisplayMode === mode ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => onNameDisplayChange(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.undoRow}>
          <button
            className={styles.undoBtn}
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo"
            title="Undo (Cmd+Z)"
          >
            Undo
          </button>
          <button
            className={styles.undoBtn}
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo"
            title="Redo (Cmd+Shift+Z)"
          >
            Redo
          </button>
        </div>
        <div className={styles.scaleRow}>
          <span className={styles.label}>Scale</span>
          <div className={styles.segmented} role="radiogroup" aria-label="Export scale">
            {([1, 2] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={exportScale === s}
                className={`${styles.segBtn}${exportScale === s ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => onScaleChange(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
        <button
          className={styles.exportBtn}
          type="button"
          disabled={exporting || occupiedCount === 0}
          onClick={onExport}
        >
          {exporting ? 'Exporting…' : 'Export PNG'}
        </button>
      </footer>
    </aside>
  )
}
