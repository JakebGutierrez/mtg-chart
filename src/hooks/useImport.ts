import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Chart, Slot } from '@/types/chart'
import { buildImportUrl, normaliseCard, type ScryfallCard } from '@/utils/scryfall'
import { parseDecklistText, type DecklistEntry } from '@/utils/decklistParser'
import { getEmptySlotIndices, getExpansionSlotIndices } from '@/utils/importLayout'

export interface FailedCard {
  name: string
  setCode?: string
  collectorNumber?: string
  reason: 'not-found' | 'rate-limited'
  slotIndex: number
}

export type ImportPhase =
  | { kind: 'idle' }
  | { kind: 'overflow'; totalCards: number; availableSlots: number; unreadableCount: number }
  | { kind: 'importing'; progress: number; total: number }
  // `total` is the number of cards the user intended to import in this run —
  // may exceed succeeded + failed.length if the 10-row cap silently cut some.
  // `unreadableCount` is the number of input lines that couldn't be read as a card.
  | { kind: 'done'; succeeded: number; failed: FailedCard[]; total: number; unreadableCount: number }

export interface UseImportReturn {
  phase: ImportPhase
  begin: (text: string, fillQuantity: boolean) => void
  proceedExpand: () => void
  proceedCap: () => void
  retry: () => void
  reset: () => void
}

interface Assignment {
  slotIndex: number
  entry: DecklistEntry
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normaliseName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (Séance → Seance)
    .toLowerCase()
    .trim()
}

async function fetchCardEntry(entry: DecklistEntry): Promise<Slot | 'not-found' | 'rate-limited'> {
  const url = buildImportUrl(entry.name, entry.setCode, entry.collectorNumber)
  let res: Response
  try {
    res = await fetch(url, { mode: 'cors' })
  } catch {
    return 'not-found'
  }

  if (res.status === 429) {
    await sleep(1500)
    try {
      res = await fetch(url, { mode: 'cors' })
    } catch {
      return 'not-found'
    }
    // Distinguish: a 404 on the retry means the card doesn't exist, not that we're still limited.
    if (!res.ok) return res.status === 429 ? 'rate-limited' : 'not-found'
  }

  if (!res.ok) return 'not-found'

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return 'not-found'
  }

  const slot = normaliseCard(json as ScryfallCard)
  if (!slot) return 'not-found'

  // When using the set+collector path (/cards/{set}/{num}), Scryfall returns
  // whatever card is at that position regardless of the provided name. Verify
  // the returned card name matches so a name typo fails visibly rather than
  // silently importing the wrong card.
  //
  // The comparison normalises diacritics (Séance → Seance) and accepts either:
  //   • the full canonical name  ("Fire // Ice" typed in full), or
  //   • any individual face name ("Fire", "Delver of Secrets") — both common in
  //     hand-typed decklists and exporter output for split / DFC cards.
  if (entry.setCode && entry.collectorNumber) {
    const input = normaliseName(entry.name)
    const faces = slot.cardName.split(' // ').map(normaliseName)
    const fullName = faces.join(' // ')
    if (input !== fullName && !faces.includes(input)) return 'not-found'
  }

  return slot
}

function expandEntries(entries: DecklistEntry[], fillQuantity: boolean): DecklistEntry[] {
  if (fillQuantity) {
    return entries.flatMap((e) => Array.from({ length: e.quantity }, () => ({ ...e, quantity: 1 })))
  }
  // One slot per unique card identity
  const seen = new Set<string>()
  const result: DecklistEntry[] = []
  for (const e of entries) {
    const key = `${e.name}|${e.setCode ?? ''}|${e.collectorNumber ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ ...e, quantity: 1 })
    }
  }
  return result
}

function makeAssignments(expanded: DecklistEntry[], slotIndices: number[]): Assignment[] {
  return expanded.slice(0, slotIndices.length).map((entry, i) => ({
    slotIndex: slotIndices[i],
    entry,
  }))
}

export function useImport(
  chart: Chart,
  onImportBegin: () => void,
  onSlotPlace: (slotIndex: number, slot: Slot) => void,
  onExpandGrid: (newRows: number) => void,
): UseImportReturn {
  const [phase, setPhase] = useState<ImportPhase>({ kind: 'idle' })

  // Generation counter: each run increments this and captures its own ID.
  // reset() and new runs increment it too, instantly invalidating any older loop
  // that wakes from a sleep or completes a fetch — no shared boolean flag.
  const runCountRef = useRef(0)

  const pendingRef = useRef<{ entries: DecklistEntry[]; fillQuantity: boolean } | null>(null)
  // Failed cards accumulate across retries. retry() keeps permanent (not-found) failures
  // and only re-queues rate-limited ones, so the done screen always shows the full tally.
  const failedRef = useRef<FailedCard[]>([])
  // Cumulative succeeded count across the initial run + any retries.
  const totalSucceededRef = useRef(0)
  // Total cards the user intended to import in this run. For proceedExpand this
  // equals expanded.length, which may exceed what actually fits when the 10-row
  // cap is hit — surfacing that gap to the done-screen denominator.
  const totalRef = useRef(0)
  // Lines that couldn't be read as a card in the most recent parse, carried to
  // the overflow/done screens.
  const unreadableRef = useRef(0)

  // Callback refs kept fresh via useLayoutEffect (same pattern as App.tsx undoRedoRef).
  const onImportBeginRef = useRef(onImportBegin)
  const onSlotPlaceRef = useRef(onSlotPlace)
  const onExpandGridRef = useRef(onExpandGrid)
  const chartRef = useRef(chart)
  useLayoutEffect(() => {
    onImportBeginRef.current = onImportBegin
    onSlotPlaceRef.current = onSlotPlace
    onExpandGridRef.current = onExpandGrid
    chartRef.current = chart
  })

  // Stable loop — only reads refs and calls setPhase (stable from useState).
  // Cancellation is per-run: each invocation captures its own runId and bails
  // if runCountRef has moved on (reset or a newer run started).
  const runLoop = useCallback(
    async (assignments: Assignment[]) => {
      const runId = ++runCountRef.current
      const newFailed: FailedCard[] = []
      let succeeded = 0
      const cache = new Map<string, Slot | 'not-found' | 'rate-limited'>()
      let fetchCount = 0

      for (let i = 0; i < assignments.length; i++) {
        if (runCountRef.current !== runId) return

        const { slotIndex, entry } = assignments[i]
        const cacheKey = `${entry.name}|${entry.setCode ?? ''}|${entry.collectorNumber ?? ''}`

        if (!cache.has(cacheKey)) {
          if (fetchCount > 0) await sleep(100)
          if (runCountRef.current !== runId) return
          fetchCount++
          cache.set(cacheKey, await fetchCardEntry(entry))
        }

        if (runCountRef.current !== runId) return

        const result = cache.get(cacheKey)!
        if (result === 'not-found' || result === 'rate-limited') {
          newFailed.push({
            name: entry.name,
            setCode: entry.setCode,
            collectorNumber: entry.collectorNumber,
            reason: result,
            slotIndex,
          })
        } else {
          onSlotPlaceRef.current(slotIndex, result)
          succeeded++
        }

        setPhase({ kind: 'importing', progress: i + 1, total: assignments.length })
      }

      if (runCountRef.current !== runId) return

      // Merge with any permanent failures carried forward from a prior retry run.
      const allFailed = [...failedRef.current, ...newFailed]
      totalSucceededRef.current += succeeded
      failedRef.current = allFailed
      setPhase({
        kind: 'done',
        succeeded: totalSucceededRef.current,
        failed: allFailed,
        total: totalRef.current,
        unreadableCount: unreadableRef.current,
      })
    },
    [],
  )

  const begin = useCallback(
    (text: string, fillQuantity: boolean) => {
      const { entries, unreadableCount } = parseDecklistText(text)
      unreadableRef.current = unreadableCount
      if (entries.length === 0) {
        // Nothing importable, but still tell the user if real-looking lines were
        // unreadable rather than closing silently.
        if (unreadableCount > 0) {
          setPhase({ kind: 'done', succeeded: 0, failed: [], total: 0, unreadableCount })
        }
        return
      }

      const expanded = expandEntries(entries, fillQuantity)
      const totalCards = expanded.length
      const emptySlots = getEmptySlotIndices(chartRef.current)

      pendingRef.current = { entries, fillQuantity }

      if (totalCards > emptySlots.length) {
        setPhase({ kind: 'overflow', totalCards, availableSlots: emptySlots.length, unreadableCount })
        return
      }

      failedRef.current = []
      totalSucceededRef.current = 0
      onImportBeginRef.current()
      const assignments = makeAssignments(expanded, emptySlots)
      totalRef.current = assignments.length
      setPhase({ kind: 'importing', progress: 0, total: assignments.length })
      void runLoop(assignments)
    },
    [runLoop],
  )

  const proceedExpand = useCallback(() => {
    if (!pendingRef.current) return
    const { entries, fillQuantity } = pendingRef.current
    const expanded = expandEntries(entries, fillQuantity)
    const emptySlots = getEmptySlotIndices(chartRef.current)

    const needed = expanded.length - emptySlots.length
    // Clamp to zero: if needed ≤ 0 (slots freed since overflow was shown), no expansion needed.
    const extraRows = Math.max(0, Math.ceil(needed / chartRef.current.gridCols))
    const newRows = Math.min(chartRef.current.gridRows + extraRows, 10)

    // Indices of the newly added cells, derived from the cellMap so hybrid
    // (commander/partner) layouts place cards in real cells instead of skipping/
    // overshooting (B9).
    const addedSlots = getExpansionSlotIndices(chartRef.current, newRows)
    const allSlots = [...emptySlots, ...addedSlots]

    failedRef.current = []
    totalSucceededRef.current = 0
    // totalRef tracks expanded.length (what the user wanted), not allSlots.length.
    // If the 10-row cap prevents full expansion, the gap shows in the done-screen
    // denominator (e.g. "Imported 12 / 15 cards") instead of being hidden.
    totalRef.current = expanded.length
    onImportBeginRef.current()
    if (newRows > chartRef.current.gridRows) onExpandGridRef.current(newRows)
    const assignments = makeAssignments(expanded, allSlots)
    setPhase({ kind: 'importing', progress: 0, total: assignments.length })
    void runLoop(assignments)
  }, [runLoop])

  const proceedCap = useCallback(() => {
    if (!pendingRef.current) return
    const { entries, fillQuantity } = pendingRef.current
    const expanded = expandEntries(entries, fillQuantity)
    const emptySlots = getEmptySlotIndices(chartRef.current)

    failedRef.current = []
    totalSucceededRef.current = 0
    onImportBeginRef.current()
    const assignments = makeAssignments(expanded, emptySlots)
    totalRef.current = assignments.length
    setPhase({ kind: 'importing', progress: 0, total: assignments.length })
    void runLoop(assignments)
  }, [runLoop])

  const retry = useCallback(() => {
    // Only retry rate-limited cards — not-found cards are kept in the failed list
    // as permanent failures so the done-screen denominator stays correct.
    const permanent = failedRef.current.filter((f) => f.reason === 'not-found')
    const toRetry = failedRef.current.filter((f) => f.reason === 'rate-limited')
    if (toRetry.length === 0) return

    const retryAssignments: Assignment[] = toRetry.map((f) => ({
      slotIndex: f.slotIndex,
      entry: { quantity: 1, name: f.name, setCode: f.setCode, collectorNumber: f.collectorNumber },
    }))

    // Seed failedRef with permanent failures; runLoop will merge its new failures on top.
    failedRef.current = permanent
    setPhase({ kind: 'importing', progress: 0, total: retryAssignments.length })
    void runLoop(retryAssignments)
  }, [runLoop])

  const reset = useCallback(() => {
    runCountRef.current++ // invalidates any in-flight loop
    pendingRef.current = null
    failedRef.current = []
    totalSucceededRef.current = 0
    totalRef.current = 0
    unreadableRef.current = 0
    setPhase({ kind: 'idle' })
  }, [])

  return { phase, begin, proceedExpand, proceedCap, retry, reset }
}
