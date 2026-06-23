import type { Chart, Slot } from '@/types/chart'

const CURRENT_SCHEMA_VERSION = 2

function migrate(chart: Chart): Chart {
  if (chart.schemaVersion > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[mtg-chart] Unknown schema version ${chart.schemaVersion} (current: ${CURRENT_SCHEMA_VERSION}); loading as-is`,
    )
    return chart
  }

  let c = chart

  if (c.schemaVersion < 2) {
    c = {
      ...c,
      schemaVersion: 2,
      slots: c.slots.map((slot) => {
        if (!slot) return null
        // At runtime, v1 slots lack cropX/Y/cropScale. Cast to access as optional so
        // ?? can supply the default without TypeScript duplicate-key errors.
        const s = slot as Slot & { cropX?: number; cropY?: number; cropScale?: number }
        return { ...s, cropX: s.cropX ?? 0.5, cropY: s.cropY ?? 0.5, cropScale: s.cropScale ?? 1.0 }
      }),
    }
  }

  return c
}

export function migrateAll(charts: Chart[]): Chart[] {
  return charts.map(migrate)
}
