import { describe, it, expect } from 'vitest'
import { parseDecklistText } from '@/utils/decklistParser'

describe('parseDecklistText (B6)', () => {
  it('parses a bare card name as quantity 1', () => {
    const { entries, unreadableCount } = parseDecklistText('Lightning Bolt')
    expect(entries).toEqual([{ quantity: 1, name: 'Lightning Bolt', setCode: undefined, collectorNumber: undefined }])
    expect(unreadableCount).toBe(0)
  })

  it('treats a one-name-per-line list as one-of-each', () => {
    const { entries } = parseDecklistText('Lightning Bolt\nCounterspell\nBlack Lotus')
    expect(entries.map((e) => e.quantity)).toEqual([1, 1, 1])
    expect(entries.map((e) => e.name)).toEqual(['Lightning Bolt', 'Counterspell', 'Black Lotus'])
  })

  it('accepts explicit quantities: "3", "3x", and "3X"', () => {
    expect(parseDecklistText('3 Lightning Bolt').entries[0]).toMatchObject({ quantity: 3, name: 'Lightning Bolt' })
    expect(parseDecklistText('3x Lightning Bolt').entries[0]).toMatchObject({ quantity: 3, name: 'Lightning Bolt' })
    expect(parseDecklistText('3X Lightning Bolt').entries[0]).toMatchObject({ quantity: 3, name: 'Lightning Bolt' })
  })

  it('reads "1996 World Champion" as a card at quantity 1, not 1996 copies', () => {
    const { entries } = parseDecklistText('1996 World Champion')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ quantity: 1, name: '1996 World Champion' })
  })

  it('reads "100 Forest" as a card named that at quantity 1 (intentional)', () => {
    const { entries } = parseDecklistText('100 Forest')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ quantity: 1, name: '100 Forest' })
  })

  it('clamps a parsed quantity of 0 up to 1', () => {
    expect(parseDecklistText('0 Forest').entries[0]).toMatchObject({ quantity: 1, name: 'Forest' })
  })

  it('still extracts set code and collector number', () => {
    const { entries } = parseDecklistText('Lightning Bolt (M20) 150')
    expect(entries[0]).toMatchObject({ quantity: 1, name: 'Lightning Bolt', setCode: 'M20', collectorNumber: '150' })
  })

  it('preserves explicit quantity together with set code', () => {
    expect(parseDecklistText('4 Counterspell (MMQ) 61').entries[0]).toMatchObject({
      quantity: 4,
      name: 'Counterspell',
      setCode: 'MMQ',
      collectorNumber: '61',
    })
  })

  it('counts junk lines as unreadable while still parsing real cards', () => {
    const { entries, unreadableCount } = parseDecklistText('Lightning Bolt\n----\n123\nCounterspell')
    expect(entries.map((e) => e.name)).toEqual(['Lightning Bolt', 'Counterspell'])
    expect(unreadableCount).toBe(2)
  })

  it('surfaces the unreadable count even when there are zero valid entries', () => {
    const { entries, unreadableCount } = parseDecklistText('----\n***\n123')
    expect(entries).toHaveLength(0)
    expect(unreadableCount).toBe(3)
  })

  it('skips blank lines, comments, and section headers without counting them', () => {
    const { entries, unreadableCount } = parseDecklistText(
      'Deck\n// my notes\n# another\n\n4 Lightning Bolt\nSideboard\n1 Negate',
    )
    expect(entries.map((e) => e.name)).toEqual(['Lightning Bolt', 'Negate'])
    expect(unreadableCount).toBe(0)
  })
})
