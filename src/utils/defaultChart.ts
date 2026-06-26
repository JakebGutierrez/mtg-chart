import type { Chart } from '@/types/chart'
import { CURRENT_SCHEMA_VERSION } from '@/utils/schemaVersion'

export function createDefaultChart(): Chart {
  return {
    id: crypto.randomUUID(),
    name: 'My Chart',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    gridRows: 5,
    gridCols: 5,
    layout: 'uniform',
    heroConfig: [],
    displayMode: 'landscape',
    nameDisplayMode: 'none',
    title: '',
    backgroundColor: '#0b0c0e',
    cellGap: 4,
    padding: 16,
    cornerRadius: 4,
    slots: [],
  }
}
