import type { Card } from '../types/models'
import { insertLater, shuffle } from './utils'

/** Max unique cards in one study/practice session. */
export const SESSION_CARD_LIMIT = 10

/** Min/max other queue items between MC success and spelling for the same card. */
export const SPELLING_GAP_MIN = 3
export const SPELLING_GAP_MAX = 5

export type SessionTier = 0 | 1 | 2

export type QueueItem = {
  cardId: string
  tier: SessionTier
}

export type SessionRuntime = {
  queue: QueueItem[]
  current: QueueItem | null
  total: number
  completedIds: string[]
  failedIds: string[]
  passedTier1: string[]
  status: 'active' | 'complete' | 'empty'
}

const FALLBACKS: Record<Card['type'], string[]> = {
  vocab: ['ciao', 'grazie', 'prego', 'bene', 'oggi', 'sempre', 'ancora', 'perché'],
  cloze: ['prendo', 'prendiamo', 'prendete', 'prendono', 'parlo', 'parliamo', 'il', 'lo', 'la', 'gli'],
  transform: ['le case nuove', 'i ragazzi alti', 'gli amici cari', 'le amiche nuove', 'questi libri'],
}

export function createSession(cards: Card[]): SessionRuntime {
  const unique = uniqueById(cards)
  const batch = shuffle(unique).slice(0, SESSION_CARD_LIMIT)
  // Start with familiarization, then MC, then spaced spelling
  const queue: QueueItem[] = batch.map((card) => ({
    cardId: card.id,
    tier: 0,
  }))
  const [current, ...rest] = queue

  return {
    queue: rest,
    current: current ?? null,
    total: batch.length,
    completedIds: [],
    failedIds: [],
    passedTier1: [],
    status: current ? 'active' : 'empty',
  }
}

/** After preview — go straight into Multiple Choice for the same card. */
export function applyPreviewDone(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current || runtime.current.tier !== 0) return runtime
  return {
    ...runtime,
    current: { cardId: runtime.current.cardId, tier: 1 },
  }
}

export function applyCorrect(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current

  if (tier === 0) {
    return applyPreviewDone(runtime)
  }

  if (tier === 1) {
    const nextItem: QueueItem = { cardId, tier: 2 }
    const queue = insertLater(runtime.queue, nextItem, SPELLING_GAP_MIN, SPELLING_GAP_MAX)
    return nextQuestion(runtime, queue, {
      passedTier1: [...runtime.passedTier1, cardId],
    })
  }

  return nextQuestion(runtime, runtime.queue, {
    completedIds: [...runtime.completedIds, cardId],
  })
}

export function applyIncorrect(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current
  if (tier === 0) return applyPreviewDone(runtime)

  const failedIds = runtime.failedIds.includes(cardId)
    ? runtime.failedIds
    : [...runtime.failedIds, cardId]
  const queue = insertLater(runtime.queue, { cardId, tier }, SPELLING_GAP_MIN, SPELLING_GAP_MAX)
  return nextQuestion(runtime, queue, { failedIds })
}

export function shouldAdvance(runtime: SessionRuntime, cardId: string): boolean {
  return !runtime.failedIds.includes(cardId)
}

export function cardAnswer(card: Card): string {
  return card.target || card.term
}

export function buildChoices(card: Card, pool: Card[]): string[] {
  const correct = cardAnswer(card)
  const provided = card.options.filter((option) => normalizeAnswer(option) !== normalizeAnswer(correct))
  const fromPool = shuffle(
    pool.filter((item) => item.id !== card.id && item.type === card.type),
  )
    .map((item) => cardAnswer(item))
    .filter((term) => normalizeAnswer(term) !== normalizeAnswer(correct))

  const extras = FALLBACKS[card.type].filter(
    (term) => normalizeAnswer(term) !== normalizeAnswer(correct),
  )

  const options = [correct]
  for (const term of [...provided, ...fromPool, ...extras]) {
    if (options.length >= 4) break
    if (!options.some((option) => normalizeAnswer(option) === normalizeAnswer(term))) {
      options.push(term)
    }
  }

  return shuffle(options)
}

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

export function checkSpelling(
  input: string,
  expectedRaw: string,
): 'exact' | 'accent' | 'wrong' {
  const answer = normalizeAnswer(input)
  const expected = normalizeAnswer(expectedRaw)
  if (!answer) return 'wrong'
  if (answer === expected) return 'exact'
  if (stripDiacritics(answer) === stripDiacritics(expected)) return 'accent'
  return 'wrong'
}

export const ITALIAN_ACCENTS = ['à', 'è', 'é', 'ì', 'ò', 'ù'] as const

export function splitCloze(sentence: string): [string, string] {
  const [before, after] = sentence.split(/\{blank\}/i)
  return [before ?? '', after ?? '']
}

function nextQuestion(
  runtime: SessionRuntime,
  queue: QueueItem[],
  patch: Partial<SessionRuntime>,
): SessionRuntime {
  const [current, ...rest] = queue
  return {
    ...runtime,
    ...patch,
    queue: rest,
    current: current ?? null,
    status: current ? 'active' : 'complete',
  }
}

function uniqueById(cards: Card[]): Card[] {
  const seen = new Set<string>()
  return cards.filter((card) => {
    if (seen.has(card.id)) return false
    seen.add(card.id)
    return true
  })
}
