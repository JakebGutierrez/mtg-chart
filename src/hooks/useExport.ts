import { useState, useRef, useCallback, type RefObject } from 'react'
import type { Chart, Slot } from '@/types/chart'
import { getSlot } from '@/utils/chart'
import { generateCellMap } from '@/utils/cellMap'
import { fetchAsBlob, loadImage, FetchError } from '@/utils/imageBlob'
import { fetchCardById } from '@/utils/scryfall'

export type ExportScale = 1 | 2

export interface UseExportResult {
  exporting: boolean
  error: string | null
  warning: string | null
  scale: ExportScale
  setScale: (s: ExportScale) => void
  dismissError: () => void
  dismissWarning: () => void
  triggerExport: () => void
}

const TITLE_FONT_SIZE = 18
const TITLE_LINE_HEIGHT = 1.5
const TITLE_PADDING_BOTTOM = 12
const SIDEBAR_GAP = 16
const SIDEBAR_MIN_WIDTH = 120
const SIDEBAR_MAX_WIDTH = 200
const SIDEBAR_PADDING_H = 10
const SIDEBAR_FONT_SIZE = 12
const SIDEBAR_LINE_HEIGHT = 1.5
const OVERLAY_FONT_SIZE = 11
const TEXT_PRIMARY = '#e8e8e8'
const OVERLAY_BG = 'rgba(0,0,0,0.65)'
const BG_CELL = '#1a1c21'
const BORDER_CELL = '#2a2c32'
const BODY_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

function measureSidebarWidth(names: string[]): number {
  const scratch = document.createElement('canvas')
  const ctx = scratch.getContext('2d')!
  ctx.font = `${SIDEBAR_FONT_SIZE}px ${BODY_FONT}`
  const maxText = names.reduce((max, n) => Math.max(max, ctx.measureText(n).width), 0)
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, maxText + SIDEBAR_PADDING_H * 2))
}

function fillTextTruncated(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y)
    return
  }
  let t = text
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1)
  }
  ctx.fillText(t + '…', x, y)
}

function drawCoverCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  cropX = 0.5,
  cropY = 0.5,
  cropScale = 1.0,
) {
  const srcAspect = img.naturalWidth / img.naturalHeight
  const dstAspect = dw / dh
  let sw: number, sh: number
  if (srcAspect > dstAspect) {
    sh = img.naturalHeight
    sw = img.naturalHeight * dstAspect
  } else {
    sw = img.naturalWidth
    sh = img.naturalWidth / dstAspect
  }
  sw /= cropScale
  sh /= cropScale
  const sx = (img.naturalWidth - sw) * cropX
  const sy = (img.naturalHeight - sh) * cropY
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

export function useExport(
  chart: Chart,
  onSlotImageUpdate: (slotIndex: number, imageUris: Slot['imageUris']) => void,
  gridRef: RefObject<HTMLDivElement | null>,
): UseExportResult {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [scale, setScale] = useState<ExportScale>(2)
  const exportingRef = useRef(false)

  const dismissError = useCallback(() => {
    setError(null)
    setWarning(null)
  }, [])
  const dismissWarning = useCallback(() => setWarning(null), [])

  const triggerExport = useCallback(async () => {
    if (exportingRef.current || !gridRef.current) return
    exportingRef.current = true
    setExporting(true)
    setError(null)
    setWarning(null)

    const blobUrls: string[] = []

    try {
      await document.fonts.ready

      if (!gridRef.current) return

      const isIOS =
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

      const cols = chart.gridCols
      const rows = chart.gridRows
      const gap = chart.cellGap
      const padding = chart.padding

      // Cell dims from DOM — matches what the user sees
      const gridClientWidth = gridRef.current.getBoundingClientRect().width
      const cellW = (gridClientWidth - gap * (cols - 1)) / cols
      const cellH = chart.displayMode === 'square' ? cellW : cellW * (3 / 4)

      const totalGridW = cols * cellW + (cols - 1) * gap
      const totalGridH = rows * cellH + (rows - 1) * gap
      const titleHeight = chart.title
        ? TITLE_FONT_SIZE * TITLE_LINE_HEIGHT + TITLE_PADDING_BOTTOM
        : 0

      // Sidebar width measured before preflight so innerW is accurate
      let sidebarWidth = 0
      let sidebarSection = 0
      if (chart.nameDisplayMode === 'sidebar') {
        const cellMap = generateCellMap(rows, cols)
        const names = cellMap
          .filter((c) => c.kind !== 'covered')
          .flatMap((c) => {
            const s = getSlot(chart, c.slotIndex)
            return s ? [s.cardName] : []
          })
        sidebarWidth = measureSidebarWidth(names)
        sidebarSection = SIDEBAR_GAP + sidebarWidth
      }

      const innerW = totalGridW + sidebarSection
      const innerH = totalGridH + titleHeight

      const fitsAt = (s: number) => {
        const w = (innerW + 2 * padding) * s
        const h = (innerH + 2 * padding) * s
        return isIOS ? w * h <= 3_000_000 : w <= 8192 && h <= 8192
      }

      let finalScale: ExportScale = scale
      if (!fitsAt(finalScale)) {
        finalScale = 1
        if (!fitsAt(1)) {
          setError('Grid is too large to export. Reduce grid size or cell dimensions.')
          return
        }
        setWarning('Export downgraded to 1× — grid is too large for 2×.')
      }

      const exportW = Math.round((innerW + 2 * padding) * finalScale)
      const exportH = Math.round((innerH + 2 * padding) * finalScale)

      // Pre-fetch blobs with 404 recovery
      const cellMap = generateCellMap(rows, cols)
      const filledCells = cellMap.filter(
        (c): c is Exclude<(typeof cellMap)[number], { kind: 'covered' }> =>
          c.kind !== 'covered' && getSlot(chart, c.slotIndex) !== null,
      )

      const imgBySlot = new Map<number, HTMLImageElement>()

      for (const cell of filledCells) {
        const slot = getSlot(chart, cell.slotIndex)!
        const artCropUrl = slot.imageUris[slot.selectedFaceIndex].artCrop

        let blob: Blob
        try {
          blob = await fetchAsBlob(artCropUrl)
        } catch (e) {
          if (!(e instanceof FetchError) || e.status !== 404) throw e
          const recovered = await fetchCardById(slot.scryfallId)
          if (!recovered) {
            throw new Error(`Failed to load image for "${slot.cardName}". Try again.`, { cause: e })
          }
          onSlotImageUpdate(cell.slotIndex, recovered.imageUris)
          const newUrl = recovered.imageUris[slot.selectedFaceIndex]?.artCrop
          if (!newUrl) {
            throw new Error(`No image available for "${slot.cardName}".`, { cause: e })
          }
          try {
            blob = await fetchAsBlob(newUrl)
          } catch (retryErr) {
            throw new Error(`Failed to load image for "${slot.cardName}". Try again.`, {
              cause: retryErr,
            })
          }
        }

        const blobUrl = URL.createObjectURL(blob)
        blobUrls.push(blobUrl)
        imgBySlot.set(cell.slotIndex, await loadImage(blobUrl))
      }

      // Draw
      const canvas = document.createElement('canvas')
      canvas.width = exportW
      canvas.height = exportH
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable — device may be low on memory.')

      ctx.scale(finalScale, finalScale)

      // Background
      ctx.fillStyle = chart.backgroundColor
      ctx.fillRect(0, 0, innerW + 2 * padding, innerH + 2 * padding)

      // Title
      if (chart.title) {
        ctx.save()
        ctx.font = `600 ${TITLE_FONT_SIZE}px ${BODY_FONT}`
        ctx.fillStyle = TEXT_PRIMARY
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          chart.title,
          padding + innerW / 2,
          padding + titleHeight / 2,
        )
        ctx.restore()
      }

      const gridOriginX = padding
      const gridOriginY = padding + titleHeight

      // Cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const slotIndex = r * cols + c
          const cellX = gridOriginX + c * (cellW + gap)
          const cellY = gridOriginY + r * (cellH + gap)
          const slot = getSlot(chart, slotIndex)
          const img = imgBySlot.get(slotIndex)

          ctx.save()
          ctx.beginPath()
          ctx.roundRect(cellX, cellY, cellW, cellH, chart.cornerRadius)

          if (slot && img) {
            ctx.clip()
            drawCoverCrop(ctx, img, cellX, cellY, cellW, cellH, slot.cropX, slot.cropY, slot.cropScale)

            if (chart.nameDisplayMode === 'overlay') {
              const overlayH = 20 + OVERLAY_FONT_SIZE * 1.5 + 5
              const gradY = cellY + cellH - overlayH
              const grad = ctx.createLinearGradient(0, gradY, 0, cellY + cellH)
              grad.addColorStop(0, 'transparent')
              grad.addColorStop(1, OVERLAY_BG)
              ctx.fillStyle = grad
              ctx.fillRect(cellX, gradY, cellW, overlayH)

              ctx.font = `${OVERLAY_FONT_SIZE}px ${BODY_FONT}`
              ctx.fillStyle = TEXT_PRIMARY
              ctx.textAlign = 'left'
              ctx.textBaseline = 'bottom'
              fillTextTruncated(ctx, slot.cardName, cellX + 6, cellY + cellH - 5, cellW - 12)
            }
          } else {
            ctx.fillStyle = BG_CELL
            ctx.fill()
            ctx.strokeStyle = BORDER_CELL
            ctx.lineWidth = 1
            ctx.stroke()
          }

          ctx.restore()
        }
      }

      // Sidebar
      if (chart.nameDisplayMode === 'sidebar') {
        const sidebarX = gridOriginX + totalGridW + SIDEBAR_GAP
        const lineH = SIDEBAR_FONT_SIZE * SIDEBAR_LINE_HEIGHT

        ctx.font = `${SIDEBAR_FONT_SIZE}px ${BODY_FONT}`
        ctx.fillStyle = TEXT_PRIMARY
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'

        for (let r = 0; r < rows; r++) {
          const names: string[] = []
          for (let c = 0; c < cols; c++) {
            const s = getSlot(chart, r * cols + c)
            if (s) names.push(s.cardName)
          }
          if (names.length === 0) continue

          const rowY = gridOriginY + r * (cellH + gap)
          const blockH = names.length * lineH
          const blockY = rowY + (cellH - blockH) / 2

          ctx.save()
          ctx.beginPath()
          ctx.rect(sidebarX, rowY, sidebarWidth, cellH)
          ctx.clip()

          names.forEach((name, i) => {
            fillTextTruncated(
              ctx,
              name,
              sidebarX + SIDEBAR_PADDING_H,
              blockY + i * lineH,
              sidebarWidth - SIDEBAR_PADDING_H * 2,
            )
          })

          ctx.restore()
        }
      }

      // Download
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Export failed — try 1× scale or a smaller grid.'))
            return
          }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${chart.title || chart.name || 'mtg-chart'}.png`
          a.click()
          URL.revokeObjectURL(url)
          resolve()
        }, 'image/png')
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      blobUrls.forEach((url) => URL.revokeObjectURL(url))
      setExporting(false)
      exportingRef.current = false
    }
  }, [chart, scale, onSlotImageUpdate, gridRef])

  return { exporting, error, warning, scale, setScale, dismissError, dismissWarning, triggerExport }
}
