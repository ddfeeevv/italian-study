import type { Card } from '../types/models'
import { insertLater, shuffle } from './utils'

/** Session takes one batch of this many cards (clamped to available). */
export const BATCH_SIZE_MIN = 5
export const BATCH_SIZE_MAX = 7

/** @deprecated use BATCH_SIZE_MAX — kept for UI copy compatibility */
export const SESSION_CARD_LIMIT = BATCH_SIZE_MAX

/** Gap when re-queuing a failed item inside the current phase. */
export const RETRY_GAP_MIN = 2
export const RETRY_GAP_MAX = 4

export type SessionPhase = 'preview' | 'mc' | 'spell'

/** 0 = vocab preview, 1 = multiple choice, 2 = spelling / production */
export type SessionTier = 0 | 1 | 2

export type QueueItem = {
  cardId: string
  tier: SessionTier
}

export type SessionRuntime = {
  phase: SessionPhase
  /** Fixed card ids for this session batch */
  batchIds: string[]
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

function pickBatchSize(available: number): number {
  if (available <= BATCH_SIZE_MIN) return available
  const span = BATCH_SIZE_MAX - BATCH_SIZE_MIN
  return Math.min(available, BATCH_SIZE_MIN + Math.floor(Math.random() * (span + 1)))
}

export function createSession(cards: Card[]): SessionRuntime {
  const unique = uniqueById(cards)
  if (unique.length === 0) {
    return {
      phase: 'mc',
      batchIds: [],
      queue: [],
      current: null,
      total: 0,
      completedIds: [],
      failedIds: [],
      passedTier1: [],
      status: 'empty',
    }
  }

  const batch = shuffle(unique).slice(0, pickBatchSize(unique.length))
  const batchIds = batch.map((card) => card.id)
  const byId = new Map(batch.map((card) => [card.id, card]))

  const previewQueue: QueueItem[] = shuffle(
    batchIds.filter((id) => byId.get(id)?.type === 'vocab'),
  ).map((cardId) => ({ cardId, tier: 0 as const }))

  if (previewQueue.length > 0) {
    const [current, ...rest] = previewQueue
    return {
      phase: 'preview',
      batchIds,
      queue: rest,
      current,
      total: batchIds.length,
      completedIds: [],
      failedIds: [],
      passedTier1: [],
      status: 'active',
    }
  }

  return startMcPhase({
    phase: 'preview',
    batchIds,
    queue: [],
    current: null,
    total: batchIds.length,
    completedIds: [],
    failedIds: [],
    passedTier1: [],
    status: 'active',
  })
}

export function applyPreviewDone(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current || runtime.current.tier !== 0) return runtime
  // Finish remaining vocab previews before any testing
  if (runtime.queue.length > 0) {
    return nextQuestion(runtime, runtime.queue, {})
  }
  return startMcPhase(runtime)
}

export function applyCorrect(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current

  if (tier === 0) {
    return applyPreviewDone(runtime)
  }

  if (tier === 1) {
    const passedTier1 = runtime.passedTier1.includes(cardId)
      ? runtime.passedTier1
      : [...runtime.passedTier1, cardId]
    if (runtime.queue.length > 0) {
      return nextQuestion(runtime, runtime.queue, { passedTier1 })
    }
    return startSpellPhase({ ...runtime, passedTier1, current: null, queue: [] })
  }

  // Tier 2 done
  const completedIds = runtime.completedIds.includes(cardId)
    ? runtime.completedIds
    : [...runtime.completedIds, cardId]
  return nextQuestion(runtime, runtime.queue, { completedIds })
}

export function applyIncorrect(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current
  if (tier === 0) return applyPreviewDone(runtime)

  const failedIds = runtime.failedIds.includes(cardId)
    ? runtime.failedIds
    : [...runtime.failedIds, cardId]
  const queue = insertLater(runtime.queue, { cardId, tier }, RETRY_GAP_MIN, RETRY_GAP_MAX)
  return nextQuestion(runtime, queue, { failedIds })
}

export function shouldAdvance(runtime: SessionRuntime, cardId: string): boolean {
  return !runtime.failedIds.includes(cardId) && runtime.passedTier1.includes(cardId)
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

function startMcPhase(runtime: SessionRuntime): SessionRuntime {
  const items: QueueItem[] = shuffle(runtime.batchIds).map((cardId) => ({
    cardId,
    tier: 1 as const,
  }))
  const [current, ...rest] = items
  return {
    ...runtime,
    phase: 'mc',
    queue: rest,
    current: current ?? null,
    status: current ? 'active' : 'complete',
  }
}

function startSpellPhase(runtime: SessionRuntime): SessionRuntime {
  const items: QueueItem[] = shuffle(runtime.batchIds).map((cardId) => ({
    cardId,
    tier: 2 as const,
  }))
  const [current, ...rest] = items
  return {
    ...runtime,
    phase: 'spell',
    queue: rest,
    current: current ?? null,
    status: current ? 'active' : 'complete',
  }
}

function nextQuestion(
  runtime: SessionRuntime,
  queue: QueueItem[],
  patch: Partial<SessionRuntime>,
): SessionRuntime {
  const [current, ...rest] = queue

  // End of MC phase → start production phase
  if (!current && runtime.phase === 'mc' && (patch.phase === undefined || patch.phase === 'mc')) {
    const merged = { ...runtime, ...patch, queue: rest, current: null }
    return startSpellPhase(merged)
  }

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
