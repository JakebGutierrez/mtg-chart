import { useMemo, useState, useCallback, type RefObject } from 'react'
import type { Chart, Slot } from '@/types/chart'
import { generateCellMap } from '@/utils/cellMap'
import { getSlot } from '@/utils/chart'
import { isMultiFaceLayout } from '@/utils/scryfall'
import ContextMenu from '@/components/ContextMenu'
import PrintingSwitcher from '@/components/PrintingSwitcher'
import NameDisplay from '@/components/NameDisplay'
import styles from './Grid.module.css'

interface Props {
  chart: Chart
  onSlotClear: (slotIndex: number) => void
  onSlotUpdate: (slotIndex: number, updated: Slot) => void
  onFaceToggle: (slotIndex: number) => void
  gridRef: RefObject<HTMLDivElement | null>
  exportError: string | null
  exportWarning: string | null
  onDismissError: () => void
  onDismissWarning: () => void
}

export default function GridArea({
  chart,
  onSlotClear,
  onSlotUpdate,
  onFaceToggle,
  gridRef,
  exportError,
  exportWarning,
  onDismissError,
  onDismissWarning,
}: Props) {
  const cellMap = useMemo(
    () => generateCellMap(chart.gridRows, chart.gridCols),
    [chart.gridRows, chart.gridCols],
  )

  const [contextMenu, setContextMenu] = useState<{
    slotIndex: number
    x: number
    y: number
  } | null>(null)
  const [printingFor, setPrintingFor] = useState<number | null>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleCellContextMenu = useCallback((e: React.MouseEvent, slotIndex: number) => {
    e.preventDefault()
    setContextMenu({ slotIndex, x: e.clientX, y: e.clientY })
  }, [])

  const handleContextRemove = useCallback(() => {
    if (contextMenu === null) return
    onSlotClear(contextMenu.slotIndex)
    setContextMenu(null)
  }, [contextMenu, onSlotClear])

  const handleContextSwitchPrinting = useCallback(() => {
    if (contextMenu === null) return
    setPrintingFor(contextMenu.slotIndex)
    setContextMenu(null)
  }, [contextMenu])

  const handleContextSwitchFace = useCallback(() => {
    if (contextMenu === null) return
    onFaceToggle(contextMenu.slotIndex)
    setContextMenu(null)
  }, [contextMenu, onFaceToggle])

  const handlePrintingSelect = (updated: Slot) => {
    if (printingFor === null) return
    onSlotUpdate(printingFor, updated)
    setPrintingFor(null)
  }

  const contextMenuSlot = contextMenu !== null ? getSlot(chart, contextMenu.slotIndex) : null
  const printingSlot = printingFor !== null ? getSlot(chart, printingFor) : null

  return (
    <main className={styles.area}>
      <div className={styles.canvasGroup}>
        {exportError && (
          <div className={styles.errorBanner} role="alert">
            <span>{exportError}</span>
            <button type="button" className={styles.errorDismiss} onClick={onDismissError} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {exportWarning && !exportError && (
          <div className={styles.warningBanner} role="status">
            <span>{exportWarning}</span>
            <button
              type="button"
              className={styles.errorDismiss}
              onClick={onDismissWarning}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        <div
        className={styles.canvas}
        style={{
          padding: chart.padding,
          background: chart.backgroundColor,
        }}
      >
        {chart.title && <div className={styles.chartTitle}>{chart.title}</div>}
        <div
          className={styles.canvasBody}
          style={{ gap: chart.nameDisplayMode === 'sidebar' ? 16 : undefined }}
        >
          <div
            ref={gridRef}
            className={styles.grid}
            style={{
              gridTemplateRows: `repeat(${chart.gridRows}, 1fr)`,
              gridTemplateColumns: `repeat(${chart.gridCols}, 1fr)`,
              gap: chart.cellGap,
              width: 'clamp(400px, 70vw, 900px)',
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
                  onContextMenu={
                    slot ? (e) => handleCellContextMenu(e, cell.slotIndex) : undefined
                  }
                >
                  {slot && (
                    <>
                      <img
                        className={styles.cardImg}
                        src={slot.imageUris[slot.selectedFaceIndex].artCrop}
                        alt={slot.cardName}
                      />
                      {chart.nameDisplayMode === 'overlay' && (
                        <NameDisplay mode="overlay" slot={slot} />
                      )}
                      <button
                        className={styles.removeBtn}
                        type="button"
                        aria-label={`Remove ${slot.cardName}`}
                        onClick={() => onSlotClear(cell.slotIndex)}
                      >
                        ×
                      </button>
                      <button
                        className={styles.printingBtn}
                        type="button"
                        aria-label={`Switch printing for ${slot.cardName}`}
                        onClick={() => setPrintingFor(cell.slotIndex)}
                      >
                        ⇄
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {chart.nameDisplayMode === 'sidebar' && (
            <NameDisplay mode="sidebar" chart={chart} cellMap={cellMap} />
          )}
        </div>
        </div>
      </div>

      {contextMenu !== null && contextMenuSlot !== null && (
        <ContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onRemove={handleContextRemove}
          onSwitchPrinting={handleContextSwitchPrinting}
          onSwitchFace={
            isMultiFaceLayout(contextMenuSlot.layout) && contextMenuSlot.imageUris.length > 1
              ? handleContextSwitchFace
              : null
          }
          onClose={closeContextMenu}
        />
      )}

      {printingFor !== null && printingSlot !== null && (
        <PrintingSwitcher
          currentSlot={printingSlot}
          onSelect={handlePrintingSelect}
          onClose={() => setPrintingFor(null)}
        />
      )}
    </main>
  )
}
