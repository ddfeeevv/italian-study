import { Check, GraduationCap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SessionView } from '../components/session/SessionView'
import { Button, Card, EmptyState, Input, Page, Screen } from '../components/ui'
import { exerciseCards, vocabCards } from '../lib/srs'
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

function plural(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export function ExamPage() {
  const navigate = useNavigate()
  const { decks, cards, ready } = useAppStore()
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
        note: 'из колоды',
      }))
    return [...sets, ...leftover].filter((source) => source.count > 0)
  }, [decks, cards])

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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Проверка</p>
        <h1 className="mt-1 font-display text-3xl lg:text-4xl">Экзамен</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Случайные вопросы из выбранных колод и упражнений. Слово заранее не показывается: сначала выбор, потом
          написание. Ошибка не повторяется, интервалы не двигаются.
        </p>
      </header>

      {empty ? (
        ready ? (
          <EmptyState
            title="Пока не из чего"
            text="Добавьте слова в колоду или задания в упражнение — после этого можно сдавать экзамен."
          />
        ) : (
          <p className="text-sm text-muted">Загрузка…</p>
        )
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="order-2 mt-8 lg:order-1 lg:sticky lg:top-8 lg:mt-0">
            <Card className="px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Вопросов</p>
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
                  Все
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
                  ? 'Выберите колоды или упражнения.'
                  : `В выбранном ${pool} ${plural(pool, ['вопрос', 'вопроса', 'вопросов'])}.${
                      count > pool ? ` Возьмём ${take}.` : ''
                    }`}
              </p>
              <Button className="mt-4 w-full" disabled={take === 0} onClick={start}>
                <GraduationCap size={16} />
                {take > 0 ? `Начать · ${take}` : 'Начать'}
              </Button>
            </Card>
          </div>

          <div className="order-1 space-y-8 lg:order-2">
            {wordSources.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Колоды</h2>
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
                    {wordSources.every((source) => wordIds.includes(source.id)) ? 'Снять' : 'Все'}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {wordSources.map((source) => (
                    <SourceButton
                      key={source.id}
                      title={source.title}
                      color={source.color}
                      detail={`${source.count} ${plural(source.count, ['слово', 'слова', 'слов'])}`}
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
                </div>
              </section>
            ) : null}

            {taskSources.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Упражнения</h2>
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
                    {taskSources.every((source) => taskIds.includes(source.id)) ? 'Снять' : 'Все'}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {taskSources.map((source) => (
                    <SourceButton
                      key={`${source.note}:${source.id}`}
                      title={source.title}
                      color={source.color}
                      detail={`${source.count} ${plural(source.count, ['задание', 'задания', 'заданий'])}${
                        source.note ? ` · ${source.note}` : ''
                      }`}
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
                </div>
              </section>
            ) : null}
          </div>
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
    <button type="button" onClick={onToggle} aria-pressed={selected} className="block h-full w-full text-left">
      <Card
        className={clsx(
          'flex h-full items-center gap-3 px-4 py-3.5 transition active:scale-[0.99]',
          selected ? 'border-accent' : 'hover:border-accent',
        )}
      >
        <span
          className={clsx(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-lg border',
            selected ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface',
          )}
        >
          {selected ? <Check size={14} strokeWidth={3} /> : null}
        </span>
        <span className="size-9 shrink-0 rounded-xl" style={{ background: color ?? '#C45C26' }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="mt-0.5 block truncate text-sm text-muted">{detail}</span>
        </span>
      </Card>
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
        <div className="flex flex-1 items-center justify-center text-sm text-muted">Загрузка…</div>
      </Screen>
    )
  }

  const limit = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : sessionCards.length

  return (
    <SessionView
      key={`${wordsKey}|${tasksKey}|${limit}`}
      cards={sessionCards}
      title="Экзамен"
      practice
      exam
      limit={limit}
      exitTo="/exam"
    />
  )
}
