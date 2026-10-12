import { useEffect } from 'react'
import { clsx } from '../../lib/utils'

type Status = 'idle' | 'correct' | 'wrong'

export function MultipleChoice({
  options,
  correct,
  disabled,
  selected,
  status,
  onSelect,
}: {
  options: string[]
  correct: string
  disabled: boolean
  selected: string | null
  status: Status
  onSelect: (option: string) => void
}) {
  useEffect(() => {
    if (disabled) return
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1
      if (index >= 0 && index < options.length) onSelect(options[index])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, onSelect, options])

  return (
    <div className="grid gap-3">
      {options.map((option, index) => {
        const isSelected = selected === option
        const isCorrect = option === correct
        const showCorrect = status !== 'idle' && isCorrect
        const showWrong = status === 'wrong' && isSelected

        return (
          <button
            key={`${option}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
            className={clsx(
              'min-h-16 rounded-2xl border px-4 py-4 text-left text-lg font-semibold transition active:scale-[0.99]',
              status === 'idle' && 'border-line bg-card text-fg hover:border-accent',
              showCorrect && 'border-success bg-success-soft text-success animate-pop',
              showWrong && 'border-danger bg-danger-soft text-danger animate-shake',
              status !== 'idle' && !showCorrect && !showWrong && 'border-line bg-surface text-muted',
            )}
          >
            <span className="mr-3 text-xs font-bold text-muted">{index + 1}</span>
            {option}
          </button>
        )
      })}
    </div>
  )
}
