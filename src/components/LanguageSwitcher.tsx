import { Check, ChevronDown, Languages } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LOCALES, orderedLocales } from '../i18n/locales'
import { useI18n } from '../i18n/translate'
import { clsx } from '../lib/utils'

export function LanguageMenu({
  up = false,
  wide = false,
  iconOnly = false,
}: {
  up?: boolean
  wide?: boolean
  iconOnly?: boolean
}) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const current = LOCALES.find((item) => item.id === locale) ?? LOCALES[0]

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !selected) return
    const top = selected.offsetTop
    const bottom = top + selected.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top - 6
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 6
    }
  }, [open, locale])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={clsx('relative', wide && 'w-full')}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('account.language')}
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'inline-flex items-center rounded-full bg-surface text-sm font-medium text-fg transition hover:bg-line',
          iconOnly ? 'size-10 justify-center' : 'min-h-9 gap-1.5 px-2.5',
          wide && 'w-full',
        )}
      >
        <Languages size={15} className="shrink-0 text-accent" />
        {iconOnly ? null : (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{current.native}</span>
            <ChevronDown size={14} className={clsx('shrink-0 text-muted transition', open && 'rotate-180')} />
          </>
        )}
      </button>
      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t('account.language')}
          className={clsx(
            'thin-scrollbar absolute z-30 max-h-[min(20rem,70dvh)] overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-[var(--shadow)]',
            wide ? 'inset-x-0' : 'right-0 w-52',
            up ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {orderedLocales().map((item) => {
            const selected = item.id === locale
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setLocale(item.id)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm',
                    selected ? 'bg-surface font-semibold text-accent' : 'font-medium text-fg hover:bg-surface',
                  )}
                >
                  <span className="truncate">{item.native}</span>
                  {selected ? <Check size={15} className="shrink-0" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
