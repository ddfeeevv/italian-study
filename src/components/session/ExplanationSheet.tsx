import { Lightbulb } from 'lucide-react'
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
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-0 sm:items-center">
      <Card className="animate-rise w-full max-w-md rounded-b-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-danger">Ошибка</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          Правильно: <span className="font-display text-xl text-fg">{answer}</span>
          <SpeakButton text={answer} />
        </p>
        {explanation ? (
          <p className="mt-4 flex gap-2 rounded-2xl bg-warn-soft px-3 py-3 text-sm leading-6 text-fg">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-warn" />
            {explanation}
          </p>
        ) : null}
        <Button className="mt-5 w-full" onClick={onContinue}>
          Дальше
        </Button>
      </Card>
    </div>
  )
}
