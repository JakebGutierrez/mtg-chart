import type { ScryfallSlot } from '@/types/chart'
import type { ShareSlotStub } from '@/utils/shareLink'
import { normaliseCard, type ScryfallCard } from '@/utils/scryfall'

// Thrown when reconstruction fails in a way the user can usefully retry
// (rate-limited, network blip, transient HTTP error). The caller surfaces a
// Retry affordance rather than treating it as fatal.
export class RetryableReconstructionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryableReconstructionError'
  }
}

interface CollectionResponse {
  data: ScryfallCard[]
  not_found: unknown[]
}

export interface FetchCollectionResult {
  cardMap: Map<string, ScryfallSlot>
  notFoundCount: number
  normaliseFailCount: number
}

export interface FetchCollectionDeps {
  fetch: typeof globalThis.fetch
  sleep: (ms: number) => Promise<void>
  signal?: AbortSignal
}

const CHUNK_SIZE = 75
const INTER_CHUNK_DELAY_MS = 100
const RATE_LIMIT_BACKOFF_MS = 1500
const MAX_RATE_LIMIT_RETRIES = 3

const COLLECTION_URL = 'https://api.scryfall.com/cards/collection'

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  return null
}

async function fetchChunkWithRetry(
  chunk: ShareSlotStub[],
  deps: FetchCollectionDeps,
): Promise<CollectionResponse> {
  const { fetch, sleep, signal } = deps
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(COLLECTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map((s) => ({ id: s.id })) }),
      signal,
    })
    // 429 is retryable: honour Retry-After, back off, and retry a bounded number
    // of times before giving up with a retryable error.
    if (res.status === 429) {
      if (attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw new RetryableReconstructionError('Scryfall is rate-limiting requests.')
      }
      await sleep(parseRetryAfter(res.headers.get('Retry-After')) ?? RATE_LIMIT_BACKOFF_MS)
      continue
    }
    if (!res.ok) {
      throw new RetryableReconstructionError(`Scryfall collection returned ${res.status}.`)
    }
    return (await res.json()) as CollectionResponse
  }
}

// Fetches all stubs via the batch collection endpoint in 75-id chunks, with a
// small inter-chunk delay (polite to Scryfall) and 429 retry/backoff. Resolves
// with the card map plus counts of ids Scryfall didn't find or we couldn't
// normalise; throws RetryableReconstructionError on transient failure and
// rethrows AbortError on cancellation.
export async function fetchCollectionSlots(
  stubs: Array<ShareSlotStub | null>,
  deps: FetchCollectionDeps,
): Promise<FetchCollectionResult> {
  const { sleep } = deps
  const nonNull = stubs.filter((s): s is ShareSlotStub => s !== null)
  const cardMap = new Map<string, ScryfallSlot>()
  let notFoundCount = 0
  let normaliseFailCount = 0

  for (let i = 0; i < nonNull.length; i += CHUNK_SIZE) {
    if (i > 0) await sleep(INTER_CHUNK_DELAY_MS)
    const chunk = nonNull.slice(i, i + CHUNK_SIZE)
    const body = await fetchChunkWithRetry(chunk, deps)
    notFoundCount += body.not_found.length
    for (const card of body.data) {
      const slot = normaliseCard(card)
      if (!slot) {
        normaliseFailCount++
        continue
      }
      cardMap.set(card.id, slot)
    }
  }

  return { cardMap, notFoundCount, normaliseFailCount }
}
