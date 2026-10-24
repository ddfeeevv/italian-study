import { useSyncExternalStore } from 'react'
import { browserLocale, isLocale, localeMeta, type Locale } from './locales'
import { messages, type MessageKey } from './messages'
import { pickPlural, PLURALS, type PluralKey } from './plurals'
import { speakPhrase, studyName, studySamples, type WordSample } from './study'

const STORAGE_KEY = 'parola:locale'

const listeners = new Set<() => void>()

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    /* private mode */
  }
  return browserLocale() ?? 'en'
}

let current: Locale = readLocale()

function applyDocument(locale: Locale) {
  if (typeof document === 'undefined') return
  const meta = localeMeta(locale)
  document.documentElement.lang = meta.html
  document.title = messages['doc.title'][locale]
}

applyDocument(current)

export function getLocale(): Locale {
  return current
}

export function setLocale(next: Locale) {
  if (next === current) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* private mode */
  }
  applyDocument(next)
  listeners.forEach((listener) => listener())
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = messages[key][current]
  if (!vars) return text
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

export function plural(kind: PluralKey, count: number): string {
  return pickPlural(current, count, PLURALS[kind][current])
}

export function countInline(kind: PluralKey, count: number): string {
  return t('count.inline', { count, noun: plural(kind, count) })
}

export function studyTitle(presetId: string | null | undefined, fallback: string): string {
  return studyName(current, presetId, fallback)
}

export function speakLabel(presetId: string | null | undefined): string {
  return speakPhrase(current, presetId, t('speak.generic'))
}

export function wordExample(presetId: string | null | undefined): WordSample {
  return studySamples(current, presetId)[0]
}

export function bulkExample(presetId: string | null | undefined): string {
  const [work, hello, thanks] = studySamples(current, presetId)
  return `${work.term} - ${work.translation}\n${hello.term}, ${hello.translation}\n${thanks.term}; ${thanks.translation}`
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  return { locale, setLocale, t, plural, countInline, studyTitle, speakLabel, wordExample, bulkExample }
}
