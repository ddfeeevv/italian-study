/** Local calendar day, `YYYY-MM-DD`. Midnight is the device timezone. */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function dayDiff(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  const a = Date.UTC(y1, (m1 ?? 1) - 1, d1 ?? 1)
  const b = Date.UTC(y2, (m2 ?? 1) - 1, d2 ?? 1)
  return Math.round((b - a) / 86_400_000)
}

/** Different words in a local day before the flame lights and the streak extends. */
export const STREAK_GOAL = 10

/** Ids kept for one day so two devices can merge the same day's words. */
const STREAK_PROGRESS_CAP = 40

/** Monday-first week that contains `today`. */
export function weekKeys(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
  const weekday = date.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  return Array.from({ length: 7 }, (_, index) => shiftDay(today, mondayOffset + index))
}

export type StreakState = {
  count: number
  lastDate: string | null
  /** Best streak lost so far, until it is restored or beaten. */
  savedCount: number
  savedDate: string | null
  /** `YYYY-MM` of the last restore. One restore per calendar month. */
  restoreMonth: string | null
  /** Local day the in-progress word ids belong to. */
  progressDate: string | null
  progressIds: string[]
  updatedAt: string
}

export type RestoreBlock = 'available' | 'used' | 'none'

export type StreakView = {
  count: number
  today: string
  practicedToday: boolean
  atRisk: boolean
  canRestore: boolean
  restoreBlock: RestoreBlock
  /** Lost streak that restore would bring back, before today's answer. */
  savedCount: number
  /** Number after a restore, including today when it already counts. */
  restoredCount: number
  goal: number
  /** Different words answered today, capped at the goal once the day counts. */
  todayCount: number
  streakStart: string | null
  streakEnd: string | null
}

export function emptyStreak(): StreakState {
  return {
    count: 0,
    lastDate: null,
    savedCount: 0,
    savedDate: null,
    restoreMonth: null,
    progressDate: null,
    progressIds: [],
    updatedAt: '',
  }
}

export function sameStreak(a: StreakState, b: StreakState): boolean {
  return (
    a.count === b.count &&
    a.lastDate === b.lastDate &&
    a.savedCount === b.savedCount &&
    a.savedDate === b.savedDate &&
    a.restoreMonth === b.restoreMonth &&
    a.progressDate === b.progressDate &&
    sameIds(a.progressIds, b.progressIds)
  )
}

export function streakView(state: StreakState, now = new Date()): StreakView {
  const today = dayKey(now)
  const gap = state.lastDate ? dayDiff(state.lastDate, today) : null
  const future = gap !== null && gap < 0
  const alive = gap !== null && state.count > 0 && (future || gap <= 1)
  const practicedToday = alive && (gap === 0 || future)
  const count = alive ? state.count : 0
  const streakEnd = alive ? (future ? today : state.lastDate) : null
  const streakStart = alive && streakEnd ? shiftDay(streakEnd, 1 - state.count) : null

  const lost: { count: number; date: string }[] = []
  if (!alive && state.lastDate && state.count > 0 && gap !== null && gap >= 2) {
    lost.push({ count: state.count, date: state.lastDate })
  }
  if (state.savedDate && state.savedCount > 0 && dayDiff(state.savedDate, today) >= 2) {
    lost.push({ count: state.savedCount, date: state.savedDate })
  }
  lost.sort((a, b) => b.count - a.count || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const best = lost[0]
  const used = state.restoreMonth === today.slice(0, 7)
  const canRestore = Boolean(best && best.count > count && !used)
  const restoreBlock: RestoreBlock = best && best.count > count ? (used ? 'used' : 'available') : 'none'

  return {
    count,
    today,
    practicedToday,
    atRisk: alive && !practicedToday,
    canRestore,
    restoreBlock,
    savedCount: best?.count ?? 0,
    restoredCount: canRestore && best ? best.count + (practicedToday ? 1 : 0) : 0,
    goal: STREAK_GOAL,
    todayCount: todayWordCount(state, today, practicedToday),
    streakStart,
    streakEnd,
  }
}

/**
 * A day counted before the goal existed (one answer) does not stay lit.
 * Past days are left as they are. Only today is rolled back when fewer than
 * `STREAK_GOAL` different words are stored for it.
 */
export function enforceGoal(state: StreakState, now = new Date()): StreakState {
  const today = dayKey(now)
  if (state.lastDate !== today) return state
  if (state.progressDate === today && state.progressIds.length >= STREAK_GOAL) return state
  if (state.count <= 1) return { ...state, count: 0, lastDate: null }
  return { ...state, count: state.count - 1, lastDate: shiftDay(today, -1) }
}

/**
 * One committed answer on a card. The same card counts once per day.
 * The day counts, and the flame lights, once `STREAK_GOAL` different words are in.
 */
export function noteWord(
  state: StreakState,
  cardId: string,
  now = new Date(),
): { state: StreakState; changed: boolean; counted: boolean } {
  const base = enforceGoal(state, now)
  const id = cardId.trim()
  if (!id) return { state: base, changed: base !== state, counted: false }
  const today = dayKey(now)
  if (base.lastDate === today) return { state: base, changed: base !== state, counted: false }

  const ids = base.progressDate === today ? base.progressIds : []
  const already = ids.includes(id)
  if (already && ids.length < STREAK_GOAL) return { state: base, changed: base !== state, counted: false }

  const progressIds = already ? ids : unionIds(ids, [id])
  const progressed: StreakState = { ...base, progressDate: today, progressIds }
  if (progressIds.length < STREAK_GOAL) return { state: progressed, changed: true, counted: false }

  const result = recordPractice(progressed, now)
  return { state: result.state, changed: true, counted: result.counted }
}

export function recordPractice(state: StreakState, now = new Date()): { state: StreakState; counted: boolean } {
  const today = dayKey(now)
  if (state.lastDate === today) return { state, counted: false }

  if (state.lastDate && dayDiff(state.lastDate, today) < 0) {
    return {
      counted: true,
      state: { ...state, lastDate: today, count: Math.max(state.count, 1) },
    }
  }

  if (state.lastDate && dayDiff(state.lastDate, today) === 1) {
    return {
      counted: true,
      state: { ...state, lastDate: today, count: state.count + 1 },
    }
  }

  const saved = rememberBreak(state)
  return {
    counted: true,
    state: { ...state, ...saved, count: 1, lastDate: today },
  }
}

export function applyRestore(state: StreakState, now = new Date()): StreakState | null {
  const view = streakView(state, now)
  if (!view.canRestore) return null
  return {
    ...state,
    count: view.restoredCount,
    lastDate: view.practicedToday ? view.today : shiftDay(view.today, -1),
    savedCount: 0,
    savedDate: null,
    restoreMonth: view.today.slice(0, 7),
  }
}

/**
 * Two devices: keep the later practice day. A one-day gap with a smaller count
 * is today's restart on top of yesterday's longer streak, so the days add.
 * The later restore month always sticks, so a used restore cannot be spent twice.
 */
export function mergeStreak(a: StreakState, b: StreakState): StreakState {
  const practice = moreRecentPractice(a, b)
  const progress = mergeProgress(a, b)
  return sealProgress({
    ...practice,
    ...progress,
    restoreMonth: laterMonth(a.restoreMonth, b.restoreMonth),
    updatedAt: laterIso(a.updatedAt, b.updatedAt),
  })
}

export function sanitizeStreak(raw: unknown): StreakState {
  const empty = emptyStreak()
  if (!raw || typeof raw !== 'object') return empty
  const row = raw as Record<string, unknown>
  const lastDate = asDay(row.lastDate ?? row.last_date)
  const savedDate = asDay(row.savedDate ?? row.saved_date)
  const count = clampCount(row.count)
  const savedCount = clampCount(row.savedCount ?? row.saved_count)
  const updated = row.updatedAt ?? row.updated_at
  const progressDate = asDay(row.progressDate ?? row.progress_date)
  return {
    count: lastDate ? count : 0,
    lastDate,
    savedCount: savedDate && savedCount > 0 ? savedCount : 0,
    savedDate: savedDate && savedCount > 0 ? savedDate : null,
    restoreMonth: asMonth(row.restoreMonth ?? row.restore_month),
    progressDate,
    progressIds: progressDate ? asIds(row.progressIds ?? row.progress_ids) : [],
    updatedAt: typeof updated === 'string' && !Number.isNaN(Date.parse(updated)) ? updated : '',
  }
}

function todayWordCount(state: StreakState, today: string, practicedToday: boolean): number {
  const stored = state.progressDate === today ? state.progressIds.length : 0
  if (practicedToday) return Math.max(Math.min(stored, STREAK_GOAL), STREAK_GOAL)
  return Math.min(stored, STREAK_GOAL)
}

function unionIds(a: string[], b: string[]): string[] {
  const out: string[] = []
  for (const id of [...a, ...b]) {
    if (!id || out.includes(id)) continue
    out.push(id)
    if (out.length >= STREAK_PROGRESS_CAP) break
  }
  return out
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((id, index) => id === right[index])
}

function mergeProgress(a: StreakState, b: StreakState): { progressDate: string | null; progressIds: string[] } {
  if (!a.progressDate) return { progressDate: b.progressDate, progressIds: b.progressIds }
  if (!b.progressDate) return { progressDate: a.progressDate, progressIds: a.progressIds }
  if (a.progressDate === b.progressDate) {
    return { progressDate: a.progressDate, progressIds: unionIds(a.progressIds, b.progressIds) }
  }
  return a.progressDate > b.progressDate
    ? { progressDate: a.progressDate, progressIds: a.progressIds }
    : { progressDate: b.progressDate, progressIds: b.progressIds }
}

/** A merged day with enough different words counts, without rewinding a later practice day. */
function sealProgress(state: StreakState): StreakState {
  if (!state.progressDate || state.progressIds.length < STREAK_GOAL) return state
  if (state.lastDate && state.progressDate <= state.lastDate) return state
  return recordPractice(state, dateFromKey(state.progressDate)).state
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

function asIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || id.length > 80 || out.includes(id)) continue
    out.push(id)
    if (out.length >= STREAK_PROGRESS_CAP) break
  }
  return out
}

function rememberBreak(state: StreakState): { savedCount: number; savedDate: string | null } {
  if (!state.lastDate || state.count <= 0) {
    return { savedCount: state.savedCount, savedDate: state.savedDate }
  }
  if (state.count >= state.savedCount) {
    return { savedCount: state.count, savedDate: state.lastDate }
  }
  return { savedCount: state.savedCount, savedDate: state.savedDate }
}

function moreRecentPractice(a: StreakState, b: StreakState): StreakState {
  const aDay = a.lastDate ?? ''
  const bDay = b.lastDate ?? ''
  if (!aDay) return bDay ? b : a.count >= b.count ? a : b
  if (!bDay) return a
  if (aDay === bDay) return a.count >= b.count ? a : b
  const newer = aDay > bDay ? a : b
  const older = newer === a ? b : a
  if (older.lastDate && newer.lastDate && dayDiff(older.lastDate, newer.lastDate) === 1 && older.count > newer.count) {
    return {
      ...newer,
      count: older.count + 1,
      lastDate: newer.lastDate,
    }
  }
  return newer
}

function laterMonth(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function laterIso(a: string, b: string): string {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta)) return Number.isNaN(tb) ? a || b : b
  if (Number.isNaN(tb)) return a
  return ta >= tb ? a : b
}

function clampCount(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
  if (!Number.isFinite(n)) return 0
  return Math.min(100_000, Math.max(0, Math.trunc(n)))
}

function asDay(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  if (!match) return null
  const key = match[1]
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  if (date.getFullYear() !== y || date.getMonth() !== (m ?? 1) - 1 || date.getDate() !== d) return null
  return key
}

function asMonth(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null
  const month = Number(value.slice(5))
  if (month < 1 || month > 12) return null
  return value
}
