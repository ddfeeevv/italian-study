import type { Card, Deck } from '../types/models'
import type { CardRow, DeckRow } from './supabase'

export function mapDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? '',
    color: row.color ?? undefined,
    createdAt: row.created_at,
  }
}

export function toDeckRow(deck: Deck): DeckRow {
  return {
    id: deck.id,
    user_id: deck.userId,
    title: deck.title,
    description: deck.description,
    color: deck.color ?? null,
    created_at: deck.createdAt,
  }
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
    options: row.options ?? [],
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
