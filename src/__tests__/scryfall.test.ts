import { describe, it, expect } from 'vitest'
import { buildSearchUrl, buildPrintingsUrl, normaliseCard, isMultiFaceLayout } from '@/utils/scryfall'

describe('buildSearchUrl', () => {
  it('includes the query in the URL', () => {
    const url = buildSearchUrl('lightning bolt')
    expect(url).toContain('lightning%20bolt')
  })

  it('includes the expected filter params', () => {
    const url = buildSearchUrl('snapcaster mage')
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('lang:en')
    expect(decoded).toContain('-is:digital')
    expect(decoded).toContain('-t:token')
    expect(decoded).toContain('-t:emblem')
  })

  it('points to the scryfall cards/search endpoint', () => {
    const url = buildSearchUrl('test')
    expect(url).toMatch(/^https:\/\/api\.scryfall\.com\/cards\/search\?/)
  })
})

describe('buildPrintingsUrl', () => {
  it('includes the oracle ID in the URL', () => {
    const url = buildPrintingsUrl('abc-123')
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('oracleId:abc-123')
  })

  it('includes unique=prints', () => {
    const url = buildPrintingsUrl('abc-123')
    expect(url).toContain('unique=prints')
  })
})

describe('normaliseCard', () => {
  it('returns null for a single-face card missing art_crop', () => {
    const card = {
      id: 'id-1',
      oracle_id: 'oracle-1',
      name: 'Test Card',
      set: 'tst',
      set_name: 'Test Set',
      released_at: '2020-01-01',
      collector_number: '1',
      layout: 'normal',
      image_uris: { normal: 'https://example.com/normal.jpg' },
    }
    expect(normaliseCard(card)).toBeNull()
  })

  it('returns a valid Slot for a well-formed single-face card', () => {
    const card = {
      id: 'id-1',
      oracle_id: 'oracle-1',
      name: 'Lightning Bolt',
      set: 'lea',
      set_name: 'Limited Edition Alpha',
      released_at: '1993-08-05',
      collector_number: '161',
      layout: 'normal',
      image_uris: {
        art_crop: 'https://example.com/art.jpg',
        normal: 'https://example.com/normal.jpg',
      },
    }
    const slot = normaliseCard(card)
    expect(slot).not.toBeNull()
    expect(slot?.kind).toBe('scryfall')
    expect(slot?.scryfallId).toBe('id-1')
    expect(slot?.cardName).toBe('Lightning Bolt')
    expect(slot?.imageUris).toHaveLength(1)
    expect(slot?.imageUris[0].artCrop).toBe('https://example.com/art.jpg')
  })

  it('returns a valid Slot with two imageUris entries for a DFC card', () => {
    const card = {
      id: 'dfc-1',
      oracle_id: 'oracle-dfc',
      name: 'Delver of Secrets // Insectile Aberration',
      set: 'isd',
      set_name: 'Innistrad',
      released_at: '2011-09-30',
      collector_number: '51',
      layout: 'transform',
      card_faces: [
        {
          image_uris: {
            art_crop: 'https://example.com/front-art.jpg',
            normal: 'https://example.com/front.jpg',
          },
        },
        {
          image_uris: {
            art_crop: 'https://example.com/back-art.jpg',
            normal: 'https://example.com/back.jpg',
          },
        },
      ],
    }
    const slot = normaliseCard(card)
    expect(slot).not.toBeNull()
    expect(slot?.imageUris).toHaveLength(2)
    expect(slot?.imageUris[0].artCrop).toBe('https://example.com/front-art.jpg')
    expect(slot?.imageUris[1].artCrop).toBe('https://example.com/back-art.jpg')
  })
})

describe('isMultiFaceLayout', () => {
  it('returns true for transform', () => {
    expect(isMultiFaceLayout('transform')).toBe(true)
  })

  it('returns true for modal_dfc', () => {
    expect(isMultiFaceLayout('modal_dfc')).toBe(true)
  })

  it('returns false for normal', () => {
    expect(isMultiFaceLayout('normal')).toBe(false)
  })
})
