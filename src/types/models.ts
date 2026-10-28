export type Stage = 0 | 1 | 2 | 3 | 4 | 5

export type CardType = 'vocab' | 'cloze' | 'transform'

export type DeckKind = 'words' | 'exercise'

export type SubjectKind = 'language' | 'topic'

/** Script of the answer or of the prompt. `any` is a subject without a language. */
export type Script = 'latin' | 'cyrillic' | 'cjk' | 'hangul' | 'arabic' | 'greek' | 'devanagari' | 'any'

export type Subject = {
  id: string
  userId: string
  title: string
  kind: SubjectKind
  /** BCP-47 voice. Empty for a topic. */
  locale: string | null
  accents: string[]
  answerScript: Script
  promptScript: Script
  /** Russian phrase after «Произнести», e.g. «по-итальянски». */
  speechLabel: string
  presetId: string | null
  createdAt: string
}

export type Deck = {
  id: string
  userId: string
  title: string
  description: string
  color?: string
  kind?: DeckKind
  subjectId?: string
  createdAt: string
}

export type Card = {
  id: string
  deckId: string
  userId: string
  type: CardType
  term: string
  translation: string
  sentence?: string
  target: string
  options: string[]
  explanation?: string
  notes?: string
  stage: Stage
  nextReviewDate: string
  createdAt: string
}

export type ThemePreference = 'light' | 'dark' | 'system'

/** Days between successful reviews. One to five steps. The last step repeats once the word is learned. */
export type IntervalSchedule = number[]

export type Settings = {
  theme: ThemePreference
  autoPlayAudio: boolean
  activeSubjectId?: string
  intervals: IntervalSchedule
}

export type AppData = {
  version: 3
  subjects: Subject[]
  decks: Deck[]
  cards: Card[]
  settings: Settings
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

export const STAGE_LABELS: Record<Stage, string> = {
  0: 'Новая',
  1: '1 день',
  2: '3 дня',
  3: '7 дней',
  4: '14 дней',
  5: '30 дней',
}

export const TYPE_LABELS: Record<CardType, string> = {
  vocab: 'Слово',
  cloze: 'Пропуск',
  transform: 'Форма',
}
