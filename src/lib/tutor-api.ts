import type { QuotaSnapshot } from './generation-quota'
import { supabase } from './supabase'
import type { SubjectKind } from '../types/models'

export class TutorApiError extends Error {
  readonly code: string
  readonly quota?: QuotaSnapshot

  constructor(code: string, quota?: QuotaSnapshot) {
    super(code)
    this.name = 'TutorApiError'
    this.code = code
    this.quota = quota
  }
}

export type TutorDeckRequest = {
  topic: string
  count: number
  glossLocale: string
  subject: {
    kind: SubjectKind
    title: string
    locale: string | null
    presetId: string | null
  }
  avoid: string[]
}

export type GeneratedCard = {
  term: string
  translation: string
}

export type GeneratedDeck = {
  title: string
  cards: GeneratedCard[]
  requested: number
  limited: boolean
  quota: QuotaSnapshot
}

export async function fetchTutorQuota(): Promise<QuotaSnapshot> {
  const token = await authToken()
  const params = new URLSearchParams({ timeZone: deviceTimeZone() })
  const response = await fetch(`/api/generate-deck?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const payload = await readPayload(response)
  if (!response.ok) fail(response, payload)
  if (!isQuota(payload.quota)) throw new TutorApiError('failed')
  return payload.quota
}

export async function requestTutorDeck(input: TutorDeckRequest): Promise<GeneratedDeck> {
  const token = await authToken()
  const response = await fetch('/api/generate-deck', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ ...input, timeZone: deviceTimeZone() }),
  })
  const payload = await readPayload(response)
  if (!response.ok) fail(response, payload)
  return parseDeck(payload, input.topic)
}

async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new TutorApiError('unauthorized')
  return token
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    throw new TutorApiError('failed')
  }
}

function fail(response: Response, payload: Record<string, unknown>): never {
  const code = typeof payload.error === 'string' ? payload.error : response.status === 401 ? 'unauthorized' : 'failed'
  throw new TutorApiError(code, isQuota(payload.quota) ? payload.quota : undefined)
}

function parseDeck(payload: Record<string, unknown>, fallbackTitle: string): GeneratedDeck {
  const quota = isQuota(payload.quota) ? payload.quota : undefined
  if (!quota) throw new TutorApiError('failed')
  const cards: GeneratedCard[] = []
  if (Array.isArray(payload.cards)) {
    for (const item of payload.cards) {
      if (!item || typeof item !== 'object') continue
      const card = item as { term?: unknown; translation?: unknown }
      const term = typeof card.term === 'string' ? card.term.trim() : ''
      const translation = typeof card.translation === 'string' ? card.translation.trim() : ''
      if (!term || !translation) continue
      cards.push({ term, translation })
    }
  }
  if (cards.length < 1) throw new TutorApiError('failed', quota)
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : fallbackTitle
  return {
    title,
    cards,
    requested: typeof payload.requested === 'number' ? payload.requested : cards.length,
    limited: payload.limited === true,
    quota,
  }
}

function isQuota(value: unknown): value is QuotaSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    (item.plan === 'free' || item.plan === 'premium') &&
    typeof item.wordLimit === 'number' &&
    typeof item.wordsUsed === 'number' &&
    typeof item.requestLimit === 'number' &&
    typeof item.requestsUsed === 'number'
  )
}
