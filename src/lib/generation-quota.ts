/**
 * Daily tutor budget. Everyone is free until billing exists.
 * Premium applies when the Supabase user has app_metadata.plan = "premium"
 * (Authentication → Users → App Metadata). Clients cannot set that field.
 * `words` is how many cards the model may write. `requests` is how many
 * separate model calls that allowance can be split into.
 */
export const PLAN_LIMITS = {
  free: { words: 30, requests: 3 },
  premium: { words: 120, requests: 10 },
} as const

export type PlanId = keyof typeof PLAN_LIMITS

export type QuotaSnapshot = {
  plan: PlanId
  wordLimit: number
  wordsUsed: number
  requestLimit: number
  requestsUsed: number
}

export const MAX_WORDS_PER_REQUEST = Math.max(...Object.values(PLAN_LIMITS).map((item) => item.words))

const ZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/

export function planFromMetadata(value: unknown): PlanId {
  if (!value || typeof value !== 'object') return 'free'
  return (value as { plan?: unknown }).plan === 'premium' ? 'premium' : 'free'
}

export function quotaSnapshot(plan: PlanId, used: { words: number; requests: number }): QuotaSnapshot {
  const limits = PLAN_LIMITS[plan]
  return {
    plan,
    wordLimit: limits.words,
    wordsUsed: used.words,
    requestLimit: limits.requests,
    requestsUsed: used.requests,
  }
}

export function wordsLeft(quota: QuotaSnapshot): number {
  return Math.max(0, quota.wordLimit - quota.wordsUsed)
}

export function requestsLeft(quota: QuotaSnapshot): number {
  return Math.max(0, quota.requestLimit - quota.requestsUsed)
}

export function calendarDay(timeZone: string, now = new Date()): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (!year || !month || !day) return null
    return `${year}-${month}-${day}`
  } catch {
    return null
  }
}

/** Local calendar day for the UI, plus the UTC day as a ceiling against timezone hopping. */
export function resolveQuotaDays(timeZone: string, now = new Date()): { localDay: string; utcDay: string } {
  const utcDay = calendarDay('UTC', now) ?? now.toISOString().slice(0, 10)
  const zone = timeZone.trim()
  const localDay = zone && ZONE_PATTERN.test(zone) ? calendarDay(zone, now) : null
  return { localDay: localDay ?? utcDay, utcDay }
}
