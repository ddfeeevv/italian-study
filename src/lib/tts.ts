import type { Card } from '../types/models'

export type SpeechOptions = {
  /** Review tier. Defaults to 2 (answer already known). */
  tier?: 1 | 2
  /** True after the learner answered — the full answer may be spoken. */
  revealed?: boolean
}

/**
 * Answer text safe to speak for the current step.
 * Before `revealed`, never returns the answer for vocab / cloze blanks.
 * Pass `revealed` explicitly in review; deck lists may omit it (defaults to full phrase).
 */
export function speechText(card: Card, options: SpeechOptions = {}): string {
  const revealed = options.revealed ?? true

  if (card.type === 'cloze' && card.sentence) {
    const fill = revealed ? card.target || card.term || '' : '…'
    return card.sentence.replace(/\{blank\}/gi, fill).replace(/\s+/g, ' ').trim()
  }

  // Vocab: prompt language — the answer only after the learner answers
  if (card.type === 'vocab' && !revealed) return ''

  if (revealed) return (card.target || card.term || '').trim()
  return (card.term || '').trim()
}

/** @deprecated use speechText */
export const italianSpeechText = speechText

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices()
  })
}

function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | undefined {
  const lang = locale.toLowerCase().replace('_', '-')
  const base = lang.split('-')[0]
  return (
    voices.find((voice) => voice.lang.toLowerCase().replace('_', '-') === lang) ??
    voices.find((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith(base))
  )
}

export function speak(text: string, locale: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis || !locale) return
  const phrase = text.trim()
  if (!phrase) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(phrase)
  utterance.lang = locale
  utterance.rate = locale.toLowerCase().startsWith('zh') || locale.toLowerCase().startsWith('ja') ? 0.85 : 0.9

  const voice = pickVoice(window.speechSynthesis.getVoices(), locale)
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}

/** @deprecated use speak(text, locale) */
export function speakItalian(text: string): void {
  speak(text, 'it-IT')
}
