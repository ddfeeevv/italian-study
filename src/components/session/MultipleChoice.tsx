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
              'flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-4 text-left text-lg font-semibold transition active:scale-[0.99]',
              status === 'idle' && 'border-line bg-card text-fg hover:border-accent',
              showCorrect && 'border-success bg-success-soft text-success animate-pop',
              showWrong && 'border-danger bg-danger-soft text-danger animate-shake',
              status !== 'idle' && !showCorrect && !showWrong && 'border-line bg-surface text-muted',
            )}
          >
            <span className="hidden min-w-8 shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-center text-[11px] font-bold tracking-wide text-muted md:inline-block">
              [{index + 1}]
            </span>
            <span>{option}</span>
          </button>
        )
      })}
    </div>
  )
}
