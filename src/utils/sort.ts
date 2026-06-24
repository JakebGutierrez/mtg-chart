import type { Slot } from '@/types/chart'

export type SortKey = 'type' | 'cmc-asc' | 'cmc-desc' | 'color'

const TYPE_PRIORITY = [
  'creature',
  'instant',
  'sorcery',
  'enchantment',
  'artifact',
  'planeswalker',
  'land',
]

function typeBucket(typeLine: string | null): number {
  if (!typeLine) return TYPE_PRIORITY.length
  const lower = typeLine.toLowerCase()
  const idx = TYPE_PRIORITY.findIndex((t) => lower.includes(t))
  return idx === -1 ? TYPE_PRIORITY.length : idx
}

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G']

function colorBucket(colors: string[] | null): number {
  if (colors === null) return 7
  if (colors.length === 0) return 6
  if (colors.length > 1) return 5
  const idx = COLOR_ORDER.indexOf(colors[0])
  return idx === -1 ? 7 : idx
}

function compareSlots(a: Slot, b: Slot, key: SortKey): number {
  if (a.kind === 'custom' && b.kind === 'custom') return 0
  if (a.kind === 'custom') return 1
  if (b.kind === 'custom') return -1
  switch (key) {
    case 'type':
      return typeBucket(a.typeLine) - typeBucket(b.typeLine)
    case 'cmc-asc': {
      if (a.cmc === null && b.cmc === null) return 0
      if (a.cmc === null) return 1
      if (b.cmc === null) return -1
      return a.cmc - b.cmc
    }
    case 'cmc-desc': {
      if (a.cmc === null && b.cmc === null) return 0
      if (a.cmc === null) return 1
      if (b.cmc === null) return -1
      return b.cmc - a.cmc
    }
    case 'color':
      return colorBucket(a.colors) - colorBucket(b.colors)
  }
}

// Option B: filled slots compact to the front in sorted order; trailing indices become null.
export function sortSlots(slots: Array<Slot | null>, key: SortKey): Array<Slot | null> {
  const filled = slots.filter((s): s is Slot => s !== null)
  filled.sort((a, b) => compareSlots(a, b, key))
  const result: Array<Slot | null> = [...filled]
  while (result.length < slots.length) result.push(null)
  return result
}

// Fisher-Yates shuffle; same compact contract as sortSlots.
export function shuffleSlots(slots: Array<Slot | null>): Array<Slot | null> {
  const filled = slots.filter((s): s is Slot => s !== null)
  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[filled[i], filled[j]] = [filled[j], filled[i]]
  }
  const result: Array<Slot | null> = [...filled]
  while (result.length < slots.length) result.push(null)
  return result
}
