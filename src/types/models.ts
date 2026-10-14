export type Stage = 0 | 1 | 2 | 3 | 4 | 5

export type CardType = 'vocab' | 'cloze' | 'transform'

export type Deck = {
  id: string
  userId: string
  title: string
  description: string
  color?: string
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

export type Settings = {
  theme: ThemePreference
  autoPlayAudio: boolean
}

export type AppData = {
  version: 2
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
