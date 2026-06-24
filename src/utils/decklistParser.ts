export interface DecklistEntry {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
}

const SECTION_HEADERS = new Set([
  'deck',
  'sideboard',
  'commander',
  'companion',
  'maybeboard',
])

export function parseDecklistText(text: string): DecklistEntry[] {
  const entries: DecklistEntry[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('//') || line.startsWith('#')) continue
    if (SECTION_HEADERS.has(line.toLowerCase())) continue

    const qtyMatch = /^(\d+)[x]?\s+(.+)$/.exec(line)
    if (!qtyMatch) continue

    const quantity = parseInt(qtyMatch[1], 10)
    if (quantity < 1 || quantity > 99) continue

    let name = qtyMatch[2].trim()
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

    if (!name) continue

    entries.push({ quantity, name, setCode, collectorNumber })
  }

  return entries
}
