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
import { emptyData, loadCache, loadQueue, loadSettings, saveCache, saveQueue, saveSettings, type PendingOp } from '../lib/cache'
import { mapCard, mapDeck, toCardRow, toDeckRow } from '../lib/mappers'
import { dueCount } from '../lib/srs'
import { supabase } from '../lib/supabase'
import { nowIso, uid } from '../lib/utils'
import type { AppData, Card, Deck, Settings, SyncStatus } from '../types/models'
import { useAuth } from './auth-store'

type Action =
  | { type: 'replace'; data: AppData }
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
    default:
      return state
  }
}

type AppStore = {
  data: AppData
  decks: Deck[]
  cards: Card[]
  settings: Settings
  dueToday: number
  syncStatus: SyncStatus
  syncError: string | null
  ready: boolean
  addDeck: (input: { title: string; description: string; color?: string }) => Deck | null
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
          : 'Не удалось синхронизировать'
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
    const cached = loadCache(user.id)
    queueRef.current = loadQueue(user.id)
    if (cached) {
      dispatch({ type: 'replace', data: { ...cached, settings: loadSettings() } })
    }
    void hydrate(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    saveCache(user.id, data)
  }, [data, user])

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

        const deckUpserts = pending.filter((op) => op.kind === 'upsert-deck')
        if (deckUpserts.length > 0) {
          const rows = deckUpserts
            .map((op) => dataRef.current.decks.find((deck) => deck.id === op.id))
            .filter((deck): deck is Deck => Boolean(deck))
            .map(toDeckRow)
          if (rows.length !== deckUpserts.length) {
            throw new Error('Локальная колода для синка не найдена')
          }
          const { error } = await supabase.from('decks').upsert(rows, { onConflict: 'id' })
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
            throw new Error('Локальная карточка для синка не найдена')
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
      } while (flushAgainRef.current && queueRef.current.length > 0)

      if (queueRef.current.length === 0) markSynced()
      else markError(new Error('Очередь синка не опустела'))
    } catch (err) {
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

        const [decksRes, cardsRes] = await Promise.all([
          supabase.from('decks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('cards').select('*').eq('user_id', userId),
        ])
        if (decksRes.error) throw decksRes.error
        if (cardsRes.error) throw cardsRes.error

        const decks = (decksRes.data ?? []).map(mapDeck)
        const cards = (cardsRes.data ?? []).map(mapCard)
        const remoteBehindLocal =
          dataRef.current.cards.length > cards.length || dataRef.current.decks.length > decks.length

        if (remoteBehindLocal) {
          queueAllLocal()
          await flushQueue()
          if (queueRef.current.length > 0) {
            setReady(true)
            setSyncStatus('error')
            return
          }
          const [decksRes2, cardsRes2] = await Promise.all([
            supabase.from('decks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('cards').select('*').eq('user_id', userId),
          ])
          if (decksRes2.error) throw decksRes2.error
          if (cardsRes2.error) throw cardsRes2.error
          dispatch({
            type: 'replace',
            data: {
              ...emptyData(loadSettings()),
              decks: (decksRes2.data ?? []).map(mapDeck),
              cards: (cardsRes2.data ?? []).map(mapCard),
            },
          })
          setReady(true)
          markSynced()
          return
        }

        dispatch({
          type: 'replace',
          data: {
            ...emptyData(loadSettings()),
            decks,
            cards,
          },
        })
        setReady(true)
        markSynced()
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

  const addDeck = useCallback(
    (input: { title: string; description: string; color?: string }) => {
      if (!user) return null
      const deck: Deck = {
        id: uid(),
        userId: user.id,
        title: input.title.trim(),
        description: input.description.trim(),
        color: input.color,
        createdAt: nowIso(),
      }
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
    dispatch({ type: 'set-settings', settings })
    saveSettings({ ...dataRef.current.settings, ...settings })
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

  const value = useMemo<AppStore>(
    () => ({
      data,
      decks: data.decks,
      cards: data.cards,
      settings: data.settings,
      dueToday: dueCount(data.cards),
      syncStatus,
      syncError,
      ready,
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
      addCards,
      addDeck,
      cardsByDeck,
      data,
      deleteCard,
      deleteDeck,
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
      case 'upsert-deck':
        return 0
      case 'upsert-card':
        return 1
      case 'delete-card':
        return 2
      case 'delete-deck':
        return 3
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
