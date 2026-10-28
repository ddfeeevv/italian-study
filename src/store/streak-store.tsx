import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  applyRestore,
  emptyStreak,
  enforceGoal,
  mergeStreak,
  noteWord,
  sameStreak,
  sanitizeStreak,
  streakView,
  type StreakState,
  type StreakView,
} from '../lib/streak'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth-store'

type StreakApi = {
  view: StreakView
  markStudied: (cardId: string) => void
  restore: () => boolean
}

const StreakContext = createContext<StreakApi | null>(null)

function storageKey(userId: string): string {
  return `parola:streak:v1:${userId}`
}

function loadStreak(userId: string): StreakState {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? sanitizeStreak(JSON.parse(raw) as unknown) : emptyStreak()
  } catch {
    return emptyStreak()
  }
}

function saveStreak(userId: string, state: StreakState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    /* private mode */
  }
}

function worthSync(state: StreakState): boolean {
  return Boolean(
    state.updatedAt || state.lastDate || state.count || state.savedCount || state.restoreMonth || state.progressIds.length,
  )
}

type PushResult = 'ok' | 'missing' | 'error'

let schemaReady = true
let missingWarned = false
let progressSync = true
let progressWarned = false

function tableMissing(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? ''
  if (error.code === 'PGRST205' && /streaks/i.test(message)) return true
  return /could not find the table ['"]public\.streaks['"]/i.test(message)
}

function progressColumnMissing(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? ''
  return error.code === 'PGRST204' && /progress_(date|ids)/i.test(message)
}

async function pullStreak(userId: string): Promise<StreakState | null | 'missing'> {
  if (!schemaReady) return 'missing'
  try {
    const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
    if (error) {
      if (tableMissing(error)) {
        schemaReady = false
        if (!missingWarned) {
          missingWarned = true
          console.warn('[parola] streaks table is missing; the streak stays on this device')
        }
        return 'missing'
      }
      console.error('[parola] streak load failed', error)
      return null
    }
    return data ? sanitizeStreak(data) : null
  } catch (err) {
    console.error('[parola] streak load failed', err)
    return null
  }
}

async function pushStreak(userId: string, state: StreakState): Promise<PushResult> {
  if (!schemaReady) return 'missing'
  const updatedAt = state.updatedAt || new Date().toISOString()
  try {
    const { error } = await supabase.from('streaks').upsert(
      {
        user_id: userId,
        count: state.count,
        last_date: state.lastDate,
        saved_count: state.savedCount,
        saved_date: state.savedDate,
        restore_month: state.restoreMonth,
        updated_at: updatedAt,
        ...(progressSync ? { progress_date: state.progressDate, progress_ids: state.progressIds } : {}),
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      if (progressSync && progressColumnMissing(error)) {
        progressSync = false
        if (!progressWarned) {
          progressWarned = true
          console.warn('[parola] streak progress columns are missing; today’s word count stays on this device')
        }
        return pushStreak(userId, state)
      }
      if (tableMissing(error)) {
        schemaReady = false
        if (!missingWarned) {
          missingWarned = true
          console.warn('[parola] streaks table is missing; the streak stays on this device')
        }
        return 'missing'
      }
      console.error('[parola] streak save failed', error)
      return 'error'
    }
    return 'ok'
  } catch (err) {
    console.error('[parola] streak save failed', err)
    return 'error'
  }
}

export function StreakProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [record, setRecord] = useState<StreakState>(emptyStreak)
  const [now, setNow] = useState(() => new Date())
  const recordRef = useRef(record)
  const userRef = useRef(user?.id)
  const dirtyRef = useRef(false)
  recordRef.current = record
  userRef.current = user?.id

  useEffect(() => {
    const bump = () => setNow(new Date())
    const id = window.setInterval(bump, 30_000)
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', bump)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', bump)
    }
  }, [])

  const commit = useCallback((next: StreakState) => {
    const stored = { ...next, updatedAt: new Date().toISOString() }
    recordRef.current = stored
    setRecord(stored)
    const userId = userRef.current
    if (!userId) return
    saveStreak(userId, stored)
    void pushStreak(userId, stored).then((result) => {
      dirtyRef.current = result === 'error'
    })
  }, [])

  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      const empty = emptyStreak()
      recordRef.current = empty
      setRecord(empty)
      return
    }
    const local = loadStreak(userId)
    recordRef.current = local
    setRecord(local)
    let cancel = false
    void (async () => {
      const remote = await pullStreak(userId)
      if (cancel || remote === 'missing') return
      const current = recordRef.current
      if (!remote) {
        if (worthSync(current)) {
          const result = await pushStreak(userId, current.updatedAt ? current : { ...current, updatedAt: new Date().toISOString() })
          if (!cancel) dirtyRef.current = result === 'error'
        }
        return
      }
      const merged = mergeStreak(current, remote)
      if (cancel) return
      recordRef.current = merged
      setRecord(merged)
      saveStreak(userId, merged)
      if (!sameStreak(merged, remote)) {
        const result = await pushStreak(userId, merged)
        if (!cancel) dirtyRef.current = result === 'error'
      }
    })()
    return () => {
      cancel = true
    }
  }, [user?.id])

  useEffect(() => {
    const onOnline = () => {
      const userId = userRef.current
      if (!userId || !dirtyRef.current) return
      void pushStreak(userId, recordRef.current).then((result) => {
        if (result === 'ok') dirtyRef.current = false
      })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    const enforced = enforceGoal(recordRef.current, new Date())
    if (sameStreak(enforced, recordRef.current)) return
    commit(enforced)
  }, [commit, record])

  const markStudied = useCallback((cardId: string) => {
    const result = noteWord(recordRef.current, cardId, new Date())
    if (!result.changed) return
    commit(result.state)
  }, [commit])

  const restore = useCallback(() => {
    const now = new Date()
    const base = enforceGoal(recordRef.current, now)
    const next = applyRestore(base, now)
    if (!next) {
      if (base !== recordRef.current) commit(base)
      return false
    }
    commit(next)
    return true
  }, [commit])

  const view = useMemo(() => streakView(enforceGoal(record, now), now), [now, record])
  const value = useMemo(() => ({ view, markStudied, restore }), [markStudied, restore, view])

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>
}

export function useStreak(): StreakApi {
  const ctx = useContext(StreakContext)
  if (!ctx) throw new Error('useStreak must be used within StreakProvider')
  return ctx
}
