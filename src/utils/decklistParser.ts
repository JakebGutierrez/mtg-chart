export interface DecklistEntry {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
}

export interface ParseResult {
  entries: DecklistEntry[]
  // Count of non-empty, non-comment lines we couldn't read as a card (no name).
  // Surfaced to the user instead of silently dropping a real card.
  unreadableCount: number
}

const SECTION_HEADERS = new Set([
  'deck',
  'sideboard',
  'commander',
  'companion',
  'maybeboard',
])

export function parseDecklistText(text: string): ParseResult {
  const entries: DecklistEntry[] = []
  let unreadableCount = 0

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('//') || line.startsWith('#')) continue
    if (SECTION_HEADERS.has(line.toLowerCase())) continue

    // Optional leading quantity: 1–2 digits, an optional x/X, then the name.
    // A bare name with no quantity parses as quantity 1 — this is a collage tool
    // and one-of-each is the common case, so we never require a "1x" prefix.
    // Limiting the quantity to 1–2 digits also means a name that starts with a
    // longer number is read as a card name, not a quantity: "100 Forest" and
    // "1996 World Champion" both parse as cards at quantity 1 (intentional), not
    // as 100 / 1996 copies.
    let quantity = 1
    let rest = line
    const qtyMatch = /^(\d{1,2})\s*[xX]?\s+(.+)$/.exec(line)
    if (qtyMatch) {
      quantity = Math.min(99, Math.max(1, parseInt(qtyMatch[1], 10)))
      rest = qtyMatch[2].trim()
    }

    let name = rest
    let setCode: string | undefined
    let collectorNumber: string | undefined

    // Greedy match captures the LAST (SET) pattern, so card names containing
    // parenthetical text don't confuse the parse (e.g. DFC names with " // ").
    // Set codes are normalised to uppercase; collector numbers accept Alchemy-style
    // "A-1" format in addition to the plain numeric and "150a" variants.
    const setMatch = /^(.*)\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([A-Za-z0-9][A-Za-z0-9-]*))?\s*$/.exec(name)
    if (setMatch) {
      name = setMatch[1].trim()
      setCode = setMatch[2].toUpperCase()
      collectorNumber = setMatch[3]
    }

    // A genuinely unreadable line has no card name to search — i.e. no letters
    // (junk like "----", "123", "***"). Count it so the user is told, rather than
    // dropping it silently. Anything with a letter becomes a card-name entry.
    if (!/\p{L}/u.test(name)) {
      unreadableCount++
      continue
    }

    entries.push({ quantity, name, setCode, collectorNumber })
  }

  return { entries, unreadableCount }
}
