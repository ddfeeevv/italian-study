import type { Card } from '../types/models'

function pickItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === 'it-IT' || voice.lang === 'it_IT') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('it'))
  )
}

/** Text safe to speak without spoiling the answer for the given tier. */
export function italianSpeechText(card: Card, tier: 1 | 2 = 2): string {
  if (card.type === 'cloze' && card.sentence) {
    // Tier 1: don't fill the blank — that is the answer
    const fill = tier === 2 ? card.target || card.term || '' : '…'
    return card.sentence.replace(/\{blank\}/gi, fill).replace(/\s+/g, ' ').trim()
  }
  // Vocab Tier 1 shows Russian; speaking Italian would reveal the MC answer
  if (card.type === 'vocab' && tier === 1) return ''
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
