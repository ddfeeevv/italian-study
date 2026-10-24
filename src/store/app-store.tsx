import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { t } from '../i18n/translate'
import { emptyData, loadCache, loadQueue, loadSettings, saveCache, saveQueue, saveSettings, type PendingOp } from '../lib/cache'
import { mapCard, mapDeck, mapSubject, toCardRow, toDeckRow, toSubjectRow } from '../lib/mappers'
import { dueCount, vocabCards } from '../lib/srs'
import { cardsInSubject, prepareSubjects, subjectFromPreset, topicSubject, presetById } from '../lib/subjects'
import { supabase } from '../lib/supabase'
import { debounce, nowIso, uid } from '../lib/utils'
import type { AppData, Card, Deck, Settings, Subject, SyncStatus } from '../types/models'
import { useAuth } from './auth-store'

type Action =
  | { type: 'replace'; data: AppData }
  | { type: 'add-subject'; subject: Subject }
  | { type: 'delete-subject'; subjectId: string }
  | { type: 'add-deck'; deck: Deck }
  | { type: 'update-deck'; deck: Deck }
  | { type: 'delete-deck'; deckId: string }
  | { type: 'add-cards'; cards: Card[] }
  | { type: 'update-card'; card: Card }
  | { type: 'delete-card'; cardId: string }
  | { type: 'set-settings'; settings: Partial<Settings> }

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'replace':
      return action.data
    case 'add-subject':
      return { ...state, subjects: [...state.subjects, action.subject] }
    case 'delete-subject': {
      const deckIds = new Set(state.decks.filter((deck) => deck.subjectId === action.subjectId).map((deck) => deck.id))
      return {
        ...state,
        subjects: state.subjects.filter((subject) => subject.id !== action.subjectId),
        decks: state.decks.filter((deck) => deck.subjectId !== action.subjectId),
        cards: state.cards.filter((card) => !deckIds.has(card.deckId)),
      }
    }
    case 'add-deck':
      return { ...state, decks: [action.deck, ...state.decks] }
    case 'update-deck':
      return {
        ...state,
        decks: state.decks.map((deck) => (deck.id === action.deck.id ? action.deck : deck)),
      }
    case 'delete-deck':
      return {
        ...state,
        decks: state.decks.filter((deck) => deck.id !== action.deckId),
        cards: state.cards.filter((card) => card.deckId !== action.deckId),
      }
    case 'add-cards':
      return { ...state, cards: [...state.cards, ...action.cards] }
    case 'update-card':
      return {
        ...state,
        cards: state.cards.map((card) => (card.id === action.card.id ? action.card : card)),
      }
    case 'delete-card':
      return {
        ...state,
        cards: state.cards.filter((card) => card.id !== action.cardId),
      }
    case 'set-settings':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    default: {
      const exhaustiveCheck: never = action
      console.error('[reducer] Unhandled action type:', exhaustiveCheck)
      return state
    }
  }
}

type AppStore = {
  data: AppData
  subjects: Subject[]
  activeSubject: Subject | null
  decks: Deck[]
  cards: Card[]
  settings: Settings
  dueToday: number
  syncStatus: SyncStatus
  syncError: string | null
  ready: boolean
  addLanguage: (presetId: string) => Subject | null
  addTopic: (title: string) => Subject | null
  setActiveSubject: (subjectId: string) => void
  deleteSubject: (subjectId: string) => void
  addDeck: (input: { title: string; description: string; color?: string; kind?: Deck['kind'] }) => Deck | null
  updateDeck: (deck: Deck) => void
  deleteDeck: (deckId: string) => void
  addCards: (cards: Card[]) => void
  updateCard: (card: Card) => void
  deleteCard: (cardId: string) => void
  setSettings: (settings: Partial<Settings>) => void
  retrySync: () => void
  cardsByDeck: (deckId: string) => Card[]
}

const AppStoreContext = createContext<AppStore | null>(null)
const CARD_CHUNK = 25

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, dispatch] = useReducer(reducer, undefined, () => emptyData(loadSettings()))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const dataRef = useRef(data)
  const queueRef = useRef<PendingOp[]>([])
  const userRef = useRef(user?.id)
  const flushingRef = useRef(false)
  const flushAgainRef = useRef(false)
  dataRef.current = data
  userRef.current = user?.id

  const debouncedSaveCache = useMemo(
    () =>
      debounce((userId: string, next: AppData) => {
        saveCache(userId, next)
      }, 500),
    [],
  )

  const markSynced = useCallback(() => {
    setSyncStatus('synced')
    setSyncError(null)
  }, [])

  const markError = useCallback((err: unknown) => {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error
          ? err.message
          : t('sync.failed')
    console.error('[parola] sync failed', err)
    setSyncError(message)
    setSyncStatus('error')
  }, [])

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'replace', data: emptyData(loadSettings()) })
      setReady(false)
      return
    }
    const cached = loadCache(user.id) ?? emptyData(loadSettings())
    const packed = packStudy(cached, user.id)
    dataRef.current = packed.data
    dispatch({ type: 'replace', data: packed.data })
    const pending = loadQueue(user.id).filter((op) => ownsPending(packed.data, op))
    queueRef.current = pending
    saveQueue(user.id, pending)
    if (packed.ops.length > 0) mergeQueue(packed.ops)
    void hydrate(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    debouncedSaveCache(user.id, data)
  }, [data, user, debouncedSaveCache])

  useEffect(() => {
    const onOnline = () => {
      if (userRef.current) void flushQueue()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', () => {
      setSyncStatus('offline')
      setSyncError(null)
    })
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const mergeQueue = useCallback((ops: PendingOp[]) => {
    const userId = userRef.current
    if (!userId || ops.length === 0) return
    const next = [...queueRef.current]
    for (const op of ops) {
      const idx = next.findIndex((item) => item.kind === op.kind && item.id === op.id)
      if (idx >= 0) next[idx] = op
      else next.push(op)
    }
    queueRef.current = next
    saveQueue(userId, next)
  }, [])

  const queueAllLocal = useCallback(() => {
    mergeQueue([
      ...dataRef.current.subjects.map((subject) => ({ kind: 'upsert-subject' as const, id: subject.id })),
      ...dataRef.current.decks.map((deck) => ({ kind: 'upsert-deck' as const, id: deck.id })),
      ...dataRef.current.cards.map((card) => ({ kind: 'upsert-card' as const, id: card.id })),
    ])
  }, [mergeQueue])

  const flushQueue = useCallback(async () => {
    const userId = userRef.current
    if (!userId) return
    if (!navigator.onLine) {
      setSyncStatus('offline')
      setSyncError(null)
      return
    }
    if (flushingRef.current) {
      flushAgainRef.current = true
      return
    }
    if (queueRef.current.length === 0) {
      markSynced()
      return
    }

    flushingRef.current = true
    setSyncStatus('syncing')
    try {
      do {
        flushAgainRef.current = false
        const pending = sortPendingOps(queueRef.current)

        const subjectUpserts = pending.filter((op) => op.kind === 'upsert-subject')
        if (subjectUpserts.length > 0) {
          if (!subjectsSchemaReady) {
            dropOps(queueRef, subjectUpserts)
            saveQueue(userId, queueRef.current)
          } else {
            const rows = subjectUpserts
              .map((op) => dataRef.current.subjects.find((subject) => subject.id === op.id))
              .filter((subject): subject is Subject => Boolean(subject))
              .map(toSubjectRow)
            if (rows.length !== subjectUpserts.length) {
              throw new Error(t('sync.missingSubject'))
            }
            const { error } = await supabase.from('subjects').upsert(rows, { onConflict: 'id' })
            if (error && schemaMissing(error)) subjectsSchemaReady = false
            else if (error) throw error
            dropOps(queueRef, subjectUpserts)
            saveQueue(userId, queueRef.current)
          }
        }

        const deckUpserts = pending.filter((op) => op.kind === 'upsert-deck')
        if (deckUpserts.length > 0) {
          const decks = deckUpserts
            .map((op) => dataRef.current.decks.find((deck) => deck.id === op.id))
            .filter((deck): deck is Deck => Boolean(deck))
          if (decks.length !== deckUpserts.length) {
            throw new Error(t('sync.missingDeck'))
          }
          let { error } = await supabase.from('decks').upsert(
            decks.map((deck) => toDeckRow(deck, subjectsSchemaReady)),
            { onConflict: 'id' },
          )
          if (error && schemaMissing(error)) {
            subjectsSchemaReady = false
            const retry = await supabase.from('decks').upsert(
              decks.map((deck) => toDeckRow(deck, false)),
              { onConflict: 'id' },
            )
            error = retry.error
          }
          if (error) throw error
          dropOps(queueRef, deckUpserts)
          saveQueue(userId, queueRef.current)
        }

        const cardUpserts = pending.filter((op) => op.kind === 'upsert-card')
        for (let i = 0; i < cardUpserts.length; i += CARD_CHUNK) {
          const chunk = cardUpserts.slice(i, i + CARD_CHUNK)
          const rows = chunk
            .map((op) => dataRef.current.cards.find((card) => card.id === op.id))
            .filter((card): card is Card => Boolean(card))
            .map(toCardRow)
          if (rows.length !== chunk.length) {
            throw new Error(t('sync.missingCard'))
          }
          const { error } = await supabase.from('cards').upsert(rows, { onConflict: 'id' })
          if (error) throw error
          dropOps(queueRef, chunk)
          saveQueue(userId, queueRef.current)
        }

        const cardDeletes = pending.filter((op) => op.kind === 'delete-card')
        for (const op of cardDeletes) {
          const { error } = await supabase.from('cards').delete().eq('id', op.id)
          if (error) throw error
          dropOps(queueRef, [op])
          saveQueue(userId, queueRef.current)
        }

        const deckDeletes = pending.filter((op) => op.kind === 'delete-deck')
        for (const op of deckDeletes) {
          const { error } = await supabase.from('decks').delete().eq('id', op.id)
          if (error) throw error
          dropOps(queueRef, [op])
          saveQueue(userId, queueRef.current)
        }

        const subjectDeletes = pending.filter((op) => op.kind === 'delete-subject')
        if (!subjectsSchemaReady) {
          dropOps(queueRef, subjectDeletes)
          if (subjectDeletes.length > 0) saveQueue(userId, queueRef.current)
        } else {
          for (const op of subjectDeletes) {
            const { error } = await supabase.from('subjects').delete().eq('id', op.id)
            if (error && schemaMissing(error)) {
              subjectsSchemaReady = false
              dropOps(queueRef, subjectDeletes)
              saveQueue(userId, queueRef.current)
              break
            }
            if (error) throw error
            dropOps(queueRef, [op])
            saveQueue(userId, queueRef.current)
          }
        }
      } while (flushAgainRef.current && queueRef.current.length > 0)

      if (queueRef.current.length === 0) markSynced()
      else {
        console.error('[parola] failed operations:', queueRef.current)
        markError(new Error(t('sync.queueStuck')))
      }
    } catch (err) {
      console.error('[parola] failed operations:', queueRef.current, err)
      markError(err)
    } finally {
      flushingRef.current = false
    }
  }, [markError, markSynced])

  const enqueue = useCallback(
    (ops: PendingOp[]) => {
      mergeQueue(ops)
      void flushQueue()
    },
    [flushQueue, mergeQueue],
  )

  const hydrate = useCallback(
    async (userId: string) => {
      setSyncStatus('syncing')
      setSyncError(null)
      try {
        await flushQueue()
        if (queueRef.current.length > 0) {
          setReady(true)
          setSyncStatus('error')
          return
        }

        const loaded = await loadRemote(userId)
        const hasUnsyncedUpserts = queueRef.current.some(
          (op) => op.kind === 'upsert-card' || op.kind === 'upsert-deck' || op.kind === 'upsert-subject',
        )
        const remoteBehindLocal =
          hasUnsyncedUpserts &&
          (dataRef.current.cards.length > loaded.cards.length ||
            dataRef.current.decks.length > loaded.decks.length ||
            (loaded.subjects !== null && dataRef.current.subjects.length > loaded.subjects.length))

        if (remoteBehindLocal) {
          queueAllLocal()
          await flushQueue()
          if (queueRef.current.length > 0) {
            setReady(true)
            setSyncStatus('error')
            return
          }
          const again = await loadRemote(userId)
          publishRemote(userId, again)
          return
        }

        publishRemote(userId, loaded)
      } catch (err) {
        markError(err)
        setReady(true)
        if (!navigator.onLine) {
          setSyncStatus('offline')
          setSyncError(null)
        }
      }
    },
    [flushQueue, markError, markSynced, queueAllLocal],
  )

  const publishRemote = (userId: string, loaded: { subjects: Subject[] | null; decks: Deck[]; cards: Card[] }) => {
    const packed = packStudy(
      {
        ...emptyData(loadSettings()),
        subjects: loaded.subjects ?? dataRef.current.subjects,
        decks: loaded.decks,
        cards: loaded.cards,
      },
      userId,
    )
    dataRef.current = packed.data
    dispatch({ type: 'replace', data: packed.data })
    const ops = subjectsSchemaReady ? packed.ops : packed.ops.filter((op) => op.kind === 'delete-card')
    if (ops.length > 0) {
      enqueue(ops)
    } else {
      markSynced()
    }
    setReady(true)
  }

  const remember = (next: AppData) => {
    dataRef.current = next
  }

  const setActive = (subjectId: string) => {
    const settings = { ...dataRef.current.settings, activeSubjectId: subjectId }
    dataRef.current = { ...dataRef.current, settings }
    dispatch({ type: 'set-settings', settings: { activeSubjectId: subjectId } })
    saveSettings(settings)
  }

  const setActiveSubject = useCallback((subjectId: string) => {
    if (!dataRef.current.subjects.some((subject) => subject.id === subjectId)) return
    setActive(subjectId)
  }, [])

  const addLanguage = useCallback(
    (presetId: string) => {
      if (!user) return null
      const existing = dataRef.current.subjects.find((subject) => subject.presetId === presetId)
      if (existing) {
        setActive(existing.id)
        return existing
      }
      const preset = presetById(presetId)
      if (!preset) return null
      const subject = subjectFromPreset(preset, user.id)
      remember({ ...dataRef.current, subjects: [...dataRef.current.subjects, subject] })
      dispatch({ type: 'add-subject', subject })
      setActive(subject.id)
      enqueue([{ kind: 'upsert-subject', id: subject.id }])
      return subject
    },
    [enqueue, user],
  )

  const addTopic = useCallback(
    (title: string) => {
      const name = title.trim()
      if (!user || !name) return null
      const subject = topicSubject(name, user.id)
      remember({ ...dataRef.current, subjects: [...dataRef.current.subjects, subject] })
      dispatch({ type: 'add-subject', subject })
      setActive(subject.id)
      enqueue([{ kind: 'upsert-subject', id: subject.id }])
      return subject
    },
    [enqueue, user],
  )

  const deleteSubject = useCallback(
    (subjectId: string) => {
      const current = dataRef.current
      if (current.subjects.length <= 1) return
      const deckIds = current.decks.filter((deck) => deck.subjectId === subjectId).map((deck) => deck.id)
      const deckIdSet = new Set(deckIds)
      const cardIds = new Set(current.cards.filter((card) => deckIdSet.has(card.deckId)).map((card) => card.id))
      queueRef.current = queueRef.current.filter((op) => {
        if (op.kind === 'upsert-subject' && op.id === subjectId) return false
        if ((op.kind === 'upsert-deck' || op.kind === 'delete-deck') && deckIdSet.has(op.id)) return false
        if ((op.kind === 'upsert-card' || op.kind === 'delete-card') && cardIds.has(op.id)) return false
        return true
      })
      const userId = userRef.current
      if (userId) saveQueue(userId, queueRef.current)
      const next = {
        ...current,
        subjects: current.subjects.filter((subject) => subject.id !== subjectId),
        decks: current.decks.filter((deck) => deck.subjectId !== subjectId),
        cards: current.cards.filter((card) => !deckIdSet.has(card.deckId)),
      }
      remember(next)
      dispatch({ type: 'delete-subject', subjectId })
      const fallback = next.subjects[0]
      if (current.settings.activeSubjectId === subjectId && fallback) setActive(fallback.id)
      enqueue([
        ...deckIds.map((id) => ({ kind: 'delete-deck' as const, id })),
        { kind: 'delete-subject' as const, id: subjectId },
      ])
    },
    [enqueue],
  )

  const addDeck = useCallback(
    (input: { title: string; description: string; color?: string; kind?: Deck['kind'] }) => {
      if (!user) return null
      const subjectId = dataRef.current.settings.activeSubjectId ?? dataRef.current.subjects[0]?.id
      if (!subjectId) return null
      const deck: Deck = {
        id: uid(),
        userId: user.id,
        title: input.title.trim(),
        description: input.description.trim(),
        color: input.color,
        kind: input.kind ?? 'words',
        subjectId,
        createdAt: nowIso(),
      }
      remember({ ...dataRef.current, decks: [deck, ...dataRef.current.decks] })
      dispatch({ type: 'add-deck', deck })
      enqueue([{ kind: 'upsert-deck', id: deck.id }])
      return deck
    },
    [enqueue, user],
  )

  const updateDeck = useCallback(
    (deck: Deck) => {
      dispatch({ type: 'update-deck', deck })
      enqueue([{ kind: 'upsert-deck', id: deck.id }])
    },
    [enqueue],
  )

  const deleteDeck = useCallback(
    (deckId: string) => {
      dispatch({ type: 'delete-deck', deckId })
      enqueue([{ kind: 'delete-deck', id: deckId }])
    },
    [enqueue],
  )

  const addCards = useCallback(
    (cards: Card[]) => {
      dispatch({ type: 'add-cards', cards })
      const deckIds = [...new Set(cards.map((card) => card.deckId))]
      enqueue([
        ...deckIds.map((id) => ({ kind: 'upsert-deck' as const, id })),
        ...cards.map((card) => ({ kind: 'upsert-card' as const, id: card.id })),
      ])
    },
    [enqueue],
  )

  const updateCard = useCallback(
    (card: Card) => {
      dispatch({ type: 'update-card', card })
      enqueue([{ kind: 'upsert-card', id: card.id }])
    },
    [enqueue],
  )

  const deleteCard = useCallback(
    (cardId: string) => {
      dispatch({ type: 'delete-card', cardId })
      enqueue([{ kind: 'delete-card', id: cardId }])
    },
    [enqueue],
  )

  const setSettings = useCallback((settings: Partial<Settings>) => {
    const next = { ...dataRef.current.settings, ...settings }
    dataRef.current = { ...dataRef.current, settings: next }
    dispatch({ type: 'set-settings', settings })
    saveSettings(next)
  }, [])

  const retrySync = useCallback(() => {
    if (!user) return
    queueAllLocal()
    void hydrate(user.id)
  }, [hydrate, queueAllLocal, user])

  const cardsByDeck = useCallback(
    (deckId: string) => data.cards.filter((card) => card.deckId === deckId),
    [data.cards],
  )

  const activeSubject =
    data.subjects.find((subject) => subject.id === data.settings.activeSubjectId) ?? data.subjects[0] ?? null

  const value = useMemo<AppStore>(
    () => ({
      data,
      subjects: data.subjects,
      activeSubject,
      decks: data.decks,
      cards: data.cards,
      settings: data.settings,
      dueToday: dueCount(vocabCards(cardsInSubject(data.cards, data.decks, activeSubject?.id))),
      syncStatus,
      syncError,
      ready,
      addLanguage,
      addTopic,
      setActiveSubject,
      deleteSubject,
      addDeck,
      updateDeck,
      deleteDeck,
      addCards,
      updateCard,
      deleteCard,
      setSettings,
      retrySync,
      cardsByDeck,
    }),
    [
      activeSubject,
      addCards,
      addDeck,
      addLanguage,
      addTopic,
      setActiveSubject,
      cardsByDeck,
      data,
      deleteCard,
      deleteDeck,
      deleteSubject,
      ready,
      retrySync,
      setSettings,
      syncError,
      syncStatus,
      updateCard,
      updateDeck,
    ],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}

function sortPendingOps(ops: PendingOp[]): PendingOp[] {
  const rank = (op: PendingOp): number => {
    switch (op.kind) {
      case 'upsert-subject':
        return 0
      case 'upsert-deck':
        return 1
      case 'upsert-card':
        return 2
      case 'delete-card':
        return 3
      case 'delete-deck':
        return 4
      case 'delete-subject':
        return 5
      default:
        return 9
    }
  }
  return [...ops].sort((a, b) => rank(a) - rank(b))
}

function dropOps(queueRef: { current: PendingOp[] }, ops: PendingOp[]) {
  const drop = new Set(ops.map((op) => `${op.kind}:${op.id}`))
  queueRef.current = queueRef.current.filter((item) => !drop.has(`${item.kind}:${item.id}`))
}

function ownsPending(data: AppData, op: PendingOp): boolean {
  if (op.kind === 'upsert-subject') return data.subjects.some((subject) => subject.id === op.id)
  if (op.kind === 'upsert-deck') return data.decks.some((deck) => deck.id === op.id)
  if (op.kind === 'upsert-card') return data.cards.some((card) => card.id === op.id)
  return true
}

function packStudy(data: AppData, userId: string): { data: AppData; ops: PendingOp[] } {
  const prepared = prepareSubjects(userId, data.subjects ?? [], data.decks, data.settings)
  const next: AppData = {
    version: 3,
    subjects: prepared.subjects,
    decks: prepared.decks,
    cards: data.cards,
    settings: { ...data.settings, activeSubjectId: prepared.activeSubjectId },
  }
  const ops: PendingOp[] = [
    ...prepared.subjectUpserts.map((id) => ({ kind: 'upsert-subject' as const, id })),
    ...prepared.deckUpserts.map((id) => ({ kind: 'upsert-deck' as const, id })),
    ...prepared.removedSubjectIds.map((id) => ({ kind: 'delete-subject' as const, id })),
  ]
  return { data: next, ops }
}

async function loadRemote(userId: string): Promise<{ subjects: Subject[] | null; decks: Deck[]; cards: Card[] }> {
  const [subjectsRes, decksRes, cardsRes] = await Promise.all([
    supabase.from('subjects').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('decks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('cards').select('*').eq('user_id', userId),
  ])
  if (decksRes.error) throw decksRes.error
  if (cardsRes.error) throw cardsRes.error
  if (subjectsRes.error) {
    if (!schemaMissing(subjectsRes.error)) throw subjectsRes.error
    subjectsSchemaReady = false
  }
  return {
    subjects: subjectsRes.error ? null : (subjectsRes.data ?? []).map(mapSubject),
    decks: (decksRes.data ?? []).map(mapDeck),
    cards: (cardsRes.data ?? []).map(mapCard),
  }
}

let subjectsSchemaReady = true

function schemaMissing(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? ''
  if (error.code === 'PGRST205' && /subjects/i.test(message)) return true
  if (error.code === 'PGRST204' && /subject_id/i.test(message)) return true
  return /could not find the table 'public\.subjects'/i.test(message)
}
