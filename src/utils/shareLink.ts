import LZString from 'lz-string'
import type { Chart, Slot, ScryfallSlot, Layout, DisplayMode, NameDisplayMode, HeroConfig } from '@/types/chart'
import { migrateAll } from '@/utils/schemaVersion'
import { isChartShaped } from '@/utils/chartShape'

// ─── Phase 20 compact codec ───────────────────────────────────────────────────

export interface ShareSlotStub {
  id: string   // scryfallId
  f?: 0 | 1   // selectedFaceIndex — omitted when 0
  x?: number  // cropX   — omitted when 0.5
  y?: number  // cropY   — omitted when 0.5
  z?: number  // cropScale — omitted when 1.0
}

interface SharePayloadChart {
  name: string
  gridRows: number
  gridCols: number
  layout: Layout
  heroConfig: HeroConfig
  displayMode: DisplayMode
  nameDisplayMode: NameDisplayMode
  title: string
  titleFont?: string
  backgroundColor: string
  cellGap: number
  padding: number
  cornerRadius: number
}

export interface SharePayload {
  v: 1
  c: SharePayloadChart
  s: Array<ShareSlotStub | null>
}

export type DecodeResult =
  | { kind: 'compact'; payload: SharePayload }
  | { kind: 'legacy'; chart: Chart }
  | { kind: 'error'; message: string }

export function encodeShareLink(chart: Chart): { encoded: string; customSlotsOmitted: number } {
  let customSlotsOmitted = 0

  const s: Array<ShareSlotStub | null> = chart.slots.map((slot) => {
    if (slot === null) return null
    if (slot.kind === 'custom') {
      customSlotsOmitted++
      return null
    }
    const stub: ShareSlotStub = { id: slot.scryfallId }
    if (slot.selectedFaceIndex !== 0) stub.f = slot.selectedFaceIndex
    if (slot.cropX !== 0.5) stub.x = slot.cropX
    if (slot.cropY !== 0.5) stub.y = slot.cropY
    if (slot.cropScale !== 1.0) stub.z = slot.cropScale
    return stub
  })

  const payload: SharePayload = {
    v: 1,
    c: {
      name: chart.name,
      gridRows: chart.gridRows,
      gridCols: chart.gridCols,
      layout: chart.layout,
      heroConfig: chart.heroConfig,
      displayMode: chart.displayMode,
      nameDisplayMode: chart.nameDisplayMode,
      title: chart.title,
      titleFont: chart.titleFont !== undefined && ALLOWED_TITLE_FONTS_SET.has(chart.titleFont) ? chart.titleFont : undefined,
      backgroundColor: chart.backgroundColor,
      cellGap: chart.cellGap,
      padding: chart.padding,
      cornerRadius: chart.cornerRadius,
    },
    s,
  }

  const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
  return { encoded, customSlotsOmitted }
}

export const ALLOWED_TITLE_FONTS = [
  'Cinzel', 'Cormorant Garamond', 'Uncial Antiqua', 'Inter', 'Comic Neue',
] as const

const ALLOWED_TITLE_FONTS_SET = new Set<string>(ALLOWED_TITLE_FONTS)

function isSharePayloadShaped(v: unknown): v is SharePayload {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  if (p.v !== 1) return false
  if (!Array.isArray(p.s)) return false
  if (typeof p.c !== 'object' || p.c === null) return false
  const c = p.c as Record<string, unknown>
  // Numeric grid dimensions
  if (typeof c.gridRows !== 'number' || c.gridRows < 1 || !Number.isInteger(c.gridRows)) return false
  if (typeof c.gridCols !== 'number' || c.gridCols < 1 || !Number.isInteger(c.gridCols)) return false
  // Required string fields
  if (typeof c.name !== 'string') return false
  if (typeof c.title !== 'string') return false
  if (typeof c.backgroundColor !== 'string') return false
  // Required numeric style fields
  if (typeof c.cellGap !== 'number') return false
  if (typeof c.padding !== 'number') return false
  if (typeof c.cornerRadius !== 'number') return false
  // Enum fields
  if (c.layout !== 'uniform' && c.layout !== 'hybrid') return false
  if (c.displayMode !== 'landscape' && c.displayMode !== 'square') return false
  if (c.nameDisplayMode !== 'none' && c.nameDisplayMode !== 'sidebar' && c.nameDisplayMode !== 'overlay') return false
  // heroConfig must be an array (item shapes are validated at runtime when used)
  if (!Array.isArray(c.heroConfig)) return false
  // titleFont must be one of the known font names when present
  if (c.titleFont !== undefined && (typeof c.titleFont !== 'string' || !ALLOWED_TITLE_FONTS_SET.has(c.titleFont))) return false
  // Stub validation — f must be 0 or 1 if present to prevent out-of-bounds imageUris access
  for (const stub of p.s as unknown[]) {
    if (stub === null) continue
    if (typeof stub !== 'object') return false
    const st = stub as Record<string, unknown>
    if (typeof st.id !== 'string' || st.id.length === 0) return false
    if (st.f !== undefined && st.f !== 0 && st.f !== 1) return false
    if (st.x !== undefined && typeof st.x !== 'number') return false
    if (st.y !== undefined && typeof st.y !== 'number') return false
    if (st.z !== undefined && typeof st.z !== 'number') return false
  }
  return true
}

export function decodeSharePayload(raw: string): DecodeResult {
  // Try new compact format (lz-string + JSON with v field)
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(raw)
    if (decompressed) {
      const parsed: unknown = JSON.parse(decompressed)
      if (typeof parsed === 'object' && parsed !== null && 'v' in parsed) {
        const v = (parsed as { v: unknown }).v
        if (v === 1) {
          if (!isSharePayloadShaped(parsed)) {
            return { kind: 'error', message: 'Invalid or expired link.' }
          }
          return { kind: 'compact', payload: parsed }
        }
        // Recognisable structure but future/unknown version
        return { kind: 'error', message: 'Link format not supported — ask sender to regenerate.' }
      }
      // Decompressed but no v field — treat as legacy
    }
  } catch {
    // Decompression or parse failure — try legacy path
  }

  // Legacy fallback: Phase 16 base64+encodeURIComponent+JSON
  try {
    const json = decodeURIComponent(atob(raw))
    const parsed: unknown = JSON.parse(json)
    if (!isChartShaped(parsed)) return { kind: 'error', message: 'Invalid or expired link.' }
    const chart = migrateAll([parsed as Chart])[0]
    return { kind: 'legacy', chart }
  } catch {
    return { kind: 'error', message: 'Invalid or expired link.' }
  }
}

export function reconstructSlots(
  stubs: Array<ShareSlotStub | null>,
  cardMap: Map<string, ScryfallSlot>,
): Array<Slot | null> {
  return stubs.map((stub) => {
    if (stub === null) return null
    const slot = cardMap.get(stub.id)
    if (!slot) return null
    return {
      ...slot,
      selectedFaceIndex: stub.f ?? 0,
      cropX: stub.x ?? 0.5,
      cropY: stub.y ?? 0.5,
      cropScale: stub.z ?? 1.0,
    }
  })
}
