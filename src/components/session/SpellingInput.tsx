import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n/translate'
import { clsx } from '../../lib/utils'
import { Button } from '../ui'

type Status = 'idle' | 'correct' | 'wrong' | 'accent'

export function SpellingInput({
  value,
  status,
  disabled,
  expected,
  onChange,
  onSubmit,
}: {
  value: string
  status: Status
  disabled: boolean
  expected: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const almost = t('session.almostExample')
  const token = '{expected}'
  const splitAt = almost.indexOf(token)
  const almostBefore = splitAt >= 0 ? almost.slice(0, splitAt) : almost
  const almostAfter = splitAt >= 0 ? almost.slice(splitAt + token.length) : ''

  useEffect(() => {
    if (disabled) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [expected, status, disabled])

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            if (!disabled) onSubmit()
          }
        }}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={t('session.typeWord')}
        className={clsx(
          'min-h-16 w-full rounded-2xl border bg-card px-4 text-center font-display text-3xl outline-none transition',
          status === 'idle' && 'border-line text-fg focus:border-accent',
          status === 'correct' && 'border-success bg-success-soft text-success animate-pop',
          status === 'wrong' && 'border-danger bg-danger-soft text-danger animate-shake',
          status === 'accent' && 'border-warn bg-warn-soft text-warn',
        )}
      />

      {status === 'accent' ? (
        <p className="text-center text-sm font-medium text-warn">
          {almostBefore}
          <span className="font-display">{expected}</span>
          {almostAfter}
        </p>
      ) : null}

      <Button className="w-full" disabled={disabled || !value.trim()} onClick={onSubmit}>
        {t('common.check')}
      </Button>
    </div>
  )
}
