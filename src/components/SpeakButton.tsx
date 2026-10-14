import { Volume2 } from 'lucide-react'
import { speakItalian } from '../lib/tts'
import { clsx } from '../lib/utils'

export function SpeakButton({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  if (!text.trim()) return null

  return (
    <button
      type="button"
      aria-label="Произнести по-итальянски"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        speakItalian(text)
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
