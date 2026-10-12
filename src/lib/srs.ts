import type { Card, CardType, Stage } from '../types/models'
import { addDays, nowIso, startOfDay, uid } from './utils'

export const STAGE_INTERVALS_DAYS: Record<Stage, number> = {
  0: 1,
  1: 3,
  2: 7,
  3: 14,
  4: 30,
  5: 30,
}

export function isDue(card: Card, now = new Date()): boolean {
  return new Date(card.nextReviewDate).getTime() <= now.getTime()
}

export function dueCards(cards: Card[], now = new Date()): Card[] {
  return cards.filter((card) => isDue(card, now))
}

export function intervalDaysForStage(stage: Stage): number {
  return STAGE_INTERVALS_DAYS[stage]
}

export function nextStage(stage: Stage): Stage {
  return Math.min(5, stage + 1) as Stage
}

export function advanceCard(card: Card, now = new Date()): Card {
  const days = intervalDaysForStage(card.stage)
  return {
    ...card,
    stage: nextStage(card.stage),
    nextReviewDate: addDays(startOfDay(now), days).toISOString(),
  }
}

export function failCard(card: Card, now = new Date()): Card {
  return {
    ...card,
    stage: 0,
    nextReviewDate: addDays(startOfDay(now), 1).toISOString(),
  }
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
