import { Check, GraduationCap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SessionView } from '../components/session/SessionView'
import { Button, Card, EmptyState, Input, List, Page, Screen } from '../components/ui'
import { useI18n } from '../i18n/translate'
import { exerciseCards, vocabCards } from '../lib/srs'
import { decksInSubject } from '../lib/subjects'
import { clsx } from '../lib/utils'
import { useAppStore } from '../store/app-store'

const DRAFT_KEY = 'parola.exam-setup'
const PRESETS = [5, 10, 20]

type Draft = { words: string[]; tasks: string[]; count: number }

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return { words: [], tasks: [], count: 10 }
    const parsed = JSON.parse(raw) as Partial<Draft>
    return {
      words: stringList(parsed.words),
      tasks: stringList(parsed.tasks),
      count: typeof parsed.count === 'number' && parsed.count > 0 ? Math.floor(parsed.count) : 10,
    }
  } catch {
    return { words: [], tasks: [], count: 10 }
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function ExamPage() {
  const { t, countInline } = useI18n()
  const fromDeck = t('exam.fromDeck')
  const navigate = useNavigate()
  const { decks: allDecks, cards, ready, activeSubject } = useAppStore()
  const decks = decksInSubject(allDecks, activeSubject?.id)
  const initial = useMemo(() => loadDraft(), [])
  const [wordIds, setWordIds] = useState(initial.words)
  const [taskIds, setTaskIds] = useState(initial.tasks)
  const [count, setCount] = useState(initial.count)

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ words: wordIds, tasks: taskIds, count }))
  }, [wordIds, taskIds, count])

  const wordSources = useMemo(
    () =>
      decks
        .filter((deck) => deck.kind !== 'exercise')
        .map((deck) => ({
          id: deck.id,
          title: deck.title,
          color: deck.color,
          count: vocabCards(cards.filter((card) => card.deckId === deck.id)).length,
        }))
        .filter((source) => source.count > 0),
    [decks, cards],
  )

  const taskSources = useMemo(() => {
    const sets = decks
      .filter((deck) => deck.kind === 'exercise')
      .map((deck) => ({
        id: deck.id,
        title: deck.title,
        color: deck.color,
        count: exerciseCards(cards.filter((card) => card.deckId === deck.id)).length,
        note: '',
      }))
    const leftover = decks
      .filter((deck) => deck.kind !== 'exercise')
      .map((deck) => ({
        id: deck.id,
        title: deck.title,
        color: deck.color,
        count: exerciseCards(cards.filter((card) => card.deckId === deck.id)).length,
        note: fromDeck,
      }))
    return [...sets, ...leftover].filter((source) => source.count > 0)
  }, [decks, cards, fromDeck])

  const pool = useMemo(() => {
    const words = new Set(wordIds)
    const tasks = new Set(taskIds)
    return (
      vocabCards(cards).filter((card) => words.has(card.deckId)).length +
      exerciseCards(cards).filter((card) => tasks.has(card.deckId)).length
    )
  }, [cards, taskIds, wordIds])

  const take = pool === 0 ? 0 : Math.min(Math.max(count, 0), pool)
  const allPreset = pool > 0 && count === pool && !PRESETS.includes(pool)

  const start = () => {
    if (take === 0) return
    const params = new URLSearchParams()
    const words = wordIds.filter((id) => wordSources.some((source) => source.id === id))
    const tasks = taskIds.filter((id) => taskSources.some((source) => source.id === id))
    if (words.length) params.set('words', words.join(','))
    if (tasks.length) params.set('tasks', tasks.join(','))
    params.set('count', String(take))
    navigate(`/exam/run?${params.toString()}`)
  }

  const empty = wordSources.length === 0 && taskSources.length === 0

  return (
    <Page>
      <header className="mb-4 pt-2">
        <h1 className="font-display text-3xl lg:text-4xl">{t('exam.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t('exam.lead')}</p>
      </header>

      {empty ? (
        ready ? (
          <EmptyState
            title={t('exam.emptyTitle')}
            text={t('exam.emptyText')}
          />
        ) : (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        )
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="lg:sticky lg:top-8">
            <Card className="px-4 py-4">
              <p className="text-sm font-semibold">{t('exam.countLabel')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={pool > 0 && preset > pool}
                    onClick={() => setCount(preset)}
                    className={clsx(
                      'min-h-10 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-40',
                      count === preset ? 'bg-accent text-accent-fg' : 'bg-surface text-fg',
                    )}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pool === 0}
                  onClick={() => setCount(pool)}
                  className={clsx(
                    'min-h-10 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-40',
                    allPreset ? 'bg-accent text-accent-fg' : 'bg-surface text-fg',
                  )}
                >
                  {t('common.all')}
                </button>
              </div>
              <Input
                className="mt-3"
                type="number"
                inputMode="numeric"
                min={1}
                max={pool || undefined}
                value={count || ''}
                onChange={(event) => {
                  const raw = event.target.value
                  if (raw === '') {
                    setCount(0)
                    return
                  }
                  const next = Number(raw)
                  if (Number.isFinite(next)) setCount(Math.max(0, Math.floor(next)))
                }}
              />
              <p className="mt-3 text-sm leading-6 text-muted">
                {pool === 0
                  ? t('exam.pick')
                  : `${t('exam.selected', { items: countInline('questions', pool) })}${
                      count > pool ? t('exam.cap', { take }) : ''
                    }`}
              </p>
              <div className="mt-4 hidden lg:block">
                <Button className="w-full" disabled={take === 0} onClick={start}>
                  <GraduationCap size={16} />
                  {take > 0 ? t('exam.startN', { count: take }) : t('exam.start')}
                </Button>
              </div>
            </Card>
          </div>

          <div className="mt-8 space-y-8 max-lg:pb-28 lg:mt-0">
            {wordSources.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{t('exam.decks')}</h2>
                  <button
                    type="button"
                    className="text-sm font-semibold text-accent"
                    onClick={() =>
                      setWordIds(
                        wordSources.every((source) => wordIds.includes(source.id))
                          ? []
                          : wordSources.map((source) => source.id),
                      )
                    }
                  >
                    {wordSources.every((source) => wordIds.includes(source.id)) ? t('common.clear') : t('common.all')}
                  </button>
                </div>
                <List>
                  {wordSources.map((source) => (
                    <SourceButton
                      key={source.id}
                      title={source.title}
                      color={source.color}
                      detail={countInline('words', source.count)}
                      selected={wordIds.includes(source.id)}
                      onToggle={() =>
                        setWordIds((current) =>
                          current.includes(source.id)
                            ? current.filter((id) => id !== source.id)
                            : [...current, source.id],
                        )
                      }
                    />
                  ))}
                </List>
              </section>
            ) : null}

            {taskSources.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{t('exam.tasks')}</h2>
                  <button
                    type="button"
                    className="text-sm font-semibold text-accent"
                    onClick={() =>
                      setTaskIds(
                        taskSources.every((source) => taskIds.includes(source.id))
                          ? []
                          : taskSources.map((source) => source.id),
                      )
                    }
                  >
                    {taskSources.every((source) => taskIds.includes(source.id)) ? t('common.clear') : t('common.all')}
                  </button>
                </div>
                <List>
                  {taskSources.map((source) => (
                    <SourceButton
                      key={`${source.note}:${source.id}`}
                      title={source.title}
                      color={source.color}
                      detail={`${countInline('tasks', source.count)}${source.note ? ` · ${source.note}` : ''}`}
                      selected={taskIds.includes(source.id)}
                      onToggle={() =>
                        setTaskIds((current) =>
                          current.includes(source.id)
                            ? current.filter((id) => id !== source.id)
                            : [...current, source.id],
                        )
                      }
                    />
                  ))}
                </List>
              </section>
            ) : null}
          </div>
        </div>
      )}

      {empty ? null : (
        <div
          className="fixed inset-x-0 z-30 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <Button className="w-full" disabled={take === 0} onClick={start}>
            <GraduationCap size={16} />
            {take > 0 ? t('exam.startN', { count: take }) : t('exam.start')}
          </Button>
        </div>
      )}
    </Page>
  )
}

function SourceButton({
  title,
  detail,
  color,
  selected,
  onToggle,
}: {
  title: string
  detail: string
  color?: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={clsx(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface',
        selected && 'bg-surface',
      )}
    >
      <span
        className={clsx(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-lg border',
          selected ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-card',
        )}
      >
        {selected ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color ?? '#C45C26' }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{detail}</span>
      </span>
    </button>
  )
}

function parseIds(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

export function ExamSessionPage() {
  const [params] = useSearchParams()
  const { t } = useI18n()
  const { cards, ready } = useAppStore()
  const wordsKey = params.get('words') ?? ''
  const tasksKey = params.get('tasks') ?? ''
  const requested = Number(params.get('count') ?? '')

  const sessionCards = useMemo(() => {
    const words = new Set(parseIds(wordsKey))
    const tasks = new Set(parseIds(tasksKey))
    return [
      ...vocabCards(cards).filter((card) => words.has(card.deckId)),
      ...exerciseCards(cards).filter((card) => tasks.has(card.deckId)),
    ]
  }, [cards, tasksKey, wordsKey])

  if (!ready) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center text-sm text-muted">{t('common.loading')}</div>
      </Screen>
    )
  }

  const limit = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : sessionCards.length

  return (
    <SessionView
      key={`${wordsKey}|${tasksKey}|${limit}`}
      cards={sessionCards}
      title={t('exam.title')}
      practice
      exam
      limit={limit}
      exitTo="/exam"
    />
  )
}
