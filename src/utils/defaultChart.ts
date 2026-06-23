import type { Chart } from '@/types/chart'

export function createDefaultChart(): Chart {
  return {
    id: crypto.randomUUID(),
    name: 'My Chart',
    schemaVersion: 2,
    gridRows: 5,
    gridCols: 5,
    layout: 'uniform',
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
