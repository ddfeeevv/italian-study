import type { Card, Deck, DeckKind, Subject } from '../types/models'
import type { CardRow, DeckRow, SubjectRow } from './supabase'

/** Stored in `description` so exercise sets sync without a schema change. */
const EXERCISE_MARK = '[[exercise]]\n'

export function normalizeDeck(deck: Deck): Deck {
  const raw = deck.description ?? ''
  const marked = raw.startsWith(EXERCISE_MARK)
  const kind: DeckKind = deck.kind === 'exercise' || marked ? 'exercise' : 'words'
  return {
    ...deck,
    kind,
    description: marked ? raw.slice(EXERCISE_MARK.length) : raw,
  }
}

export function mapSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    kind: row.kind === 'topic' ? 'topic' : 'language',
    locale: row.locale ?? null,
    accents: row.accents ?? [],
    answerScript: row.answer_script ?? 'any',
    promptScript: row.prompt_script ?? 'any',
    speechLabel: row.speech_label ?? '',
    presetId: row.preset_id ?? null,
    createdAt: row.created_at,
  }
}

export function toSubjectRow(subject: Subject): SubjectRow {
  return {
    id: subject.id,
    user_id: subject.userId,
    title: subject.title,
    kind: subject.kind,
    locale: subject.locale,
    accents: subject.accents,
    answer_script: subject.answerScript,
    prompt_script: subject.promptScript,
    speech_label: subject.speechLabel,
    preset_id: subject.presetId,
    created_at: subject.createdAt,
  }
}

export function mapDeck(row: DeckRow): Deck {
  return normalizeDeck({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? '',
    color: row.color ?? undefined,
    subjectId: row.subject_id ?? undefined,
    createdAt: row.created_at,
  })
}

export function toDeckRow(deck: Deck, includeSubject = true): DeckRow {
  const clean = deck.description.startsWith(EXERCISE_MARK)
    ? deck.description.slice(EXERCISE_MARK.length)
    : deck.description
  const row: DeckRow = {
    id: deck.id,
    user_id: deck.userId,
    title: deck.title,
    description: deck.kind === 'exercise' ? EXERCISE_MARK + clean : clean,
    color: deck.color ?? null,
    created_at: deck.createdAt,
  }
  if (includeSubject) row.subject_id = deck.subjectId ?? null
  return row
}

export function mapCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deck_id,
    userId: row.user_id,
    type: row.type,
    term: row.term,
    translation: row.translation,
    sentence: row.sentence ?? undefined,
    target: row.target,
    options: Array.isArray(row.options) ? row.options : [],
    explanation: row.explanation ?? undefined,
    notes: row.notes ?? undefined,
    stage: row.stage,
    nextReviewDate: row.next_review_date,
    createdAt: row.created_at,
  }
}

export function toCardRow(card: Card): CardRow {
  return {
    id: card.id,
    deck_id: card.deckId,
    user_id: card.userId,
    type: card.type,
    term: card.term,
    translation: card.translation,
    sentence: card.sentence ?? null,
    target: card.target,
    options: card.options,
    explanation: card.explanation ?? null,
    notes: card.notes ?? null,
    stage: card.stage,
    next_review_date: card.nextReviewDate,
    created_at: card.createdAt,
  }
}
