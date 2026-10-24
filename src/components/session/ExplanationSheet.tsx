import { Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/translate'
import { SpeakButton } from '../SpeakButton'
import { Button, Card } from '../ui'

export function ExplanationSheet({
  answer,
  explanation,
  onContinue,
}: {
  answer: string
  explanation?: string
  onContinue: () => void
}) {
  // Prevent the Enter/keyup that submitted the answer from also clicking "Дальше"
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 550)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && ready) {
          event.preventDefault()
          event.stopPropagation()
          onContinue()
        }
      }}
    >
      <Card className="animate-rise w-full max-w-lg rounded-b-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-3xl sm:pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-danger">{t('common.error')}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          {t('session.correct')} <span className="font-display text-xl text-fg">{answer}</span>
          <SpeakButton text={answer} />
        </p>
        {explanation ? (
          <p className="mt-4 flex gap-2 rounded-2xl bg-warn-soft px-3 py-3 text-sm leading-6 text-fg">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-warn" />
            {explanation}
          </p>
        ) : null}
        <Button className="mt-5 w-full" disabled={!ready} onClick={onContinue}>
          {t('common.next')}
        </Button>
      </Card>
    </div>
  )
}
