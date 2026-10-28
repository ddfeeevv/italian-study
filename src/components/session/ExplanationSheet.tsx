import { Lightbulb, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/translate'
import { clampIntervalDays } from '../../lib/srs'
import { SpeakButton } from '../SpeakButton'
import { Button, Card } from '../ui'

export function ExplanationSheet({
  answer,
  explanation,
  locale,
  speechLabel,
  returnDays,
  onReturnDays,
  onAgain,
  onContinue,
}: {
  answer: string
  explanation?: string
  locale?: string | null
  speechLabel?: string
  returnDays?: number
  onReturnDays?: (days: number) => void
  onAgain?: () => void
  onContinue: () => void
}) {
  const { t, plural } = useI18n()
  const [ready, setReady] = useState(false)
  const [days, setDays] = useState(returnDays ?? 1)

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 550)
    return () => window.clearTimeout(id)
  }, [])

  const changeDays = (next: number) => {
    const safe = clampIntervalDays(next, 1)
    setDays(safe)
    onReturnDays?.(safe)
  }

  const again = onAgain ?? onContinue

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        if (event.target instanceof HTMLButtonElement) {
          event.stopPropagation()
          return
        }
        if (event.target instanceof HTMLInputElement) return
        if (!ready) return
        event.preventDefault()
        event.stopPropagation()
        again()
      }}
    >
      <Card className="animate-rise w-full max-w-lg rounded-b-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-3xl sm:pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-danger">{t('common.error')}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          {t('session.correct')} <span className="font-display text-xl text-fg">{answer}</span>
          <SpeakButton text={answer} locale={locale} label={speechLabel} />
        </p>
        {explanation ? (
          <p className="mt-4 flex gap-2 rounded-2xl bg-warn-soft px-3 py-3 text-sm leading-6 text-fg">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-warn" />
            {explanation}
          </p>
        ) : null}
        {onReturnDays ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">{t('intervals.returnIn')}</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={t('intervals.less')}
                  disabled={!ready || days <= 1}
                  onClick={() => changeDays(days - 1)}
                  className="inline-flex size-11 items-center justify-center rounded-xl text-fg hover:bg-surface disabled:opacity-40"
                >
                  <Minus size={16} />
                </button>
                <input
                  inputMode="numeric"
                  aria-label={t('intervals.returnIn')}
                  value={days}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^\d]/g, '')
                    if (!raw) return
                    changeDays(Number(raw))
                  }}
                  className="h-11 w-14 rounded-xl border border-line bg-card text-center text-sm text-fg outline-none focus:border-accent"
                />
                <span className="w-12 text-xs text-muted">{plural('days', days)}</span>
                <button
                  type="button"
                  aria-label={t('intervals.more')}
                  disabled={!ready || days >= 365}
                  onClick={() => changeDays(days + 1)}
                  className="inline-flex size-11 items-center justify-center rounded-xl text-fg hover:bg-surface disabled:opacity-40"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{t('intervals.missWhy')}</p>
          </div>
        ) : null}
        <div className="mt-5 flex gap-3">
          {onAgain ? (
            <Button className="flex-1" disabled={!ready} onClick={onAgain}>
              {t('session.again')}
            </Button>
          ) : null}
          <Button
            className={onAgain ? 'flex-1' : 'w-full'}
            variant={onAgain ? 'secondary' : 'primary'}
            disabled={!ready}
            onClick={onContinue}
          >
            {t('common.next')}
          </Button>
        </div>
        {onAgain ? <p className="mt-3 text-center text-xs text-muted">{t('session.againNote')}</p> : null}
      </Card>
    </div>
  )
}
