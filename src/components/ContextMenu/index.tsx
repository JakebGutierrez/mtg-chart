import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './ContextMenu.module.css'

interface Props {
  position: { x: number; y: number }
  onRemove: () => void
  onSwitchPrinting: () => void
  onSwitchFace: (() => void) | null
  onClose: () => void
}

export default function ContextMenu({ position, onRemove, onSwitchPrinting, onSwitchFace, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleMousedown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    const handleScroll = () => onClose()

    window.addEventListener('keydown', handleKey)
    window.addEventListener('mousedown', handleMousedown)
    window.addEventListener('scroll', handleScroll, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('mousedown', handleMousedown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [onClose])

  return createPortal(
    <div ref={menuRef} className={styles.menu} style={{ left: position.x, top: position.y }}>
      <button className={styles.item} type="button" onClick={onRemove}>
        Remove
      </button>
      <button className={styles.item} type="button" onClick={onSwitchPrinting}>
        Switch Printing
      </button>
      {onSwitchFace && (
        <button className={styles.item} type="button" onClick={onSwitchFace}>
          Switch Face
        </button>
      )}
    </div>,
    document.body,
  )
}
