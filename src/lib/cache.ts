import { normalizeDeck } from './mappers'
import type { AppData, Card, Deck, Settings, Subject } from '../types/models'

export const SETTINGS_KEY = 'parola:settings'

export function cacheKey(userId: string): string {
  return `parola:cache:v3:${userId}`
}

function legacyCacheKey(userId: string): string {
  return `parola:cache:v2:${userId}`
}

export function queueKey(userId: string): string {
  return `parola:queue:v2:${userId}`
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  autoPlayAudio: true,
}

export function emptyData(settings: Settings = DEFAULT_SETTINGS): AppData {
  return {
    version: 3,
    subjects: [],
    decks: [],
    cards: [],
    settings,
  }
}

export function loadCache(userId: string): AppData | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId)) ?? localStorage.getItem(legacyCacheKey(userId))
    if (!raw) return null
    return parseCache(raw)
  } catch {
    return null
  }
}

function parseCache(raw: string): AppData | null {
  const parsed = JSON.parse(raw) as { version?: number; decks?: Deck[]; cards?: Card[]; subjects?: Subject[] }
  if ((parsed.version !== 2 && parsed.version !== 3) || !Array.isArray(parsed.decks) || !Array.isArray(parsed.cards)) {
    return null
  }
  const subjects = Array.isArray(parsed.subjects) ? (parsed.subjects as Subject[]) : []
  return {
    version: 3,
    subjects,
    decks: parsed.decks.map((deck) => normalizeDeck(deck)),
    cards: parsed.cards,
    settings: loadSettings(),
  }
}

export function saveCache(userId: string, data: AppData): void {
  localStorage.setItem(
    cacheKey(userId),
    JSON.stringify({ version: 3, subjects: data.subjects, decks: data.decks, cards: data.cards }),
  )
  saveSettings(data.settings)
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export type PendingOp =
  | { kind: 'upsert-subject'; id: string }
  | { kind: 'delete-subject'; id: string }
  | { kind: 'upsert-deck'; id: string }
  | { kind: 'delete-deck'; id: string }
  | { kind: 'upsert-card'; id: string }
  | { kind: 'delete-card'; id: string }

export function loadQueue(userId: string): PendingOp[] {
  try {
    const raw = localStorage.getItem(queueKey(userId))
    return raw ? (JSON.parse(raw) as PendingOp[]) : []
  } catch {
    return []
  }
}

export function saveQueue(userId: string, queue: PendingOp[]): void {
  localStorage.setItem(queueKey(userId), JSON.stringify(queue))
}
