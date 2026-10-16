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

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, dispatch] = useReducer(reducer, undefined, () => emptyData(loadSettings()))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing')
  const [ready, setReady] = useState(false)
  const dataRef = useRef(data)
  const queueRef = useRef<PendingOp[]>([])
  const userRef = useRef(user?.id)
  dataRef.current = data
  userRef.current = user?.id

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
    window.addEventListener('offline', () => setSyncStatus('offline'))
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const enqueue = useCallback((ops: PendingOp[]) => {
    const userId = userRef.current
    if (!userId) return
    const next = [...queueRef.current]
    for (const op of ops) {
      const idx = next.findIndex((item) => item.kind === op.kind && item.id === op.id)
      if (idx >= 0) next[idx] = op
      else next.push(op)
    }
    queueRef.current = next
    saveQueue(userId, next)
    void flushQueue()
  }, [])

  const applyOp = useCallback(async (op: PendingOp) => {
    if (op.kind === 'upsert-deck') {
      const deck = dataRef.current.decks.find((item) => item.id === op.id)
      if (!deck) throw new Error(`Missing local deck for upsert: ${op.id}`)
      const { error } = await supabase.from('decks').upsert(toDeckRow(deck))
      if (error) throw error
      return
    }
    if (op.kind === 'delete-deck') {
      const { error } = await supabase.from('decks').delete().eq('id', op.id)
      if (error) throw error
      return
    }
    if (op.kind === 'upsert-card') {
      const card = dataRef.current.cards.find((item) => item.id === op.id)
      if (!card) throw new Error(`Missing local card for upsert: ${op.id}`)
      const { error } = await supabase.from('cards').upsert(toCardRow(card))
      if (error) throw error
      return
    }
    const { error } = await supabase.from('cards').delete().eq('id', op.id)
    if (error) throw error
  }, [])

  const flushQueue = useCallback(async () => {
    const userId = userRef.current
    if (!userId) return
    if (!navigator.onLine) {
      setSyncStatus('offline')
      return
    }
    if (queueRef.current.length === 0) {
      setSyncStatus('synced')
      return
    }
    setSyncStatus('syncing')
    const pending = [...queueRef.current]
    try {
      for (const op of pending) {
        await applyOp(op)
        queueRef.current = queueRef.current.filter((item) => item !== op)
        saveQueue(userId, queueRef.current)
      }
      setSyncStatus('synced')
    } catch {
      setSyncStatus('error')
    }
  }, [applyOp])

  const hydrate = useCallback(async (userId: string) => {
    setSyncStatus('syncing')
    try {
      // Push local mutations first while cached/optimistic data is still in memory.
      // Otherwise a empty remote pull would wipe state and then drop pending upserts.
      await flushQueue()
      const pendingLeft = queueRef.current.length > 0

      const [decksRes, cardsRes] = await Promise.all([
        supabase.from('decks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('cards').select('*').eq('user_id', userId),
      ])
      if (decksRes.error) throw decksRes.error
      if (cardsRes.error) throw cardsRes.error

      const decks = (decksRes.data ?? []).map(mapDeck)
      const cards = (cardsRes.data ?? []).map(mapCard)
      const remoteEmpty = decks.length === 0 && cards.length === 0
      const localHas =
        dataRef.current.decks.length > 0 || dataRef.current.cards.length > 0

      // Keep local decks/cards if the server is empty — re-queue upload instead of wiping.
      if (remoteEmpty && localHas) {
        const ops: PendingOp[] = [
          ...dataRef.current.decks.map((deck) => ({ kind: 'upsert-deck' as const, id: deck.id })),
          ...dataRef.current.cards.map((card) => ({ kind: 'upsert-card' as const, id: card.id })),
        ]
        const next = [...queueRef.current]
        for (const op of ops) {
          const idx = next.findIndex((item) => item.kind === op.kind && item.id === op.id)
          if (idx >= 0) next[idx] = op
          else next.push(op)
        }
        queueRef.current = next
        saveQueue(userId, next)
        await flushQueue()
        setReady(true)
        setSyncStatus(queueRef.current.length > 0 || pendingLeft ? 'error' : 'synced')
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
      await flushQueue()
      setSyncStatus(queueRef.current.length > 0 ? 'error' : 'synced')
    } catch {
      setReady(true)
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
    }
  }, [flushQueue])

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
      enqueue(cards.map((card) => ({ kind: 'upsert-card' as const, id: card.id })))
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
    if (user) void hydrate(user.id)
  }, [hydrate, user])

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
