// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { isEditableEventTarget } from '@/utils/dom'

describe('isEditableEventTarget (B3)', () => {
  it('is true for input, textarea, and select', () => {
    expect(isEditableEventTarget(document.createElement('input'))).toBe(true)
    expect(isEditableEventTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableEventTarget(document.createElement('select'))).toBe(true)
  })

  it('is true for a contenteditable element', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    expect(isEditableEventTarget(div)).toBe(true)
  })

  it('is false for non-editable elements and null', () => {
    expect(isEditableEventTarget(document.createElement('div'))).toBe(false)
    expect(isEditableEventTarget(document.createElement('button'))).toBe(false)
    expect(isEditableEventTarget(null)).toBe(false)
  })
})
