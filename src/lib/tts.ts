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
 */
export function italianSpeechText(card: Card, options: SpeechOptions = {}): string {
  const tier = options.tier ?? 2
  const revealed = options.revealed ?? tier === 2

  if (card.type === 'cloze' && card.sentence) {
    const fill = revealed ? card.target || card.term || '' : '…'
    return card.sentence.replace(/\{blank\}/gi, fill).replace(/\s+/g, ' ').trim()
  }

  // Vocab prompt is Russian until answered — speaking Italian would spoil MC
  if (card.type === 'vocab' && !revealed) return ''

  return (card.term || card.target || '').trim()
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
