import type { Card } from '../types/models'

function pickItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === 'it-IT' || voice.lang === 'it_IT') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('it'))
  )
}

export type SpeechOptions = {
  /** Review tier. Defaults to 2 (answer already known). */
  tier?: 1 | 2
  /** True after the learner answered — full Italian answer may be spoken. */
  revealed?: boolean
}

/**
 * Italian text safe to speak for the current step.
 * Before `revealed`, never returns the answer for vocab / cloze blanks.
 * Pass `revealed` explicitly in review; deck lists may omit it (defaults to full phrase).
 */
export function italianSpeechText(card: Card, options: SpeechOptions = {}): string {
  const revealed = options.revealed ?? true

  if (card.type === 'cloze' && card.sentence) {
    const fill = revealed ? card.target || card.term || '' : '…'
    return card.sentence.replace(/\{blank\}/gi, fill).replace(/\s+/g, ' ').trim()
  }

  // Vocab: Russian prompt — Italian answer only after the learner answers
  if (card.type === 'vocab' && !revealed) return ''

  // After answer, prefer the correct form; before answer, only the visible prompt term
  if (revealed) return (card.target || card.term || '').trim()
  return (card.term || '').trim()
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
}

export function speakItalian(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const phrase = text.trim()
  if (!phrase) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(phrase)
  utterance.lang = 'it-IT'
  utterance.rate = 0.9

  const voice = pickItalianVoice(window.speechSynthesis.getVoices())
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}
