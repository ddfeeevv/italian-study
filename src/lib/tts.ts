import type { Card } from '../types/models'

function pickItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === 'it-IT' || voice.lang === 'it_IT') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('it'))
  )
}

export function italianSpeechText(card: Card): string {
  if (card.type === 'cloze' && card.sentence) {
    return card.sentence.replace(/\{blank\}/gi, card.target || card.term || '').replace(/\s+/g, ' ').trim()
  }
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
