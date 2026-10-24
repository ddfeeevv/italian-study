import { Volume2 } from 'lucide-react'
import { useI18n } from '../i18n/translate'
import { speak } from '../lib/tts'
import { clsx } from '../lib/utils'

export function SpeakButton({
  text,
  locale,
  label,
  className,
}: {
  text: string
  locale?: string | null
  label?: string
  className?: string
}) {
  const { t } = useI18n()
  if (!text.trim() || !locale) return null

  return (
    <button
      type="button"
      aria-label={label ?? t('speak.generic')}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        speak(text, locale)
      }}
      className={clsx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-accent transition hover:bg-accent/10 active:scale-95',
        className,
      )}
    >
      <Volume2 size={18} />
    </button>
  )
}
