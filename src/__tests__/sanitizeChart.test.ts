import { describe, it, expect } from 'vitest'
import {
  clampGridDim,
  isSafeColor,
  sanitizeBackgroundColor,
  sanitizeHeroConfig,
  chartCapacity,
  sanitizeChartConfig,
} from '@/utils/sanitizeChart'
import { isChartShaped } from '@/utils/chartShape'
import type { Chart } from '@/types/chart'

function makeChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 'c1',
    name: 'Chart',
    schemaVersion: 4,
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
    ...overrides,
  }
}

function scryfallSlot() {
  return {
    kind: 'scryfall' as const,
    scryfallId: 'abc',
    oracleId: 'o',
    cardName: 'Lightning Bolt',
    setCode: 'm20',
    collectorNumber: '150',
    layout: 'normal',
    selectedFaceIndex: 0 as const,
    imageUris: [{ artCrop: 'https://x/a.jpg', normal: 'https://x/n.jpg' }],
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1.0,
    cmc: 1,
    colors: ['R'],
    typeLine: 'Instant',
  }
}

// ─── clampGridDim (A2) ───────────────────────────────────────────────────────────

describe('clampGridDim', () => {
  it('clamps an oversized value down to 10', () => {
    expect(clampGridDim(9999)).toBe(10)
  })
  it('floors a decimal', () => {
    expect(clampGridDim(3.7)).toBe(3)
  })
  it('maps non-finite values to the minimum', () => {
    expect(clampGridDim(NaN)).toBe(1)
    expect(clampGridDim(Infinity)).toBe(1)
    expect(clampGridDim(-Infinity)).toBe(1)
  })
  it('clamps values below 1 up to 1', () => {
    expect(clampGridDim(0)).toBe(1)
    expect(clampGridDim(-5)).toBe(1)
    expect(clampGridDim(0.4)).toBe(1)
  })
  it('passes a normal value through', () => {
    expect(clampGridDim(5)).toBe(5)
  })
})

// ─── background colour (B7) ──────────────────────────────────────────────────────

describe('isSafeColor / sanitizeBackgroundColor', () => {
  it('accepts hex and rgb/rgba', () => {
    expect(isSafeColor('#abc')).toBe(true)
    expect(isSafeColor('#0b0c0e')).toBe(true)
    expect(isSafeColor('#0b0c0eff')).toBe(true)
    expect(isSafeColor('rgb(0,0,0)')).toBe(true)
    expect(isSafeColor('rgba(0, 0, 0, 0.5)')).toBe(true)
  })
  it('rejects url(), expression(), and junk', () => {
    expect(isSafeColor('url(https://attacker/x.png)')).toBe(false)
    expect(isSafeColor('expression(alert(1))')).toBe(false)
    expect(isSafeColor('red; background: url(x)')).toBe(false)
    expect(isSafeColor('javascript:1')).toBe(false)
    expect(isSafeColor(42)).toBe(false)
  })
  it('replaces an unsafe colour with the default', () => {
    expect(sanitizeBackgroundColor('url(https://attacker/x.png)')).toBe('#0b0c0e')
    expect(sanitizeBackgroundColor('#123456')).toBe('#123456')
  })
})

// ─── heroConfig (folded-in hardening) ────────────────────────────────────────────

describe('sanitizeHeroConfig', () => {
  it('keeps a valid commander hero', () => {
    const hero = [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }]
    expect(sanitizeHeroConfig(hero, 5, 5)).toEqual(hero)
  })
  it('drops a hero with an absurd span before it can blow up generateCellMap', () => {
    expect(sanitizeHeroConfig([{ row: 0, col: 0, rowSpan: 1e9, colSpan: 1e9 }], 5, 5)).toEqual([])
  })
  it('drops out-of-bounds, negative, non-integer, and zero-span heroes', () => {
    expect(sanitizeHeroConfig([{ row: 4, col: 4, rowSpan: 3, colSpan: 3 }], 5, 5)).toEqual([])
    expect(sanitizeHeroConfig([{ row: -1, col: 0, rowSpan: 2, colSpan: 2 }], 5, 5)).toEqual([])
    expect(sanitizeHeroConfig([{ row: 0, col: 0, rowSpan: 0, colSpan: 2 }], 5, 5)).toEqual([])
    expect(sanitizeHeroConfig([{ row: 0.5, col: 0, rowSpan: 2, colSpan: 2 }], 5, 5)).toEqual([])
    expect(sanitizeHeroConfig('not an array', 5, 5)).toEqual([])
  })
})

// ─── chartCapacity + sanitizeChartConfig (array bounds) ──────────────────────────

describe('chartCapacity', () => {
  it('counts non-covered cells (uniform vs commander)', () => {
    expect(chartCapacity(5, 5, [])).toBe(25)
    expect(chartCapacity(5, 5, [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])).toBe(22)
  })
})

describe('sanitizeChartConfig', () => {
  it('clamps dims, sanitizes hero + bg, and caps slots to capacity', () => {
    const dirty = makeChart({
      gridRows: 9999,
      gridCols: 2,
      heroConfig: [{ row: 0, col: 0, rowSpan: 1e9, colSpan: 1e9 }],
      backgroundColor: 'url(https://attacker/x.png)',
      slots: Array.from({ length: 50 }, () => null),
    })
    const clean = sanitizeChartConfig(dirty)
    expect(clean.gridRows).toBe(10)
    expect(clean.gridCols).toBe(2)
    expect(clean.heroConfig).toEqual([])
    expect(clean.backgroundColor).toBe('#0b0c0e')
    // 10x2 uniform = 20 cells; the 50-slot array is capped to 20.
    expect(clean.slots).toHaveLength(20)
  })

  it('leaves a clean chart unchanged in shape', () => {
    const clean = sanitizeChartConfig(makeChart())
    expect(clean.gridRows).toBe(5)
    expect(clean.backgroundColor).toBe('#0b0c0e')
    expect(clean.heroConfig).toEqual([])
  })
})

// ─── isChartShaped strengthening (B8) ────────────────────────────────────────────

describe('isChartShaped — strengthened slot validation', () => {
  // Malformed slots are built as loose object literals (isChartShaped takes
  // unknown) so TypeScript doesn't reject the intentionally-invalid shapes.
  it('accepts a chart with a well-formed scryfall slot', () => {
    expect(isChartShaped({ ...makeChart(), slots: [scryfallSlot()] })).toBe(true)
  })
  it('rejects a scryfall slot with empty imageUris', () => {
    expect(isChartShaped({ ...makeChart(), slots: [{ ...scryfallSlot(), imageUris: [] }] })).toBe(false)
  })
  it('rejects a scryfall slot whose face lacks a string artCrop', () => {
    expect(isChartShaped({ ...makeChart(), slots: [{ ...scryfallSlot(), imageUris: [{ normal: 'x' }] }] })).toBe(false)
  })
  it('rejects a scryfall slot whose selectedFaceIndex is out of bounds', () => {
    expect(isChartShaped({ ...makeChart(), slots: [{ ...scryfallSlot(), selectedFaceIndex: 1 }] })).toBe(false)
  })
})
