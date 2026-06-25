import type { ScryfallSlot } from '@/types/chart'

const API_BASE = 'https://api.scryfall.com'

const MULTI_FACE_LAYOUTS = new Set([
  'transform',
  'modal_dfc',
  'double_faced_token',
  'art_series',
  'reversible_card',
])

export function isMultiFaceLayout(layout: string): boolean {
  return MULTI_FACE_LAYOUTS.has(layout)
}

export function buildSearchUrl(query: string): string {
  const q = `${query} lang:en -is:digital -t:token -t:emblem`
  return `${API_BASE}/cards/search?q=${encodeURIComponent(q)}`
}

export function buildImportUrl(name: string, setCode?: string, collectorNumber?: string): string {
  if (setCode && collectorNumber) {
    return `${API_BASE}/cards/${setCode.toLowerCase()}/${collectorNumber}`
  }
  if (setCode) {
    return `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}&set=${setCode.toLowerCase()}`
  }
  return `${API_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`
}

export function buildPrintingsUrl(oracleId: string): string {
  const q = `oracleId:${oracleId} lang:en -is:digital`
  return `${API_BASE}/cards/search?q=${encodeURIComponent(q)}&unique=prints`
}

interface ScryfallImageUris {
  // Both fields may be absent on some unusual printings; guarded at runtime
  art_crop?: string
  normal?: string
}

interface ScryfallCardFace {
  image_uris?: ScryfallImageUris
  colors?: string[]
  type_line?: string
  artist?: string
}

export interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  set: string
  set_name: string
  released_at: string
  collector_number: string
  layout: string
  cmc?: number
  colors?: string[]
  type_line?: string
  artist?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
}

export interface ScryfallSearchResponse {
  data: ScryfallCard[]
  has_more: boolean
  total_cards: number
}

export interface PrintingMeta {
  slot: ScryfallSlot
  setName: string
  year: number
}

export function normaliseCard(card: ScryfallCard): ScryfallSlot | null {
  // Sort fields: cmc is always on the root; colors and type_line may be per-face on DFCs.
  const cmc: number | null = card.cmc ?? null
  const colors: string[] | null = card.colors ?? card.card_faces?.[0]?.colors ?? null
  const typeLine: string | null = card.type_line ?? card.card_faces?.[0]?.type_line ?? null

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
          artist: f.artist ?? card.artist,
        })),
        cropX: 0.5,
        cropY: 0.5,
        cropScale: 1.0,
        cmc,
        colors,
        typeLine,
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
    imageUris: [{ artCrop: card.image_uris.art_crop, normal: card.image_uris.normal, artist: card.artist }],
    cropX: 0.5,
    cropY: 0.5,
    cropScale: 1.0,
    cmc,
    colors,
    typeLine,
  }
}

export function normalisePrinting(card: ScryfallCard): PrintingMeta | null {
  const slot = normaliseCard(card)
  if (!slot) return null
  return {
    slot,
    setName: card.set_name,
    year: new Date(card.released_at).getFullYear(),
  }
}

export function normaliseResults(response: ScryfallSearchResponse): ScryfallSlot[] {
  return response.data.flatMap((card) => {
    const slot = normaliseCard(card)
    return slot ? [slot] : []
  })
}

export async function fetchCardById(scryfallId: string): Promise<ScryfallSlot | null> {
  const res = await fetch(`${API_BASE}/cards/${scryfallId}`, { mode: 'cors' })
  if (!res.ok) return null
  const card = (await res.json()) as ScryfallCard
  return normaliseCard(card)
}
