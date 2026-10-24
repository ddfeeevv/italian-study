export const LOCALES = [
  { id: 'en', native: 'English', html: 'en' },
  { id: 'ru', native: 'Русский', html: 'ru' },
  { id: 'es', native: 'Español', html: 'es' },
  { id: 'de', native: 'Deutsch', html: 'de' },
  { id: 'fr', native: 'Français', html: 'fr' },
  { id: 'pt', native: 'Português', html: 'pt-BR' },
  { id: 'it', native: 'Italiano', html: 'it' },
  { id: 'zh', native: '中文', html: 'zh-CN' },
  { id: 'ja', native: '日本語', html: 'ja' },
  { id: 'ko', native: '한국어', html: 'ko' },
  { id: 'tr', native: 'Türkçe', html: 'tr' },
  { id: 'pl', native: 'Polski', html: 'pl' },
  { id: 'uk', native: 'Українська', html: 'uk' },
] as const

export type Locale = (typeof LOCALES)[number]['id']

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.some((item) => item.id === value)
}

export function localeMeta(locale: Locale) {
  return LOCALES.find((item) => item.id === locale) ?? LOCALES[0]
}

/** Browser language when it is one of ours. Otherwise null. */
export function browserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator.language?.toLowerCase() ?? ''
  if (!nav) return null
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('pt')) return 'pt'
  const match = nav.split('-')[0]
  return isLocale(match) ? match : null
}

/** Browser language first when we support it. English leads the list otherwise. */
export function orderedLocales() {
  const matched = browserLocale()
  if (!matched || matched === 'en') return LOCALES
  const head = LOCALES.find((item) => item.id === matched)
  if (!head) return LOCALES
  return [head, ...LOCALES.filter((item) => item.id !== matched)]
}
