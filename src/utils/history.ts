export const HISTORY_CAP = 50

// Push a snapshot onto the undo stack, keeping at most `cap` entries (drops the
// oldest). Mirrors the existing inline `[...past.slice(-49), snapshot]`.
export function pushPast<T>(past: T[], snapshot: T, cap = HISTORY_CAP): T[] {
  return [...past.slice(-(cap - 1)), snapshot]
}

// Coalescing decision for edit bursts (title typing, colour-picker dragging):
// push a new history snapshot only when the incoming edit starts a *different*
// burst than the one in progress. A run of same-field edits collapses to one
// snapshot. Callers invoke this from the change handler (not focus), so a
// focus-then-blur with no edit pushes nothing.
export function shouldPushSnapshot(
  currentBurstField: string | null,
  incomingField: string,
): boolean {
  return currentBurstField !== incomingField
}
