import type { Chart } from '@/types/chart'
import { migrateAll } from '@/utils/schemaVersion'

export function encodeChart(chart: Chart): string {
  return btoa(encodeURIComponent(JSON.stringify(chart)))
}

function isChartShaped(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.gridRows === 'number' &&
    typeof c.gridCols === 'number' &&
    Array.isArray(c.slots)
  )
}

export function decodeChart(raw: string): Chart | null {
  try {
    const json = decodeURIComponent(atob(raw))
    const parsed: unknown = JSON.parse(json)
    if (!isChartShaped(parsed)) return null
    return migrateAll([parsed as Chart])[0]
  } catch {
    return null
  }
}
