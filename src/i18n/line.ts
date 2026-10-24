import type { Locale } from './locales'

/** Interface copy in locale order: ru en es de fr pt it zh ja ko tr pl uk */
export function line(
  ru: string,
  en: string,
  es: string,
  de: string,
  fr: string,
  pt: string,
  it: string,
  zh: string,
  ja: string,
  ko: string,
  tr: string,
  pl: string,
  uk: string,
): Record<Locale, string> {
  return { ru, en, es, de, fr, pt, it, zh, ja, ko, tr, pl, uk }
}

export function forms(
  ru: readonly [string, string, string],
  en: readonly [string, string, string],
  es: readonly [string, string, string],
  de: readonly [string, string, string],
  fr: readonly [string, string, string],
  pt: readonly [string, string, string],
  it: readonly [string, string, string],
  zh: readonly [string, string, string],
  ja: readonly [string, string, string],
  ko: readonly [string, string, string],
  tr: readonly [string, string, string],
  pl: readonly [string, string, string],
  uk: readonly [string, string, string],
): Record<Locale, readonly [string, string, string]> {
  return { ru, en, es, de, fr, pt, it, zh, ja, ko, tr, pl, uk }
}
