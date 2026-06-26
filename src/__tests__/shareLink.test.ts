import { describe, it, expect } from 'vitest'
import LZString from 'lz-string'
import {
  encodeShareLink,
  decodeSharePayload,
  reconstructSlots,
  type ShareSlotStub,
} from '@/utils/shareLink'
import type { Chart, ScryfallSlot } from '@/types/chart'

function makeChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 'test-id',
    name: 'Test Chart',
    schemaVersion: 4,
    gridRows: 2,
    gridCols: 2,
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

function makeScryfallSlot(overrides: Partial<ScryfallSlot> = {}): ScryfallSlot {
  return {
    kind: 'scryfall',
    scryfallId: 'abc-123',
    oracleId: 'oracle-1',
    cardName: 'Lightning Bolt',
    setCode: 'm20',
    collectorNumber: '150',
    layout: 'normal',
    selectedFaceIndex: 0,
    imageUris: [{ artCrop: 'https://cards.scryfall.io/art_crop/abc.jpg', normal: 'https://cards.scryfall.io/normal/abc.jpg' }],
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1.0,
    cmc: 1,
    colors: ['R'],
    typeLine: 'Instant',
    ...overrides,
  }
}

// ─── encodeShareLink / decodeSharePayload round-trip ─────────────────────────

describe('encodeShareLink + decodeSharePayload', () => {
  it('round-trips an empty chart', () => {
    const chart = makeChart()
    const { encoded, customSlotsOmitted } = encodeShareLink(chart)
    expect(customSlotsOmitted).toBe(0)

    const result = decodeSharePayload(encoded)
    expect(result.kind).toBe('compact')
    if (result.kind !== 'compact') return

    expect(result.payload.v).toBe(1)
    expect(result.payload.c.name).toBe(chart.name)
    expect(result.payload.c.gridRows).toBe(2)
    expect(result.payload.c.gridCols).toBe(2)
    expect(result.payload.s).toHaveLength(0)
  })

  it('round-trips a chart with scryfall slots', () => {
    const slot = makeScryfallSlot()
    const chart = makeChart({ slots: [slot, null, slot] })
    const { encoded, customSlotsOmitted } = encodeShareLink(chart)
    expect(customSlotsOmitted).toBe(0)

    const result = decodeSharePayload(encoded)
    expect(result.kind).toBe('compact')
    if (result.kind !== 'compact') return

    expect(result.payload.s).toHaveLength(3)
    expect(result.payload.s[0]).toMatchObject({ id: 'abc-123' })
    expect(result.payload.s[1]).toBeNull()
    expect(result.payload.s[2]).toMatchObject({ id: 'abc-123' })
  })

  it('omits default face/crop fields from stubs', () => {
    const slot = makeScryfallSlot({ selectedFaceIndex: 0, cropX: 0.5, cropY: 0.5, cropScale: 1.0 })
    const chart = makeChart({ slots: [slot] })
    const { encoded } = encodeShareLink(chart)

    const result = decodeSharePayload(encoded)
    expect(result.kind).toBe('compact')
    if (result.kind !== 'compact') return

    const stub = result.payload.s[0]
    expect(stub).not.toBeNull()
    if (stub === null) return
    expect(stub.f).toBeUndefined()
    expect(stub.x).toBeUndefined()
    expect(stub.y).toBeUndefined()
    expect(stub.z).toBeUndefined()
  })

  it('preserves non-default face and crop fields', () => {
    const slot = makeScryfallSlot({ selectedFaceIndex: 1, cropX: 0.3, cropY: 0.7, cropScale: 1.5 })
    const chart = makeChart({ slots: [slot] })
    const { encoded } = encodeShareLink(chart)

    const result = decodeSharePayload(encoded)
    expect(result.kind).toBe('compact')
    if (result.kind !== 'compact') return

    const stub = result.payload.s[0] as ShareSlotStub
    expect(stub.f).toBe(1)
    expect(stub.x).toBeCloseTo(0.3)
    expect(stub.y).toBeCloseTo(0.7)
    expect(stub.z).toBeCloseTo(1.5)
  })

  it('replaces custom slots with null and counts them', () => {
    const custom = {
      kind: 'custom' as const,
      label: 'My Art',
      localImageDataUrl: 'data:image/png;base64,abc',
      cropX: 0.5,
      cropY: 0.5,
      cropScale: 1.0,
    }
    const scryfall = makeScryfallSlot()
    const chart = makeChart({ slots: [custom, scryfall, custom] })
    const { encoded, customSlotsOmitted } = encodeShareLink(chart)
    expect(customSlotsOmitted).toBe(2)

    const result = decodeSharePayload(encoded)
    expect(result.kind).toBe('compact')
    if (result.kind !== 'compact') return

    expect(result.payload.s[0]).toBeNull()
    expect(result.payload.s[1]).toMatchObject({ id: 'abc-123' })
    expect(result.payload.s[2]).toBeNull()
  })
})

// ─── Legacy compatibility ─────────────────────────────────────────────────────

describe('decodeSharePayload — legacy fallback', () => {
  it('decodes a Phase-16 base64+JSON link as legacy', () => {
    const chart = makeChart({ slots: [makeScryfallSlot()] })
    const raw = btoa(encodeURIComponent(JSON.stringify(chart)))

    const result = decodeSharePayload(raw)
    expect(result.kind).toBe('legacy')
    if (result.kind !== 'legacy') return

    expect(result.chart.name).toBe(chart.name)
    expect(result.chart.slots).toHaveLength(1)
  })

  it('returns an error for a completely invalid string', () => {
    const result = decodeSharePayload('!!!not-valid-at-all!!!')
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.message).toMatch(/invalid|expired/i)
  })
})

// ─── Unknown version ──────────────────────────────────────────────────────────

describe('decodeSharePayload — unknown version', () => {
  it('returns an error when v is an unrecognised number', () => {
    const payload = JSON.stringify({ v: 99, c: {}, s: [] })
    const encoded = LZString.compressToEncodedURIComponent(payload)

    const result = decodeSharePayload(encoded)
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.message).toMatch(/not supported/i)
  })
})

// ─── reconstructSlots ─────────────────────────────────────────────────────────

describe('reconstructSlots', () => {
  const boltSlot = makeScryfallSlot({ scryfallId: 'bolt-id', cardName: 'Lightning Bolt' })
  const walkSlot = makeScryfallSlot({ scryfallId: 'walk-id', cardName: 'Ancestral Recall' })

  const cardMap = new Map<string, ScryfallSlot>([
    ['bolt-id', boltSlot],
    ['walk-id', walkSlot],
  ])

  it('maps stubs to slots in order', () => {
    const stubs: Array<ShareSlotStub | null> = [
      { id: 'bolt-id' },
      null,
      { id: 'walk-id' },
    ]
    const slots = reconstructSlots(stubs, cardMap)
    expect(slots).toHaveLength(3)
    expect((slots[0] as ScryfallSlot).cardName).toBe('Lightning Bolt')
    expect(slots[1]).toBeNull()
    expect((slots[2] as ScryfallSlot).cardName).toBe('Ancestral Recall')
  })

  it('returns null for stubs whose id is not in cardMap', () => {
    const stubs: Array<ShareSlotStub | null> = [{ id: 'missing-id' }]
    const slots = reconstructSlots(stubs, cardMap)
    expect(slots[0]).toBeNull()
  })

  it('applies default crop values when stub fields are absent', () => {
    const stubs: Array<ShareSlotStub | null> = [{ id: 'bolt-id' }]
    const slots = reconstructSlots(stubs, cardMap)
    const slot = slots[0] as ScryfallSlot
    expect(slot.selectedFaceIndex).toBe(0)
    expect(slot.cropX).toBeCloseTo(0.5)
    expect(slot.cropY).toBeCloseTo(0.5)
    expect(slot.cropScale).toBeCloseTo(1.0)
  })

  it('applies non-default stub overrides', () => {
    const stubs: Array<ShareSlotStub | null> = [{ id: 'bolt-id', f: 1, x: 0.2, y: 0.8, z: 2.0 }]
    const slots = reconstructSlots(stubs, cardMap)
    const slot = slots[0] as ScryfallSlot
    expect(slot.selectedFaceIndex).toBe(1)
    expect(slot.cropX).toBeCloseTo(0.2)
    expect(slot.cropY).toBeCloseTo(0.8)
    expect(slot.cropScale).toBeCloseTo(2.0)
  })
})
