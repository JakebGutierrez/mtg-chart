import { useState, useMemo } from 'react'
import type { Chart, Slot } from '@/types/chart'
import { useScryfall } from '@/hooks/useScryfall'
import { getSlot } from '@/utils/chart'
import { generateCellMap } from '@/utils/cellMap'
import styles from './SearchPanel.module.css'

interface Props {
  chart: Chart
  onSlotFill: (slot: Slot) => void
}

export default function SearchPanel({ chart, onSlotFill }: Props) {
  const [query, setQuery] = useState('')
  const { results, isLoading, error } = useScryfall(query)

  const cellMap = useMemo(
    () => generateCellMap(chart.gridRows, chart.gridCols, chart.heroConfig),
    [chart.gridRows, chart.gridCols, chart.heroConfig],
  )
  const fillableCells = useMemo(() => cellMap.filter((c) => c.kind !== 'covered'), [cellMap])
  const isFull = fillableCells.every((c) => getSlot(chart, c.slotIndex) !== null)

  return (
    <div className={styles.container}>
      <input
        className={styles.input}
        type="search"
        placeholder="Search cards…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search cards"
      />

      {isLoading && <p className={styles.status}>Searching…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {isFull && query.trim() && !isLoading && !error && (
        <p className={styles.status}>Grid is full — drag a card to replace.</p>
      )}

      {!isLoading && !error && results.length > 0 && (
        <ul className={styles.results} role="list">
          {results.map((result) => (
            <li key={result.scryfallId}>
              <button
                className={styles.resultBtn}
                type="button"
                disabled={isFull}
                onClick={() => onSlotFill(result)}
              >
                <img
                  className={styles.thumb}
                  src={result.imageUris[result.selectedFaceIndex].artCrop}
                  alt=""
                  loading="lazy"
                />
                <span className={styles.name}>{result.cardName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
