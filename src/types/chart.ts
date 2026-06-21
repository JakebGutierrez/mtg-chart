export type Layout = 'uniform' | 'hybrid'
export type DisplayMode = 'landscape' | 'square'
export type NameDisplayMode = 'none' | 'sidebar' | 'overlay'

export interface Slot {
  kind: 'scryfall'
  scryfallId: string
  oracleId: string
  cardName: string
  setCode: string
  collectorNumber: string
  layout: string
  selectedFaceIndex: 0 | 1
  imageUris: Array<{
    artCrop: string
    normal: string
  }>
  // Post-MVP: manual crop framing (bump schemaVersion when added)
  cropX?: number   // 0–1 normalised horizontal offset, default 0.5
  cropY?: number   // 0–1 normalised vertical offset, default 0.5
  cropScale?: number // 1.0 = fit; >1 = zoom in, default 1.0
}

export interface Chart {
  id: string
  name: string
  schemaVersion: number
  gridRows: number
  gridCols: number
  layout: Layout
  displayMode: DisplayMode
  nameDisplayMode: NameDisplayMode
  title: string
  backgroundColor: string
  cellGap: number
  padding: number
  cornerRadius: number
  slots: Array<Slot | null>
}

export type CellDef =
  | { kind: 'slot'; slotIndex: number }
  | { kind: 'hero'; slotIndex: number; rowSpan: number; colSpan: number }
  | { kind: 'covered' }

export type CellMap = CellDef[]

export function getSlot(chart: Chart, slotIndex: number): Slot | null {
  return chart.slots[slotIndex] ?? null
}
