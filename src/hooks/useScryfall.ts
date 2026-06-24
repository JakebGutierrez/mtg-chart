import { useState, useEffect, useRef } from 'react'
import type { ScryfallSlot } from '@/types/chart'
import { buildSearchUrl, normaliseResults } from '@/utils/scryfall'
import type { ScryfallSearchResponse } from '@/utils/scryfall'

interface UseScryfallResult {
  results: ScryfallSlot[]
  isLoading: boolean
  error: string | null
}

export function useScryfall(query: string): UseScryfallResult {
  const [results, setResults] = useState<ScryfallSlot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  // Updated synchronously at effect start so timer callbacks can detect a superseded query
  // even during the debounce window (before activeQueryRef would have been updated inside
  // the old timer). This closes the race where a response from a debounced-but-pending
  // request resolves just before its AbortController signal propagates.
  const latestQueryRef = useRef<string>('')

  useEffect(() => {
    const trimmed = query.trim()
    latestQueryRef.current = trimmed
    abortRef.current?.abort()

    // All setState calls live inside the timer callback to satisfy react-hooks/set-state-in-effect
    const timer = setTimeout(
      async () => {
        // Guard: a newer query arrived during the debounce window
        if (latestQueryRef.current !== trimmed) return

        if (!trimmed) {
          setResults([])
          setIsLoading(false)
          setError(null)
          return
        }

        const controller = new AbortController()
        abortRef.current = controller

        setIsLoading(true)
        setError(null)

        try {
          const response = await fetch(buildSearchUrl(trimmed), {
            signal: controller.signal,
          })

          // Guard: a newer query arrived while this fetch was in-flight
          if (latestQueryRef.current !== trimmed) return

          if (response.status === 429) {
            setError('Too many requests — please wait.')
            setResults([])
            setIsLoading(false)
            return
          }

          if (response.status === 404) {
            setResults([])
            setIsLoading(false)
            return
          }

          if (!response.ok) {
            setError('Search failed — please try again.')
            setResults([])
            setIsLoading(false)
            return
          }

          const data: ScryfallSearchResponse = await response.json()

          if (latestQueryRef.current !== trimmed) return

          setResults(normaliseResults(data))
          setIsLoading(false)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError('Search failed — please try again.')
          setResults([])
          setIsLoading(false)
        }
      },
      trimmed ? 300 : 0,
    )

    return () => {
      clearTimeout(timer)
      latestQueryRef.current = '\0' // sentinel: no real query can match this, so in-flight setState is suppressed
      abortRef.current?.abort()
    }
  }, [query])

  return { results, isLoading, error }
}
