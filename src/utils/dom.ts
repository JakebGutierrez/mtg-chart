// True when an event originated from a text-editing control. Used to let the
// browser's native undo/redo handle Cmd/Ctrl+Z inside inputs instead of the
// app's chart-level undo (B3).
export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // isContentEditable is the correct check in browsers (it also covers inherited
  // editability); the attribute fallback keeps the explicit case deterministic in
  // environments that don't compute isContentEditable.
  if (target.isContentEditable) return true
  const attr = target.getAttribute('contenteditable')
  return attr === '' || attr === 'true' || attr === 'plaintext-only'
}
