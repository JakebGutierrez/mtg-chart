import type { Slot } from '@/types/chart'

const API_BASE = 'https://api.scryfall.com'

export function buildSearchUrl(query: string): string {
  const q = `${query} lang:en -is:digital -t:token -t:emblem`
  return `${API_BASE}/cards/search?q=${encodeURIComponent(q)}`
}

interface ScryfallImageUris {
  // Both fields may be absent on some unusual printings; guarded at runtime
  art_crop?: string
  normal?: string
}

interface ScryfallCardFace {
  image_uris?: ScryfallImageUris
}

interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  set: string
  collector_number: string
  layout: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
}

export interface ScryfallSearchResponse {
  data: ScryfallCard[]
  has_more: boolean
  total_cards: number
}

export function normaliseCard(card: ScryfallCard): Slot | null {
  if (card.card_faces) {
    const facesWithImages = card.card_faces.filter((f) => f.image_uris !== undefined)

    if (facesWithImages.length > 0) {
      // Preserve 1:1 face indexing: selectedFaceIndex must map to imageUris[selectedFaceIndex].
      // If any face in the array lacks image_uris, the index alignment breaks, so reject the card.
      if (facesWithImages.length !== card.card_faces.length) return null
      if (facesWithImages.some((f) => !f.image_uris?.art_crop)) return null
      return {
        kind: 'scryfall',
        scryfallId: card.id,
        oracleId: card.oracle_id,
        cardName: card.name,
        setCode: card.set,
        collectorNumber: card.collector_number,
        layout: card.layout,
        selectedFaceIndex: 0,
        imageUris: card.card_faces.map((f) => ({
          artCrop: f.image_uris!.art_crop!,
          normal: f.image_uris!.normal,
        })),
      }
    }
    // card_faces present but no per-face image_uris (adventure, split, etc.) — fall through
    // to the single-face path where the renderable image lives on the parent card object
  }

  // Single-face card (or adventure/split fall-through)
  if (!card.image_uris?.art_crop) return null
  return {
    kind: 'scryfall',
    scryfallId: card.id,
    oracleId: card.oracle_id,
    cardName: card.name,
    setCode: card.set,
    collectorNumber: card.collector_number,
    layout: card.layout,
    selectedFaceIndex: 0,
    imageUris: [{ artCrop: card.image_uris.art_crop, normal: card.image_uris.normal }],
  }
}

export function normaliseResults(response: ScryfallSearchResponse): Slot[] {
  return response.data.flatMap((card) => {
    const slot = normaliseCard(card)
    return slot ? [slot] : []
  })
}
