import type { AppData, Settings } from '../types/models'

export const SETTINGS_KEY = 'parola:settings'

export function cacheKey(userId: string): string {
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
    version: 2,
    decks: [],
    cards: [],
    settings,
  }
}

export function loadCache(userId: string): AppData | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppData
    if (parsed.version !== 2 || !Array.isArray(parsed.decks) || !Array.isArray(parsed.cards)) {
      return null
    }
    return {
      version: 2,
      decks: parsed.decks,
      cards: parsed.cards,
      settings: loadSettings(),
    }
  } catch {
    return null
  }
}

export function saveCache(userId: string, data: AppData): void {
  localStorage.setItem(
    cacheKey(userId),
    JSON.stringify({ version: 2, decks: data.decks, cards: data.cards }),
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
