import type { Card, Deck } from '../types/models'
import { needsIntroduction } from './srs'
import { isProductionForm, productionProfile, writtenScript, type ProductionProfile, type WrittenScript } from './subjects'
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
  attempts?: number
}

export type SessionRuntime = {
  phase: SessionPhase
  /** Fixed card ids for this session batch */
  batchIds: string[]
  /** Transform cards without explicit options — skip Tier 1 MC */
  skipMcIds: string[]
  queue: QueueItem[]
  current: QueueItem | null
  total: number
  completedIds: string[]
  failedIds: string[]
  passedTier1: string[]
  /** This batch still has a first-meeting card, so phase 1 is the introduction. */
  hasPreview: boolean
  status: 'active' | 'complete' | 'empty'
}

function pickBatchSize(available: number): number {
  if (available <= BATCH_SIZE_MIN) return available
  const span = BATCH_SIZE_MAX - BATCH_SIZE_MIN
  return Math.min(available, BATCH_SIZE_MIN + Math.floor(Math.random() * (span + 1)))
}

export function needsMultipleChoice(card: Card): boolean {
  if ((card.options?.length ?? 0) > 0) return true
  if (card.type === 'transform') return false
  return true
}

export function createSession(
  cards: Card[],
  options?: { takeAll?: boolean; limit?: number; skipPreview?: boolean },
): SessionRuntime {
  const unique = uniqueById(cards)
  if (unique.length === 0) return emptySession()

  let batch: Card[]
  if (typeof options?.limit === 'number') {
    const n = Math.max(0, Math.floor(options.limit))
    batch = n === 0 ? [] : shuffle(unique).slice(0, Math.min(n, unique.length))
  } else if (options?.takeAll) {
    batch = shuffle(unique)
  } else {
    batch = shuffle(unique).slice(0, pickBatchSize(unique.length))
  }
  if (batch.length === 0) return emptySession()
  const batchIds = batch.map((card) => card.id)
  const byId = new Map(batch.map((card) => [card.id, card]))
  const skipMcIds = batch.filter((card) => !needsMultipleChoice(card)).map((card) => card.id)

  const previewQueue: QueueItem[] = options?.skipPreview
    ? []
    : shuffle(
        batchIds.filter((id) => {
          const card = byId.get(id)
          return card ? needsIntroduction(card) : false
        }),
      ).map((cardId) => ({ cardId, tier: 0 as const }))

  const shell: SessionRuntime = {
    phase: 'preview',
    batchIds,
    skipMcIds,
    queue: [],
    current: null,
    total: batchIds.length,
    completedIds: [],
    failedIds: [],
    passedTier1: [],
    hasPreview: previewQueue.length > 0,
    status: 'active',
  }

  if (previewQueue.length === 0) return startMcPhase(shell)

  const [current, ...rest] = previewQueue
  return {
    ...shell,
    queue: rest,
    current,
  }
}

function emptySession(): SessionRuntime {
  return {
    phase: 'mc',
    batchIds: [],
    skipMcIds: [],
    queue: [],
    current: null,
    total: 0,
    completedIds: [],
    failedIds: [],
    passedTier1: [],
    hasPreview: false,
    status: 'empty',
  }
}

/** Exam miss: record it and move on. The card is not asked again. */
export function applyExamMiss(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current
  if (tier === 0) return applyPreviewDone(runtime)

  const failedIds = runtime.failedIds.includes(cardId) ? runtime.failedIds : [...runtime.failedIds, cardId]
  if (tier === 1) return nextQuestion(runtime, runtime.queue, { failedIds })

  const completedIds = runtime.completedIds.includes(cardId)
    ? runtime.completedIds
    : [...runtime.completedIds, cardId]
  return nextQuestion(runtime, runtime.queue, { failedIds, completedIds })
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

/** Miss: ask again later in this phase. No attempt cap — the learner stops with `applyMoveOn`. */
export function applyIncorrect(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current
  if (tier === 0) return applyPreviewDone(runtime)

  const currentAttempts = (runtime.current.attempts ?? 0) + 1
  const failedIds = runtime.failedIds.includes(cardId)
    ? runtime.failedIds
    : [...runtime.failedIds, cardId]
  const queue = insertLater(
    runtime.queue,
    { cardId, tier, attempts: currentAttempts },
    RETRY_GAP_MIN,
    RETRY_GAP_MAX,
  )
  return nextQuestion(runtime, queue, { failedIds })
}

/** Miss, and the learner does not want this card again in the session. */
export function applyMoveOn(runtime: SessionRuntime): SessionRuntime {
  if (!runtime.current) return runtime
  const { cardId, tier } = runtime.current
  if (tier === 0) return applyPreviewDone(runtime)

  const failedIds = runtime.failedIds.includes(cardId)
    ? runtime.failedIds
    : [...runtime.failedIds, cardId]
  if (tier === 1) return nextQuestion(runtime, runtime.queue, { failedIds })

  const completedIds = runtime.completedIds.includes(cardId)
    ? runtime.completedIds
    : [...runtime.completedIds, cardId]
  return nextQuestion(runtime, runtime.queue, { failedIds, completedIds })
}

export function shouldAdvance(runtime: SessionRuntime, cardId: string): boolean {
  return !runtime.failedIds.includes(cardId) && runtime.passedTier1.includes(cardId)
}

export function cardAnswer(card: Card): string {
  return card.target || card.term
}

/** Other decks of the same subject and kind supply distractors. */
export function sameKindPool(card: Card, cards: Card[], decks: Deck[]): Card[] {
  const byId = new Map(decks.map((deck) => [deck.id, deck]))
  const deck = byId.get(card.deckId)
  const kind = deck?.kind === 'exercise' ? 'exercise' : 'words'
  const subjectId = deck?.subjectId
  return cards.filter((item) => {
    const other = byId.get(item.deckId)
    const otherKind = other?.kind === 'exercise' ? 'exercise' : 'words'
    if (otherKind !== kind) return false
    if (subjectId && other?.subjectId && other.subjectId !== subjectId) return false
    return true
  })
}

const MC_OPTION_COUNT = 4
const HONEST_DISTRACTORS = MC_OPTION_COUNT - 1
/** First token at most this long can be a repeated particle ("il", "the", "der"). */
const SHORT_TOKEN_MAX = 3
const SUFFIX_LENGTHS = [4, 3, 2] as const

type AnswerForm = {
  raw: string
  script: WrittenScript
  wordCount: number
  /** Short first token, lowercased, when the answer is more than one word. */
  first: string | null
  /** Last word, lowercased, without diacritics or edge punctuation. */
  last: string
  length: number
}

/**
 * If `card.options` is set — use those exact choices (shuffled).
 * Otherwise prefer distractors of the same visible form (script, word count,
 * repeated short first token, repeated ending, similar length). `subjectPool`
 * may include other decks of the same subject. Fewer than three such neighbors
 * falls back to the previous same-deck selection.
 * Transform without options should skip MC entirely (`needsMultipleChoice`).
 */
export function buildChoices(
  card: Card,
  pool: Card[],
  subjectPool: Card[] = pool,
  profile: ProductionProfile = productionProfile(null),
): string[] {
  const correct = cardAnswer(card).trim()
  const correctKey = normalizeAnswer(correct)
  const explicit = (card.options ?? []).map((option) => option.trim()).filter(Boolean)

  if (explicit.length > 0) {
    const options: string[] = []
    for (const option of explicit) {
      if (!options.some((item) => normalizeAnswer(item) === normalizeAnswer(option))) {
        options.push(option)
      }
    }
    // Keep the keyed answer playable if the author omitted it from the list
    if (correct && !options.some((item) => normalizeAnswer(item) === correctKey)) {
      options.unshift(correct)
    }
    return shuffle(options)
  }

  const honest = honestDistractors(correct, card.id, subjectPool, profile)
  if (honest.length >= HONEST_DISTRACTORS) {
    return shuffle([correct, ...shuffle(honest).slice(0, HONEST_DISTRACTORS)])
  }

  return legacyChoices(card, pool, correct, correctKey, profile)
}

function legacyChoices(
  card: Card,
  pool: Card[],
  correct: string,
  correctKey: string,
  profile: ProductionProfile,
): string[] {
  const fromPool = shuffle(
    pool.filter((item) => item.id !== card.id && item.type === card.type),
  )
    .map((item) => (item.target || '').trim())
    .filter((term) => term.length > 0 && normalizeAnswer(term) !== correctKey)
    .filter((term) => isProductionForm(term, profile))

  const fromAny = shuffle(pool.filter((item) => item.id !== card.id))
    .map((item) => (item.target || '').trim())
    .filter((term) => term.length > 0 && normalizeAnswer(term) !== correctKey)
    .filter((term) => isProductionForm(term, profile))

  const extras = profile.fallbacks[card.type].filter(
    (term) => normalizeAnswer(term) !== correctKey && isProductionForm(term, profile),
  )

  const options = correct ? [correct] : []
  for (const term of [...fromPool, ...fromAny, ...extras]) {
    if (options.length >= MC_OPTION_COUNT) break
    if (!options.some((option) => normalizeAnswer(option) === normalizeAnswer(term))) {
      options.push(term)
    }
  }
  if (options.length < 2) options.push('—')

  return shuffle(options)
}

/**
 * Distractors that share the answer's shape, learned from the pool rather than
 * from a language word list. A repeated short first word (or a repeated
 * apostrophe particle such as "l'") is the group. Otherwise the longest shared
 * ending that still has three neighbors is the group.
 */
function honestDistractors(correct: string, cardId: string, pool: Card[], profile: ProductionProfile): string[] {
  if (!correct || !isProductionForm(correct, profile)) return []
  const particles = repeatedParticles([
    correct,
    ...pool.filter((item) => item.id !== cardId).map((item) => (item.target || '').trim()),
  ])
  const answer = answerForm(correct, particles)
  if (!answer) return []

  const forms = distinctForms(pool, cardId, normalizeAnswer(correct), particles, profile)
  const close = forms.filter((form) => sameSlot(answer, form) && lengthClose(form.length, answer.length))
  if (answer.first && close.length >= HONEST_DISTRACTORS) {
    return close.map((form) => form.raw)
  }

  const ending = endingWithEnoughNeighbors(answer, close)
  if (!ending) return []
  return close.filter((form) => form.last.endsWith(ending)).map((form) => form.raw)
}

function distinctForms(
  pool: Card[],
  cardId: string,
  correctKey: string,
  particles: Set<string>,
  profile: ProductionProfile,
): AnswerForm[] {
  const seen = new Set<string>()
  const forms: AnswerForm[] = []
  for (const item of pool) {
    if (item.id === cardId) continue
    const raw = (item.target || '').trim()
    if (!raw || !isProductionForm(raw, profile)) continue
    const key = normalizeAnswer(raw)
    if (!key || key === correctKey || seen.has(key)) continue
    const form = answerForm(raw, particles)
    if (!form) continue
    seen.add(key)
    forms.push(form)
  }
  return forms
}

function answerForm(raw: string, particles: Set<string>): AnswerForm | null {
  const trimmed = raw.trim()
  const parts = withParticleSplit(trimmed, particles).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const cores = parts.map(tokenCore)
  const last = cores[cores.length - 1] ?? ''
  if (!last) return null
  const firstCore = cores[0] ?? ''
  const first =
    parts.length >= 2 && firstCore.length >= 1 && firstCore.length <= SHORT_TOKEN_MAX ? firstCore : null
  return {
    raw: trimmed,
    script: writtenScript(trimmed),
    wordCount: parts.length,
    first,
    last,
    length: trimmed.length,
  }
}

/** "l'amico" → "l amico" when that apostrophe particle shows up more than once. */
function withParticleSplit(raw: string, particles: Set<string>): string {
  const match = raw.match(/^(\p{L}{1,3})['’]\s*/u)
  if (!match) return raw
  const particle = match[1].toLowerCase()
  if (!particles.has(particle)) return raw
  const rest = raw.slice(match[0].length).trim()
  if (!rest) return raw
  return `${particle} ${rest}`
}

function repeatedParticles(values: string[]): Set<string> {
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  for (const value of values) {
    const key = normalizeAnswer(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const match = value.trim().match(/^(\p{L}{1,3})['’]/u)
    if (!match) continue
    const particle = match[1].toLowerCase()
    counts.set(particle, (counts.get(particle) ?? 0) + 1)
  }
  return new Set([...counts].filter(([, count]) => count >= 2).map(([particle]) => particle))
}

function endingWithEnoughNeighbors(answer: AnswerForm, close: AnswerForm[]): string | null {
  for (const size of SUFFIX_LENGTHS) {
    if (answer.last.length <= size) continue
    const suffix = answer.last.slice(-size)
    const count = close.filter((form) => form.last.length > size && form.last.endsWith(suffix)).length
    if (count >= HONEST_DISTRACTORS) return suffix
  }
  return null
}

function tokenCore(token: string): string {
  return stripDiacritics(token.toLowerCase()).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function sameSlot(answer: AnswerForm, form: AnswerForm): boolean {
  return form.script === answer.script && form.wordCount === answer.wordCount && form.first === answer.first
}

function lengthClose(length: number, anchor: number): boolean {
  const shorter = Math.min(length, anchor)
  if (shorter <= 0) return false
  return Math.max(length, anchor) / shorter <= 1.75
}

/** Italian answers: Latin production forms, never a Russian gloss. */
export function isItalianProductionForm(value: string): boolean {
  return isProductionForm(value, productionProfile(null))
}

export function normalizeAnswer(value: string, locale?: string | null): string {
  const compact = value.trim().replace(/\s+/g, ' ')
  if (locale?.toLowerCase().startsWith('tr')) return compact.toLocaleLowerCase('tr')
  return compact.toLowerCase()
}

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

/** ß/ss so a missing eszett still counts as the same German word. */
function foldEquivalents(value: string): string {
  return value.replace(/ß/g, 'ss')
}

export function checkSpelling(
  input: string,
  expectedRaw: string,
  locale?: string | null,
): 'exact' | 'accent' | 'wrong' {
  const answer = normalizeAnswer(input, locale)
  const expected = normalizeAnswer(expectedRaw, locale)
  if (!answer) return 'wrong'
  if (answer === expected) return 'exact'
  if (foldEquivalents(stripDiacritics(answer)) === foldEquivalents(stripDiacritics(expected))) return 'accent'
  return 'wrong'
}

export function splitCloze(sentence: string): [string, string] {
  const [before, after] = sentence.split(/\{blank\}/i)
  return [before ?? '', after ?? '']
}

function startMcPhase(runtime: SessionRuntime): SessionRuntime {
  const skip = new Set(runtime.skipMcIds)
  // Transform without options auto-clear Tier 1 so spelling can still advance SRS
  const passedTier1 = uniqueStrings([...runtime.passedTier1, ...runtime.skipMcIds])
  const mcIds = shuffle(runtime.batchIds.filter((id) => !skip.has(id)))

  if (mcIds.length === 0) {
    return startSpellPhase({
      ...runtime,
      passedTier1,
      queue: [],
      current: null,
    })
  }

  const items: QueueItem[] = mcIds.map((cardId) => ({
    cardId,
    tier: 1 as const,
  }))
  const [current, ...rest] = items
  return {
    ...runtime,
    phase: 'mc',
    passedTier1,
    queue: rest,
    current: current ?? null,
    status: current ? 'active' : 'complete',
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
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
