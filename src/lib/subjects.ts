import { speakLabel } from '../i18n/translate'
import type { Card, CardType, Deck, Script, Settings, Subject } from '../types/models'
import { nowIso, uid } from './utils'

export type WrittenScript = Exclude<Script, 'any'> | 'digit' | 'other'

export type FallbackLists = Record<CardType, string[]>

export type LanguagePreset = {
  id: string
  title: string
  locale: string
  accents: string[]
  answerScript: Exclude<Script, 'any'>
  promptScript: Exclude<Script, 'any'>
  speechLabel: string
  fallbacks: FallbackLists
}

const words = (vocab: string[], cloze: string[] = vocab, transform: string[] = vocab): FallbackLists => ({
  vocab,
  cloze,
  transform,
})

export const LANGUAGE_PRESETS: LanguagePreset[] = [
  {
    id: 'it',
    title: 'Итальянский',
    locale: 'it-IT',
    accents: ['à', 'è', 'é', 'ì', 'ò', 'ù'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-итальянски',
    fallbacks: words(
      ['ciao', 'grazie', 'prego', 'bene', 'oggi', 'sempre', 'ancora', 'perché'],
      ['prendo', 'prendiamo', 'prendete', 'prendono', 'parlo', 'parliamo', 'il', 'lo', 'la', 'gli'],
      ['le case nuove', 'i ragazzi alti', 'gli amici cari', 'le amiche nuove', 'questi libri'],
    ),
  },
  {
    id: 'de',
    title: 'Немецкий',
    locale: 'de-DE',
    accents: ['ä', 'ö', 'ü', 'ß'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-немецки',
    fallbacks: words(
      ['hallo', 'danke', 'bitte', 'gut', 'heute', 'immer', 'noch', 'weil'],
      ['spreche', 'sprechen', 'esse', 'essen', 'der', 'die', 'das', 'den'],
      ['die neuen Häuser', 'die großen Jungen', 'die guten Freunde', 'diese Bücher'],
    ),
  },
  {
    id: 'ru',
    title: 'Русский',
    locale: 'ru-RU',
    accents: ['ё'],
    answerScript: 'cyrillic',
    promptScript: 'latin',
    speechLabel: 'по-русски',
    fallbacks: words(
      ['привет', 'спасибо', 'пожалуйста', 'хорошо', 'сегодня', 'всегда', 'ещё', 'потому'],
      ['говорю', 'говорим', 'ем', 'едим', 'я', 'ты', 'он', 'она'],
      ['новые дома', 'высокие мальчики', 'добрые друзья', 'эти книги'],
    ),
  },
  {
    id: 'zh',
    title: 'Китайский',
    locale: 'zh-CN',
    accents: [],
    answerScript: 'cjk',
    promptScript: 'cyrillic',
    speechLabel: 'по-китайски',
    fallbacks: words(
      ['你好', '谢谢', '请', '好', '今天', '总是', '还', '因为'],
      ['说', '吃', '是', '不', '我', '你', '他', '她'],
      ['新房子', '高个子', '好朋友', '这些书'],
    ),
  },
  {
    id: 'en',
    title: 'Английский',
    locale: 'en-US',
    accents: [],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-английски',
    fallbacks: words(
      ['hello', 'thanks', 'please', 'well', 'today', 'always', 'still', 'because'],
      ['speak', 'eat', 'the', 'is', 'are', 'was', 'were', 'been'],
      ['the new houses', 'the tall boys', 'the good friends', 'these books'],
    ),
  },
  {
    id: 'es',
    title: 'Испанский',
    locale: 'es-ES',
    accents: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-испански',
    fallbacks: words(
      ['hola', 'gracias', 'por favor', 'bien', 'hoy', 'siempre', 'todavía', 'porque'],
      ['hablo', 'hablamos', 'como', 'comemos', 'el', 'la', 'los', 'las'],
      ['las casas nuevas', 'los chicos altos', 'los amigos queridos', 'estos libros'],
    ),
  },
  {
    id: 'fr',
    title: 'Французский',
    locale: 'fr-FR',
    accents: ['à', 'â', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û', 'œ'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-французски',
    fallbacks: words(
      ['bonjour', 'merci', 's’il vous plaît', 'bien', 'aujourd’hui', 'toujours', 'encore', 'parce que'],
      ['parle', 'parlons', 'mange', 'mangeons', 'le', 'la', 'les', 'un'],
      ['les maisons neuves', 'les grands garçons', 'les bons amis', 'ces livres'],
    ),
  },
  {
    id: 'pt',
    title: 'Португальский',
    locale: 'pt-BR',
    accents: ['á', 'â', 'ã', 'à', 'ç', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-португальски',
    fallbacks: words(
      ['olá', 'obrigado', 'por favor', 'bem', 'hoje', 'sempre', 'ainda', 'porque'],
      ['falo', 'falamos', 'como', 'comemos', 'o', 'a', 'os', 'as'],
      ['as casas novas', 'os meninos altos', 'os amigos queridos', 'estes livros'],
    ),
  },
  {
    id: 'ja',
    title: 'Японский',
    locale: 'ja-JP',
    accents: [],
    answerScript: 'cjk',
    promptScript: 'cyrillic',
    speechLabel: 'по-японски',
    fallbacks: words(
      ['こんにちは', 'ありがとう', 'お願い', 'いい', '今日', 'いつも', 'まだ', 'から'],
      ['話す', '食べる', 'です', 'ます', '私', 'あなた', '彼', '彼女'],
      ['新しい家', '高い男の子', '良い友達', 'これらの本'],
    ),
  },
  {
    id: 'ko',
    title: 'Корейский',
    locale: 'ko-KR',
    accents: [],
    answerScript: 'hangul',
    promptScript: 'cyrillic',
    speechLabel: 'по-корейски',
    fallbacks: words(
      ['안녕하세요', '감사합니다', '부탁', '좋아요', '오늘', '항상', '아직', '왜냐하면'],
      ['말하다', '먹다', '이다', '아니다', '나', '너', '그', '그녀'],
      ['새 집', '키 큰 소년', '좋은 친구', '이 책들'],
    ),
  },
  {
    id: 'ar',
    title: 'Арабский',
    locale: 'ar-SA',
    accents: [],
    answerScript: 'arabic',
    promptScript: 'cyrillic',
    speechLabel: 'по-арабски',
    fallbacks: words(
      ['مرحبا', 'شكرا', 'من فضلك', 'جيد', 'اليوم', 'دائما', 'أيضا', 'لأن'],
      ['أتكلم', 'آكل', 'هو', 'هي', 'أنا', 'أنت', 'نحن', 'هم'],
      ['البيوت الجديدة', 'الأولاد الطوال', 'الأصدقاء الجيدون', 'هذه الكتب'],
    ),
  },
  {
    id: 'tr',
    title: 'Турецкий',
    locale: 'tr-TR',
    accents: ['ç', 'ğ', 'ı', 'İ', 'ö', 'ş', 'ü'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-турецки',
    fallbacks: words(
      ['merhaba', 'teşekkürler', 'lütfen', 'iyi', 'bugün', 'her zaman', 'hâlâ', 'çünkü'],
      ['konuşuyorum', 'yiyorum', 'ben', 'sen', 'o', 'bir', 'bu', 'şu'],
      ['yeni evler', 'uzun çocuklar', 'iyi arkadaşlar', 'bu kitaplar'],
    ),
  },
  {
    id: 'pl',
    title: 'Польский',
    locale: 'pl-PL',
    accents: ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-польски',
    fallbacks: words(
      ['cześć', 'dziękuję', 'proszę', 'dobrze', 'dziś', 'zawsze', 'jeszcze', 'bo'],
      ['mówię', 'jemy', 'ja', 'ty', 'on', 'ona', 'ten', 'ta'],
      ['nowe domy', 'wysocy chłopcy', 'dobrzy przyjaciele', 'te książki'],
    ),
  },
  {
    id: 'uk',
    title: 'Украинский',
    locale: 'uk-UA',
    accents: ['є', 'і', 'ї', 'ґ'],
    answerScript: 'cyrillic',
    promptScript: 'latin',
    speechLabel: 'по-украински',
    fallbacks: words(
      ['привіт', 'дякую', 'будь ласка', 'добре', 'сьогодні', 'завжди', 'ще', 'бо'],
      ['говорю', 'їмо', 'я', 'ти', 'він', 'вона', 'цей', 'ця'],
      ['нові будинки', 'високі хлопці', 'добрі друзі', 'ці книжки'],
    ),
  },
  {
    id: 'nl',
    title: 'Нидерландский',
    locale: 'nl-NL',
    accents: ['é', 'ë', 'ï', 'ó', 'ú'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-нидерландски',
    fallbacks: words(
      ['hallo', 'dank je', 'alsjeblieft', 'goed', 'vandaag', 'altijd', 'nog', 'omdat'],
      ['spreek', 'eet', 'de', 'het', 'een', 'ik', 'jij', 'zij'],
      ['de nieuwe huizen', 'de lange jongens', 'de goede vrienden', 'deze boeken'],
    ),
  },
  {
    id: 'sv',
    title: 'Шведский',
    locale: 'sv-SE',
    accents: ['å', 'ä', 'ö'],
    answerScript: 'latin',
    promptScript: 'cyrillic',
    speechLabel: 'по-шведски',
    fallbacks: words(
      ['hej', 'tack', 'snälla', 'bra', 'idag', 'alltid', 'ännu', 'eftersom'],
      ['talar', 'äter', 'jag', 'du', 'den', 'det', 'en', 'ett'],
      ['de nya husen', 'de långa pojkarna', 'de goda vännerna', 'dessa böcker'],
    ),
  },
  {
    id: 'el',
    title: 'Греческий',
    locale: 'el-GR',
    accents: ['ά', 'έ', 'ή', 'ί', 'ό', 'ύ', 'ώ'],
    answerScript: 'greek',
    promptScript: 'cyrillic',
    speechLabel: 'по-гречески',
    fallbacks: words(
      ['γεια', 'ευχαριστώ', 'παρακαλώ', 'καλά', 'σήμερα', 'πάντα', 'ακόμα', 'γιατί'],
      ['μιλάω', 'τρώω', 'εγώ', 'εσύ', 'αυτός', 'αυτή', 'ο', 'η'],
      ['τα νέα σπίτια', 'τα ψηλά αγόρια', 'οι καλοί φίλοι', 'αυτά τα βιβλία'],
    ),
  },
  {
    id: 'hi',
    title: 'Хинди',
    locale: 'hi-IN',
    accents: [],
    answerScript: 'devanagari',
    promptScript: 'cyrillic',
    speechLabel: 'на хинди',
    fallbacks: words(
      ['नमस्ते', 'धन्यवाद', 'कृपया', 'अच्छा', 'आज', 'हमेशा', 'अभी', 'क्योंकि'],
      ['बोलता', 'खाता', 'मैं', 'तुम', 'वह', 'है', 'यह', 'एक'],
      ['नए घर', 'लंबे लड़के', 'अच्छे दोस्त', 'ये किताबें'],
    ),
  },
]

const EMPTY_FALLBACKS: FallbackLists = { vocab: [], cloze: [], transform: [] }

export function presetById(id: string): LanguagePreset | undefined {
  return LANGUAGE_PRESETS.find((preset) => preset.id === id)
}

export type ProductionProfile = {
  answerScript: Script
  promptScript: Script
  fallbacks: FallbackLists
}

export function productionProfile(subject: Subject | null | undefined): ProductionProfile {
  if (!subject) {
    const italian = LANGUAGE_PRESETS[0]
    return {
      answerScript: italian.answerScript,
      promptScript: italian.promptScript,
      fallbacks: italian.fallbacks,
    }
  }
  const preset = subject.presetId ? presetById(subject.presetId) : undefined
  return {
    answerScript: subject.answerScript,
    promptScript: subject.promptScript,
    fallbacks: preset?.fallbacks ?? EMPTY_FALLBACKS,
  }
}

export function subjectSpeech(subject: Subject | null | undefined): { locale: string | null; label: string } {
  if (!subject || subject.kind !== 'language' || !subject.locale) {
    return { locale: null, label: speakLabel(null) }
  }
  return {
    locale: subject.locale,
    label: speakLabel(subject.presetId),
  }
}

export function subjectFromPreset(preset: LanguagePreset, userId: string): Subject {
  return {
    id: uid(),
    userId,
    title: preset.title,
    kind: 'language',
    locale: preset.locale,
    accents: [...preset.accents],
    answerScript: preset.answerScript,
    promptScript: preset.promptScript,
    speechLabel: preset.speechLabel,
    presetId: preset.id,
    createdAt: nowIso(),
  }
}

/** A language that is not one of the presets. No voice or accent keys. */
export function customLanguage(title: string, userId: string): Subject {
  return {
    id: uid(),
    userId,
    title: title.trim(),
    kind: 'language',
    locale: null,
    accents: [],
    answerScript: 'any',
    promptScript: 'any',
    speechLabel: '',
    presetId: null,
    createdAt: nowIso(),
  }
}

export function writtenScript(value: string): WrittenScript {
  const letters = value.match(/\p{L}/gu) ?? []
  if (letters.length === 0) return /\p{N}/u.test(value) ? 'digit' : 'other'
  const counts: Record<Exclude<WrittenScript, 'digit' | 'other'>, number> = {
    latin: 0,
    cyrillic: 0,
    cjk: 0,
    hangul: 0,
    arabic: 0,
    greek: 0,
    devanagari: 0,
  }
  for (const char of letters) {
    if (/\p{Script=Cyrillic}/u.test(char)) counts.cyrillic += 1
    else if (/\p{Script=Latin}/u.test(char)) counts.latin += 1
    else if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(char)) counts.cjk += 1
    else if (/\p{Script=Hangul}/u.test(char)) counts.hangul += 1
    else if (/\p{Script=Arabic}/u.test(char)) counts.arabic += 1
    else if (/\p{Script=Greek}/u.test(char)) counts.greek += 1
    else if (/\p{Script=Devanagari}/u.test(char)) counts.devanagari += 1
  }
  let best: WrittenScript = 'other'
  let bestCount = 0
  for (const [script, count] of Object.entries(counts) as Array<[Exclude<WrittenScript, 'digit' | 'other'>, number]>) {
    if (count > bestCount) {
      best = script
      bestCount = count
    }
  }
  return bestCount > 0 ? best : 'other'
}

/** Reject glosses in the prompt script so they never show up as choices. */
export function isProductionForm(value: string, profile: ProductionProfile): boolean {
  const v = value.trim()
  if (!v || v.length > 48) return false
  if (/\([^)]{0,12}\)/.test(v) && /\s/.test(v) && v.split(/\s+/).length >= 3) return false
  if (
    profile.answerScript !== 'any' &&
    profile.promptScript !== 'any' &&
    profile.promptScript !== profile.answerScript &&
    containsScript(v, profile.promptScript)
  ) {
    return false
  }
  const script = writtenScript(v)
  if (profile.answerScript !== 'any' && script !== 'digit' && script !== 'other' && script !== profile.answerScript) {
    return false
  }
  if (
    profile.promptScript === 'cyrillic' &&
    profile.answerScript !== 'cyrillic' &&
    /^(от|из|для)\s+/i.test(v)
  ) {
    return false
  }
  return true
}

const SCRIPT_PATTERN: Record<Exclude<Script, 'any'>, RegExp> = {
  latin: /\p{Script=Latin}/u,
  cyrillic: /\p{Script=Cyrillic}/u,
  cjk: /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u,
  hangul: /\p{Script=Hangul}/u,
  arabic: /\p{Script=Arabic}/u,
  greek: /\p{Script=Greek}/u,
  devanagari: /\p{Script=Devanagari}/u,
}

function containsScript(value: string, script: Exclude<Script, 'any'>): boolean {
  return SCRIPT_PATTERN[script].test(value)
}

export type PreparedStudy = {
  subjects: Subject[]
  decks: Deck[]
  removedSubjectIds: string[]
  subjectUpserts: string[]
  deckUpserts: string[]
  activeSubjectId: string | undefined
}

/**
 * One preset language per account. Decks without a subject join Italian, which
 * is created when the account has no subjects yet.
 * `seedDefault` stays false during first-run onboarding so the person picks
 * the language instead of inheriting Italian.
 */
export function prepareSubjects(
  userId: string,
  subjects: Subject[],
  decks: Deck[],
  settings: Settings,
  seedDefault = true,
): PreparedStudy {
  const owned = subjects.map((subject) => ({ ...subject, userId }))
  const deduped = dedupePresets(owned)
  let nextSubjects = deduped.subjects
  const subjectUpserts: string[] = []
  const deckUpserts = new Set<string>()

  if (nextSubjects.length === 0 && !seedDefault) {
    return {
      subjects: [],
      decks,
      removedSubjectIds: deduped.removed,
      subjectUpserts: [],
      deckUpserts: [],
      activeSubjectId: undefined,
    }
  }

  if (nextSubjects.length === 0) {
    const italian = subjectFromPreset(LANGUAGE_PRESETS[0], userId)
    nextSubjects = [italian]
    subjectUpserts.push(italian.id)
  }

  const fallback = nextSubjects.find((subject) => subject.presetId === 'it') ?? nextSubjects[0]
  const known = new Set(nextSubjects.map((subject) => subject.id))
  const nextDecks = decks.map((deck) => {
    const replaced = deck.subjectId ? deduped.replace.get(deck.subjectId) : undefined
    const subjectId = replaced ?? deck.subjectId
    const nextId = subjectId && known.has(subjectId) ? subjectId : fallback.id
    if (nextId !== deck.subjectId) deckUpserts.add(deck.id)
    return nextId === deck.subjectId ? deck : { ...deck, subjectId: nextId }
  })

  const active = settings.activeSubjectId
  const activeSubjectId = active && known.has(active) ? active : fallback.id

  return {
    subjects: nextSubjects,
    decks: nextDecks,
    removedSubjectIds: deduped.removed,
    subjectUpserts,
    deckUpserts: [...deckUpserts],
    activeSubjectId,
  }
}

function dedupePresets(subjects: Subject[]): {
  subjects: Subject[]
  replace: Map<string, string>
  removed: string[]
} {
  const groups = new Map<string, Subject[]>()
  const rest: Subject[] = []
  for (const subject of subjects) {
    if (!subject.presetId) {
      rest.push(subject)
      continue
    }
    const list = groups.get(subject.presetId) ?? []
    list.push(subject)
    groups.set(subject.presetId, list)
  }
  const kept = [...rest]
  const replace = new Map<string, string>()
  const removed: string[] = []
  for (const list of groups.values()) {
    const [winner, ...dupes] = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    kept.push(winner)
    for (const dupe of dupes) {
      replace.set(dupe.id, winner.id)
      removed.push(dupe.id)
    }
  }
  kept.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { subjects: kept, replace, removed }
}

export function cardsInSubject(cards: Card[], decks: Deck[], subjectId: string | undefined): Card[] {
  if (!subjectId) return cards
  const ids = new Set(decks.filter((deck) => deck.subjectId === subjectId).map((deck) => deck.id))
  return cards.filter((card) => ids.has(card.deckId))
}

export function decksInSubject(decks: Deck[], subjectId: string | undefined): Deck[] {
  if (!subjectId) return decks
  return decks.filter((deck) => deck.subjectId === subjectId)
}
