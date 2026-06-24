import type { Chart } from '@/types/chart'
import { migrateAll } from '@/utils/schemaVersion'
import { isChartShaped } from '@/utils/chartShape'

export function encodeChart(chart: Chart): string {
  return btoa(encodeURIComponent(JSON.stringify(chart)))
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
