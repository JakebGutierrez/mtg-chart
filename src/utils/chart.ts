import type { Chart, Slot } from '@/types/chart'

export function getSlot(chart: Chart, slotIndex: number): Slot | null {
  return chart.slots[slotIndex] ?? null
}
