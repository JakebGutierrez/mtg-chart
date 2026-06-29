import { describe, it, expect } from 'vitest'
import { pushPast, shouldPushSnapshot, HISTORY_CAP } from '@/utils/history'

describe('pushPast', () => {
  it('appends a snapshot', () => {
    expect(pushPast([1, 2], 3)).toEqual([1, 2, 3])
  })

  it('caps the stack at HISTORY_CAP, dropping the oldest', () => {
    const full = Array.from({ length: HISTORY_CAP }, (_, i) => i) // 0..49
    const next = pushPast(full, 999)
    expect(next).toHaveLength(HISTORY_CAP)
    expect(next[next.length - 1]).toBe(999)
    expect(next[0]).toBe(1) // oldest (0) dropped
  })
})

describe('shouldPushSnapshot (edit-burst coalescing, B4)', () => {
  it('pushes when starting a burst from idle (null)', () => {
    expect(shouldPushSnapshot(null, 'title')).toBe(true)
  })
  it('does NOT push for a continuing same-field burst', () => {
    expect(shouldPushSnapshot('title', 'title')).toBe(false)
  })
  it('pushes when switching fields', () => {
    expect(shouldPushSnapshot('title', 'bgColor')).toBe(true)
  })

  it('a run of same-field edits yields exactly one push', () => {
    // The change handler calls shouldPushSnapshot per change; focus/blur never
    // call it, so focus-then-blur with no edit pushes nothing.
    let burst: string | null = null
    let pushes = 0
    for (const field of ['title', 'title', 'title']) {
      if (shouldPushSnapshot(burst, field)) pushes++
      burst = field
    }
    expect(pushes).toBe(1)
  })

  it('switching fields mid-stream pushes once per switch', () => {
    let burst: string | null = null
    let pushes = 0
    for (const field of ['title', 'bgColor', 'title']) {
      if (shouldPushSnapshot(burst, field)) pushes++
      burst = field
    }
    expect(pushes).toBe(3)
  })
})
