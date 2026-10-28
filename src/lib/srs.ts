import type { Card, CardType, IntervalSchedule, Stage } from '../types/models'
import { addDays, nowIso, startOfDay, uid } from './utils'

/**
 * Default ladder: 1 → 3 → 7 → 14 → 30 days. One to five steps.
 * The last step is where a word counts as learned; further passes keep that gap.
 * A miss uses the first step.
 */
export const DEFAULT_INTERVALS: IntervalSchedule = [1, 3, 7, 14, 30]
export const MIN_INTERVAL_STEPS = 1
export const MAX_INTERVAL_STEPS = 5

export const STAGE_INTERVALS_DAYS: Record<Stage, number> = {
  0: DEFAULT_INTERVALS[0],
  1: DEFAULT_INTERVALS[1],
  2: DEFAULT_INTERVALS[2],
  3: DEFAULT_INTERVALS[3],
  4: DEFAULT_INTERVALS[4],
  5: DEFAULT_INTERVALS[4],
}

const MAX_INTERVAL_DAYS = 365

export function clampIntervalDays(value: number, min = 1): number {
  if (!Number.isFinite(value)) return min
  return Math.min(MAX_INTERVAL_DAYS, Math.max(min, Math.round(value)))
}

export function normalizeIntervals(value: unknown): IntervalSchedule {
  if (!Array.isArray(value) || value.length === 0) return [...DEFAULT_INTERVALS]
  const days = value
    .slice(0, MAX_INTERVAL_STEPS)
    .map((item) => {
      const parsed = Number(item)
      if (!Number.isFinite(parsed)) return null
      return clampIntervalDays(parsed, 1)
    })
    .filter((item): item is number => item !== null)
  return days.length > 0 ? days : [...DEFAULT_INTERVALS]
}

/** Next gap when the learner adds a step: about twice the previous one. */
export function suggestIntervalStep(steps: number[]): number {
  const last = steps[steps.length - 1] ?? 1
  return clampIntervalDays(last * 2, 1)
}

export function isDue(card: Card, now = new Date()): boolean {
  return new Date(card.nextReviewDate).getTime() <= now.getTime()
}

/**
 * First meeting only. A fresh vocab card is stage 0 and due at the moment it
 * was created. After a pass (stage moves up) or a fail (review is pushed to
 * the next day) the card comes back as a quiz, without showing the answer first.
 */
export function needsIntroduction(card: Card): boolean {
  if (card.type !== 'vocab' || card.stage > 0) return false
  const created = new Date(card.createdAt)
  const due = new Date(card.nextReviewDate)
  if (Number.isNaN(created.getTime()) || Number.isNaN(due.getTime())) return true
  return (
    startOfDay(due).getTime() === startOfDay(created).getTime() &&
    due.getTime() - created.getTime() < 60_000
  )
}

export function dueCards(cards: Card[], now = new Date()): Card[] {
  return cards.filter((card) => isDue(card, now))
}

export function vocabCards(cards: Card[]): Card[] {
  return cards.filter((card) => card.type === 'vocab')
}

export function exerciseCards(cards: Card[]): Card[] {
  return cards.filter((card) => card.type === 'cloze' || card.type === 'transform')
}

/** Days a pass at this stage waits. The last step covers every stage after the ladder. */
export function intervalDaysForStage(stage: Stage, intervals?: IntervalSchedule): number {
  const schedule = normalizeIntervals(intervals ?? DEFAULT_INTERVALS)
  return schedule[Math.min(schedule.length - 1, stage)]
}

/** Gap that brought the card to this stage. Stage 0 has none. */
export function stageLabelDays(stage: Stage, intervals?: IntervalSchedule): number | null {
  if (stage <= 0) return null
  const schedule = normalizeIntervals(intervals ?? DEFAULT_INTERVALS)
  if (stage >= 5) return schedule[schedule.length - 1]
  return schedule[Math.min(schedule.length - 1, stage - 1)]
}

/** One pass per step, then stage 5. A shorter ladder reaches “learned” sooner. */
export function nextStage(stage: Stage, intervals?: IntervalSchedule): Stage {
  const schedule = normalizeIntervals(intervals ?? DEFAULT_INTERVALS)
  if (stage >= schedule.length - 1) return 5
  return (stage + 1) as Stage
}

export function advanceCard(card: Card, now = new Date(), intervals?: IntervalSchedule): Card {
  const days = intervalDaysForStage(card.stage, intervals)
  return {
    ...card,
    stage: nextStage(card.stage, intervals),
    nextReviewDate: addDays(startOfDay(now), days).toISOString(),
  }
}

export function failCard(card: Card, now = new Date(), intervals?: IntervalSchedule): Card {
  return {
    ...card,
    stage: 0,
    nextReviewDate: addDays(startOfDay(now), intervalDaysForStage(0, intervals)).toISOString(),
  }
}

/** Set the next review without moving the stage. `0` means due today. */
export function reviewInDays(card: Card, days: number, now = new Date()): Card {
  return {
    ...card,
    nextReviewDate: addDays(startOfDay(now), clampIntervalDays(days, 0)).toISOString(),
  }
}

export function daysUntilReview(iso: string, now = new Date()): number {
  const due = startOfDay(new Date(iso)).getTime()
  const today = startOfDay(now).getTime()
  if (Number.isNaN(due)) return 0
  return Math.round((due - today) / 86_400_000)
}

type NewCardInput = {
  deckId: string
  userId: string
  type?: CardType
  term: string
  translation?: string
  sentence?: string
  target?: string
  options?: string[]
  explanation?: string
  notes?: string
}

export function createCard(input: NewCardInput): Card {
  const type = input.type ?? 'vocab'
  const term = input.term.trim()
  const target = (input.target ?? term).trim()
  return {
    id: uid(),
    deckId: input.deckId,
    userId: input.userId,
    type,
    term,
    translation: (input.translation ?? '').trim(),
    sentence: input.sentence?.trim() || undefined,
    target,
    options: (input.options ?? []).map((option) => option.trim()).filter(Boolean),
    explanation: input.explanation?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    stage: 0,
    nextReviewDate: nowIso(),
    createdAt: nowIso(),
  }
}

export function masteredCount(cards: Card[]): number {
  return cards.filter((card) => card.stage === 5).length
}

export function dueCount(cards: Card[], now = new Date()): number {
  return dueCards(cards, now).length
}
