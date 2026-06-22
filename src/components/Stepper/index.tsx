import styles from './Stepper.module.css'

interface Props {
  value: number
  min: number
  max: number
  unit?: string
  decrementLabel: string
  incrementLabel: string
  onDecrement: () => void
  onIncrement: () => void
  decrementDisabled?: boolean
  incrementDisabled?: boolean
}

export default function Stepper({
  value,
  min,
  max,
  unit = '',
  decrementLabel,
  incrementLabel,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
}: Props) {
  return (
    <div className={styles.stepper}>
      <button
        className={styles.btn}
        type="button"
        aria-label={decrementLabel}
        disabled={decrementDisabled ?? value <= min}
        onClick={onDecrement}
      >
        −
      </button>
      <span className={styles.value}>
        {value}
        {unit}
      </span>
      <button
        className={styles.btn}
        type="button"
        aria-label={incrementLabel}
        disabled={incrementDisabled ?? value >= max}
        onClick={onIncrement}
      >
        +
      </button>
    </div>
  )
}
