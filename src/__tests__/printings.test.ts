import { describe, it, expect, vi } from 'vitest'
import { fetchAllPrintings, PrintingsRateLimitError, type ScryfallCard } from '@/utils/scryfall'

function printingCard(id: string): ScryfallCard {
  return {
    id,
    oracle_id: 'o',
    name: 'Sol Ring',
    set: 'cmd',
    set_name: 'Commander',
    released_at: '2011-06-17',
    collector_number: '1',
    layout: 'normal',
    image_uris: { art_crop: `https://x/${id}.jpg`, normal: `https://x/n.jpg` },
  }
}

function jsonResp(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function statusResp(status: number): Response {
  return { ok: status < 400, status, json: async () => ({}) } as unknown as Response
}

const asFetch = (fn: ReturnType<typeof vi.fn>): typeof globalThis.fetch =>
  fn as unknown as typeof globalThis.fetch

const noSleep = async () => {}

describe('fetchAllPrintings (A3)', () => {
  it('follows next_page and concatenates all printings', async () => {
    let call = 0
    const fetch = vi.fn(async () => {
      call++
      return call === 1
        ? jsonResp({ data: [printingCard('a')], has_more: true, next_page: 'https://x/page2', total_cards: 2 })
        : jsonResp({ data: [printingCard('b')], has_more: false, total_cards: 2 })
    })
    const { printings, truncated } = await fetchAllPrintings('o', { fetch: asFetch(fetch), sleep: noSleep })
    expect(printings).toHaveLength(2)
    expect(truncated).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('stops at maxPages and reports truncated when more remain', async () => {
    const fetch = vi.fn(async () =>
      jsonResp({ data: [printingCard('x')], has_more: true, next_page: 'https://x/next', total_cards: 999 }),
    )
    const { printings, truncated } = await fetchAllPrintings('o', {
      fetch: asFetch(fetch),
      sleep: noSleep,
      maxPages: 3,
    })
    expect(truncated).toBe(true)
    expect(printings).toHaveLength(3)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('throws PrintingsRateLimitError on 429', async () => {
    const fetch = vi.fn(async () => statusResp(429))
    await expect(
      fetchAllPrintings('o', { fetch: asFetch(fetch), sleep: noSleep }),
    ).rejects.toBeInstanceOf(PrintingsRateLimitError)
  })

  it('throws on a non-ok, non-429 status', async () => {
    const fetch = vi.fn(async () => statusResp(500))
    await expect(
      fetchAllPrintings('o', { fetch: asFetch(fetch), sleep: noSleep }),
    ).rejects.toThrow(/500/)
  })
})
