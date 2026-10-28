import { Send, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/translate'
import { MAX_WORDS_PER_REQUEST, requestsLeft, wordsLeft, type QuotaSnapshot } from '../lib/generation-quota'
import { nextTurn, type TutorDraft } from '../lib/mascot-intent'
import { createCard } from '../lib/srs'
import { cardsInSubject } from '../lib/subjects'
import { fetchTutorQuota, requestTutorDeck, TutorApiError } from '../lib/tutor-api'
import { clsx, uid } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import type { Card, Deck } from '../types/models'
import { Mascot } from './Mascot'

const COLORS = ['#C45C26', '#3F6F5B', '#3D5A80', '#8B4D6B', '#B0892B']

type Bubble = {
  id: string
  role: 'mascot' | 'user'
  text: string
  deckId?: string
  exercise?: boolean
  preview?: string
  pending?: boolean
}

type QuotaState =
  | { status: 'loading' }
  | { status: 'ready'; quota: QuotaSnapshot }
  | { status: 'unconfigured' }
  | { status: 'error' }

export function MascotChat() {
  const { pathname } = useLocation()
  const exercise = pathname.startsWith('/exercises')
  const { t, countInline, locale } = useI18n()
  const { user } = useAuth()
  const { ready, cards, decks, activeSubject, addDeck, addCards } = useAppStore()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [quotaState, setQuotaState] = useState<QuotaState>({ status: 'loading' })
  const [bubbles, setBubbles] = useState<Bubble[]>(() => [
    { id: uid(), role: 'mascot', text: t('tutor.greeting') },
  ])
  const draftRef = useRef<TutorDraft>({})
  const busyRef = useRef(false)
  const quotaReq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const loadQuota = useCallback(async () => {
    const id = ++quotaReq.current
    try {
      const quota = await fetchTutorQuota()
      if (quotaReq.current !== id) return
      setQuotaState({ status: 'ready', quota })
    } catch (error) {
      if (quotaReq.current !== id) return
      if (error instanceof TutorApiError && error.code === 'unconfigured') {
        setQuotaState({ status: 'unconfigured' })
        return
      }
      setQuotaState({ status: 'error' })
    }
  }, [])

  const applyQuota = useCallback((quota: QuotaSnapshot) => {
    quotaReq.current += 1
    setQuotaState({ status: 'ready', quota })
  }, [])

  useEffect(() => {
    void loadQuota()
  }, [loadQuota, open])

  const greeting = t(exercise ? 'tutor.greetingExercise' : 'tutor.greeting')
  const lead = bubbles[0]
  if (lead && bubbles.length === 1 && lead.role === 'mascot' && !lead.deckId && !lead.pending && lead.text !== greeting) {
    setBubbles([{ ...lead, text: greeting }])
  }

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [bubbles, open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      launcherRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const blocked =
    quotaState.status === 'ready' &&
    (wordsLeft(quotaState.quota) < 1 || requestsLeft(quotaState.quota) < 1)
  const cap =
    quotaState.status === 'ready'
      ? Math.min(MAX_WORDS_PER_REQUEST, Math.max(wordsLeft(quotaState.quota), 1))
      : MAX_WORDS_PER_REQUEST
  const showHint = ready && !busy && !blocked && bubbles.every((item) => item.role === 'mascot' && !item.deckId)

  const close = () => {
    setOpen(false)
    launcherRef.current?.focus()
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busyRef.current) return
    if (!ready) return
    if (blocked) {
      setInput('')
      setBubbles((current) => [
        ...current,
        { id: uid(), role: 'user', text },
        { id: uid(), role: 'mascot', text: t('tutor.limit') },
      ])
      return
    }

    const turn = nextTurn(draftRef.current, text, cap)
    draftRef.current = turn.draft
    setInput('')
    setBubbles((current) => [...current, { id: uid(), role: 'user', text }])

    if (turn.type === 'ask') {
      const reply =
        turn.ask === 'topic'
          ? t('tutor.needTopic')
          : turn.ask === 'count'
            ? t(exercise ? 'tutor.needCountExercise' : 'tutor.needCount', { max: cap })
            : turn.ask === 'tooMany'
              ? t(exercise ? 'tutor.tooManyExercise' : 'tutor.tooMany', { max: cap })
              : t(exercise ? 'tutor.exampleAskExercise' : 'tutor.exampleAsk')
      setBubbles((current) => [...current, { id: uid(), role: 'mascot', text: reply }])
      return
    }

    if (!user || !activeSubject) {
      setBubbles((current) => [...current, { id: uid(), role: 'mascot', text: t('tutor.noSubject') }])
      return
    }
    if (quotaState.status === 'unconfigured') {
      setBubbles((current) => [...current, { id: uid(), role: 'mascot', text: t('tutor.unconfigured') }])
      return
    }

    const pendingId = uid()
    busyRef.current = true
    setBusy(true)
    setBubbles((current) => [
      ...current,
      { id: pendingId, role: 'mascot', text: t(exercise ? 'tutor.workingExercise' : 'tutor.working'), pending: true },
    ])
    try {
      const result = await requestTutorDeck({
        topic: turn.topic,
        count: turn.count,
        glossLocale: locale,
        subject: {
          kind: activeSubject.kind,
          title: activeSubject.title,
          locale: activeSubject.locale,
          presetId: activeSubject.presetId,
        },
        kind: exercise ? 'exercise' : 'words',
        avoid: avoidTerms(cards, decks, activeSubject.id, exercise),
      })
      applyQuota(result.quota)
      const deck = addDeck({
        title: result.title,
        description: text.slice(0, 140),
        color: COLORS[decks.length % COLORS.length],
        kind: exercise ? 'exercise' : 'words',
      })
      if (!deck) throw new TutorApiError('failed', result.quota)
      addCards(
        result.cards.map((card) =>
          createCard({
            deckId: deck.id,
            userId: user.id,
            type: card.type,
            term: card.term || card.target,
            translation: card.translation,
            sentence: card.sentence,
            target: card.target,
            explanation: card.explanation,
          }),
        ),
      )
      const key = result.limited
        ? exercise
          ? 'tutor.doneShortExercise'
          : 'tutor.doneShort'
        : exercise
          ? 'tutor.doneExercise'
          : 'tutor.done'
      setBubbles((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                id: pendingId,
                role: 'mascot',
                text: t(key, {
                  count: countInline(exercise ? 'tasks' : 'words', result.cards.length),
                  title: result.title,
                }),
                deckId: deck.id,
                exercise,
                preview: result.cards
                  .slice(0, 3)
                  .map((card) => (card.sentence ? card.sentence.replaceAll('{blank}', '___') : card.term))
                  .join(' · '),
              }
            : item,
        ),
      )
    } catch (error) {
      const code = error instanceof TutorApiError ? error.code : 'failed'
      const quota = error instanceof TutorApiError ? error.quota : undefined
      if (quota) applyQuota(quota)
      else void loadQuota()
      const reply =
        code === 'limit'
          ? t('tutor.limit')
          : code === 'unconfigured'
            ? t('tutor.unconfigured')
            : code === 'unauthorized'
              ? t('tutor.unauthorized')
              : code === 'quota_unavailable'
                ? t('tutor.quotaDown')
                : t(exercise ? 'tutor.failedExercise' : 'tutor.failed')
      setBubbles((current) =>
        current.map((item) => (item.id === pendingId ? { id: pendingId, role: 'mascot', text: reply } : item)),
      )
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const status = quotaLabel(quotaState, blocked, exercise, t, countInline)

  return createPortal(
    <>
      {open ? (
        <section
          role="dialog"
          aria-label={t('tutor.title')}
          className="animate-rise fixed right-3 z-40 flex h-[min(32rem,calc(100dvh-7.5rem-env(safe-area-inset-bottom)))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[var(--shadow)] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6"
        >
          <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Mascot size={52} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-none">{t('tutor.title')}</p>
              <p className={clsx('mt-1 text-xs leading-5', blocked ? 'text-warn' : 'text-muted')}>{status}</p>
            </div>
            <button
              type="button"
              aria-label={t('tutor.close')}
              onClick={close}
              className="inline-flex size-10 items-center justify-center rounded-2xl text-muted hover:bg-surface hover:text-fg"
            >
              <X size={18} />
            </button>
          </header>
          <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 thin-scrollbar" aria-live="polite">
            {bubbles.map((item) => (
              <div key={item.id} className={item.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    item.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm leading-5 text-accent-fg'
                      : clsx(
                          'max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-sm leading-5 text-fg',
                          item.pending && 'animate-pulse',
                        )
                  }
                >
                  <p>{item.text}</p>
                  {item.preview ? <p className="mt-1 text-xs leading-5 text-muted">{item.preview}</p> : null}
                  {item.deckId ? (
                    <Link
                      to={item.exercise ? `/exercises/${item.deckId}` : `/decks/${item.deckId}`}
                      onClick={close}
                      className="mt-2 inline-flex font-semibold text-accent"
                    >
                      {t(item.exercise ? 'tutor.openExercise' : 'tutor.openDeck')}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
            {showHint ? (
              <button
                type="button"
                onClick={() => void send(t(exercise ? 'tutor.chipExercise' : 'tutor.chip'))}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-sm text-fg hover:bg-surface"
              >
                {t(exercise ? 'tutor.chipExercise' : 'tutor.chip')}
              </button>
            ) : null}
          </div>
          <form
            className="flex items-end gap-2 border-t border-line p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void send(input)
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t(exercise ? 'tutor.placeholderExercise' : 'tutor.placeholder')}
              aria-label={t(exercise ? 'tutor.placeholderExercise' : 'tutor.placeholder')}
              maxLength={160}
              disabled={!ready || busy || blocked}
              autoComplete="off"
              enterKeyHint="send"
              className="min-h-11 w-full min-w-0 flex-1 rounded-2xl border border-line bg-bg px-3 text-[16px] text-fg outline-none placeholder:text-muted/70 focus:border-accent disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label={t('tutor.send')}
              disabled={!ready || busy || blocked || !input.trim()}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </form>
        </section>
      ) : (
        <button
          ref={launcherRef}
          type="button"
          aria-expanded={false}
          aria-haspopup="dialog"
          aria-label={t('tutor.open')}
          onClick={() => setOpen(true)}
          className="fixed right-4 z-40 flex size-16 items-center justify-center rounded-full border border-line bg-card shadow-[var(--shadow)] transition hover:scale-105 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6"
        >
          <Mascot size={72} className="pointer-events-none -mt-3" />
          {quotaState.status === 'ready' ? (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-5 text-accent-fg">
              {wordsLeft(quotaState.quota)}
            </span>
          ) : null}
        </button>
      )}
    </>,
    document.body,
  )
}

function quotaLabel(
  quotaState: QuotaState,
  blocked: boolean,
  exercise: boolean,
  t: (key: 'common.loading' | 'tutor.statusOff' | 'tutor.statusUnknown' | 'tutor.limit' | 'tutor.today', vars?: Record<string, string | number>) => string,
  countInline: (kind: 'words' | 'tasks' | 'requests', count: number) => string,
): string {
  if (quotaState.status === 'loading') return t('common.loading')
  if (quotaState.status === 'unconfigured') return t('tutor.statusOff')
  if (quotaState.status === 'error' || blocked) {
    return quotaState.status === 'error' ? t('tutor.statusUnknown') : t('tutor.limit')
  }
  return t('tutor.today', {
    words: countInline(exercise ? 'tasks' : 'words', wordsLeft(quotaState.quota)),
    requests: countInline('requests', requestsLeft(quotaState.quota)),
  })
}

function avoidTerms(cards: Card[], decks: Deck[], subjectId: string, exercise: boolean): string[] {
  const mine = cardsInSubject(cards, decks, subjectId).filter((card) =>
    exercise ? card.type === 'cloze' || card.type === 'transform' : card.type === 'vocab',
  )
  mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const seen = new Set<string>()
  const out: string[] = []
  for (const card of mine) {
    const raw = card.type === 'cloze' ? (card.sentence ?? card.term) : card.term
    const term = raw.trim().slice(0, exercise ? 140 : 40)
    const key = term.toLocaleLowerCase()
    if (!term || seen.has(key)) continue
    seen.add(key)
    out.push(term)
    if (out.length >= 20) break
  }
  return out
}
