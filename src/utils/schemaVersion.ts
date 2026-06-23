import type { Chart } from '@/types/chart'

const CURRENT_SCHEMA_VERSION = 1

function migrate(chart: Chart): Chart {
  if (chart.schemaVersion > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[mtg-chart] Unknown schema version ${chart.schemaVersion} (current: ${CURRENT_SCHEMA_VERSION}); loading as-is`,
    )
    return chart
  }
  // v1 → v2 migrations go here when CURRENT_SCHEMA_VERSION is bumped
  return { ...chart, schemaVersion: CURRENT_SCHEMA_VERSION }
}

export function migrateAll(charts: Chart[]): Chart[] {
  return charts.map(migrate)
}
