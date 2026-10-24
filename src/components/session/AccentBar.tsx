import { useEffect, useState } from 'react'

function insertAtCursor(char: string) {
  const el = document.activeElement
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return
  if (el.disabled || el.readOnly) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const next = el.value.slice(0, start) + char + el.value.slice(end)
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, next)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  requestAnimationFrame(() => {
    el.focus()
    const cursor = start + char.length
    el.setSelectionRange(cursor, cursor)
  })
}

export function AccentBar({ accents, offset = 0 }: { accents: readonly string[]; offset?: number }) {
  const [lift, setLift] = useState(offset)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setLift(keyboard > 80 ? keyboard : offset)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [offset])

  if (accents.length === 0) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap justify-center gap-2 border-t border-line bg-card/95 px-3 pt-2 backdrop-blur lg:inset-x-auto lg:bottom-8 lg:left-1/2 lg:w-auto lg:max-w-xl lg:-translate-x-1/2 lg:rounded-3xl lg:border lg:px-3 lg:shadow-[var(--shadow)]"
      style={{
        ...(lift > 0 ? { bottom: lift } : {}),
        paddingBottom: lift > 80 ? '0.5rem' : 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {accents.map((accent) => (
        <button
          key={accent}
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => insertAtCursor(accent)}
          className="min-h-11 min-w-11 rounded-2xl border border-line bg-surface text-lg font-semibold text-fg active:scale-95"
        >
          {accent}
        </button>
      ))}
    </div>
  )
}
