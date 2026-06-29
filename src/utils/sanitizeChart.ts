import type { Chart, HeroConfig } from '@/types/chart'
import { generateCellMap } from '@/utils/cellMap'

const MIN_GRID = 1
const MAX_GRID = 10
const DEFAULT_BACKGROUND = '#0b0c0e'

// Coerce to a finite integer in [1,10]: non-finite (NaN/Infinity) or < 1 fall to
// the minimum, decimals floor, anything above 10 clamps down. Bounds the visual
// grid so a crafted/corrupt link can't request an enormous grid.
export function clampGridDim(v: unknown): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < MIN_GRID) return MIN_GRID
  return Math.min(n, MAX_GRID)
}

// Accept hex (#RGB / #RRGGBB / #RRGGBBAA) and rgb()/rgba() only. Rejects
// url(...), expression(...), and anything else that could fire a network
// request or otherwise misbehave when applied as `background: <value>`.
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_RE = /^rgba?\(\s*[0-9.\s,%/]+\)$/i

export function isSafeColor(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const v = value.trim()
  return HEX_RE.test(v) || RGB_RE.test(v)
}

export function sanitizeBackgroundColor(value: unknown): string {
  return isSafeColor(value) ? value.trim() : DEFAULT_BACKGROUND
}

// Keep only hero items with finite-integer geometry, non-negative origin,
// positive spans, and bounds entirely inside the grid. Drops crafted items
// (e.g. a 1e9 span) before they ever reach generateCellMap's nested loop, which
// would otherwise iterate rowSpan×colSpan times regardless of the grid size.
export function sanitizeHeroConfig(heroConfig: unknown, rows: number, cols: number): HeroConfig {
  if (!Array.isArray(heroConfig)) return []
  const clean: HeroConfig = []
  for (const item of heroConfig) {
    if (typeof item !== 'object' || item === null) continue
    const h = item as Record<string, unknown>
    const { row, col, rowSpan, colSpan } = h
    if (![row, col, rowSpan, colSpan].every((n) => typeof n === 'number' && Number.isInteger(n))) {
      continue
    }
    const r = row as number
    const c = col as number
    const rs = rowSpan as number
    const cs = colSpan as number
    if (r < 0 || c < 0 || rs < 1 || cs < 1) continue
    if (r + rs > rows || c + cs > cols) continue
    clean.push({ row: r, col: c, rowSpan: rs, colSpan: cs })
  }
  return clean
}

// Logical slot capacity = number of non-covered cells in the grid. Safe to call
// only after heroConfig has been sanitized.
export function chartCapacity(rows: number, cols: number, heroConfig: HeroConfig): number {
  return generateCellMap(rows, cols, heroConfig).filter((c) => c.kind !== 'covered').length
}

// Full sanitize for a decoded or stored chart: clamp dims, sanitize heroConfig
// and background, and cap the slots array to grid capacity (indices beyond
// capacity can never render and only inflate decode/reconstruction work).
export function sanitizeChartConfig(chart: Chart): Chart {
  const gridRows = clampGridDim(chart.gridRows)
  const gridCols = clampGridDim(chart.gridCols)
  const heroConfig = sanitizeHeroConfig(chart.heroConfig, gridRows, gridCols)
  const backgroundColor = sanitizeBackgroundColor(chart.backgroundColor)
  const capacity = chartCapacity(gridRows, gridCols, heroConfig)
  const slots =
    Array.isArray(chart.slots) && chart.slots.length > capacity
      ? chart.slots.slice(0, capacity)
      : chart.slots
  return { ...chart, gridRows, gridCols, heroConfig, backgroundColor, slots }
}
