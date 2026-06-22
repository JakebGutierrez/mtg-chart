import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Slot } from '@/types/chart'
import {
  buildPrintingsUrl,
  normalisePrinting,
  type PrintingMeta,
  type ScryfallSearchResponse,
} from '@/utils/scryfall'
import styles from './PrintingSwitcher.module.css'

interface Props {
  currentSlot: Slot
  onSelect: (updated: Slot) => void
  onClose: () => void
}

export default function PrintingSwitcher({ currentSlot, onSelect, onClose }: Props) {
  const [printings, setPrintings] = useState<PrintingMeta[]>([])
  const [loading, setLoading] = useState(true)   // always starts loading on mount
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(buildPrintingsUrl(currentSlot.oracleId), { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 429) {
          setError('Too many requests — please wait.')
          setLoading(false)
          return
        }
        if (!res.ok) {
          setError('Failed to load printings.')
          setLoading(false)
          return
        }
        const data: ScryfallSearchResponse = await res.json()
        const options = data.data.flatMap((card) => {
          const p = normalisePrinting(card)
          return p ? [p] : []
        })
        setPrintings(options)
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Failed to load printings.')
        setLoading(false)
      })

    return () => controller.abort()
  }, [currentSlot.oracleId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSelect = (printing: PrintingMeta) => {
    const faceCount = printing.slot.imageUris.length
    const updatedSlot: Slot = {
      ...printing.slot,
      selectedFaceIndex: (currentSlot.selectedFaceIndex < faceCount
        ? currentSlot.selectedFaceIndex
        : 0) as 0 | 1,
    }
    onSelect(updatedSlot)
    onClose()
  }

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (!modalRef.current?.contains(e.target as Node)) onClose()
      }}
    >
      <div ref={modalRef} className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Switch Printing — {currentSlot.cardName}</span>
          <button className={styles.closeBtn} type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          {loading && <p className={styles.message}>Loading printings…</p>}
          {error && <p className={styles.message}>{error}</p>}
          {!loading && !error && printings.length === 0 && (
            <p className={styles.message}>No printings found.</p>
          )}
          {!loading && !error && printings.length > 0 && (
            <div className={styles.grid}>
              {printings.map((printing) => (
                <button
                  key={printing.slot.scryfallId}
                  type="button"
                  className={
                    printing.slot.scryfallId === currentSlot.scryfallId
                      ? `${styles.card} ${styles.current}`
                      : styles.card
                  }
                  onClick={() => handleSelect(printing)}
                >
                  <img
                    className={styles.thumb}
                    src={printing.slot.imageUris[0].artCrop}
                    alt={printing.setName}
                  />
                  <div className={styles.info}>
                    <span className={styles.setName}>{printing.setName}</span>
                    <span className={styles.meta}>
                      #{printing.slot.collectorNumber} · {printing.year}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
