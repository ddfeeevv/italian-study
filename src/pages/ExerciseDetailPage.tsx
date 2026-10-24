import { ListPlus, Pencil, PenLine, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, EmptyState, Field, IconButton, Input, Page, Sheet, Textarea } from '../components/ui'
import { linesToCards, parseExerciseText } from '../lib/import-export'
import { createCard, exerciseCards } from '../lib/srs'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { TYPE_LABELS, type Card as StudyCard, type CardType } from '../types/models'
import { DeckForm } from './DecksPage'

type AddMode = 'menu' | 'manual' | 'bulk' | null

export function ExerciseDetailPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { decks, cardsByDeck, updateDeck, deleteDeck, addCards, updateCard, deleteCard } = useAppStore()
  const deck = decks.find((item) => item.id === deckId)
  const tasks = exerciseCards(deckId ? cardsByDeck(deckId) : [])
  const legacy = deck?.kind !== 'exercise'
  const [editingDeck, setEditingDeck] = useState(false)
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)

  if (!deck || !deckId) {
    return (
      <Page>
        <EmptyState
          title="Упражнение не найдено"
          text="Возможно, его уже удалили."
          action={<Link to="/exercises">Назад</Link>}
        />
      </Page>
    )
  }

  const removeExercise = () => {
    if (window.confirm('Удалить упражнение и все его задания?')) {
      deleteDeck(deck.id)
      navigate('/exercises')
    }
  }

  return (
    <Page>
      <div className="lg:grid lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-8">
          <button type="button" onClick={() => navigate('/exercises')} className="mb-3 text-sm font-medium text-muted">
            ← Упражнения
          </button>

          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl leading-tight">{deck.title}</h1>
              {deck.description ? <p className="mt-2 text-sm leading-6 text-muted">{deck.description}</p> : null}
              <p className="mt-3 text-sm text-muted">
                {tasks.length} {taskCountLabel(tasks.length)}
                {legacy ? ' · из колоды' : ''}
              </p>
            </div>
            {legacy ? null : (
              <IconButton label="Изменить упражнение" onClick={() => setEditingDeck(true)}>
                <Pencil size={18} />
              </IconButton>
            )}
          </header>

          {legacy ? (
            <p className="mb-4 text-sm leading-6 text-muted">
              Эти задания лежали в колоде. Новые упражнения создаются отдельно, кнопкой «+».
            </p>
          ) : null}

          <Button className="mb-6 w-full" disabled={tasks.length === 0} onClick={() => navigate(`/drill/${deck.id}`)}>
            <Play size={16} />
            Пройти
          </Button>

          {legacy ? null : (
            <button type="button" className="hidden text-sm text-danger lg:inline" onClick={removeExercise}>
              Удалить упражнение
            </button>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Задания</h2>
            {legacy ? null : (
              <button
                type="button"
                onClick={() => setAddMode('menu')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
              >
                <Plus size={16} />
                Добавить
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            legacy ? (
              <EmptyState title="Заданий не осталось" text="Новые упражнения создаются на вкладке «Упражнения»." />
            ) : (
              <EmptyState
                title="Пока нет заданий"
                text="Добавьте пропуск или форму — по одному или списком."
                action={<Button onClick={() => setAddMode('menu')}>Первое задание</Button>}
              />
            )
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {tasks.map((card) => (
                <Card key={card.id} className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => setEditingCard(card)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{card.type === 'cloze' ? card.sentence ?? card.term : card.term}</p>
                    <p className="truncate text-sm text-muted">{card.target}</p>
                  </button>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-1 text-[11px] font-semibold text-muted">
                    {TYPE_LABELS[card.type]}
                  </span>
                  <IconButton label="Удалить задание" onClick={() => deleteCard(card.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}

          {legacy ? null : (
            <button type="button" className="mt-8 text-sm text-danger lg:hidden" onClick={removeExercise}>
              Удалить упражнение
            </button>
          )}
        </div>
      </div>

      {editingDeck ? (
        <DeckForm
          kind="exercise"
          initial={deck}
          onCancel={() => setEditingDeck(false)}
          onSave={(input, existing) => {
            if (existing) updateDeck({ ...existing, ...input, kind: 'exercise' })
            setEditingDeck(false)
          }}
        />
      ) : null}

      {addMode === 'menu' ? (
        <AddChooser onManual={() => setAddMode('manual')} onBulk={() => setAddMode('bulk')} onCancel={() => setAddMode(null)} />
      ) : null}

      {addMode === 'manual' || editingCard ? (
        <TaskForm
          initial={editingCard ?? undefined}
          onCancel={() => {
            setEditingCard(null)
            setAddMode(null)
          }}
          onSave={(draft) => {
            if (!user) return
            if (editingCard) {
              updateCard({ ...editingCard, ...draft, target: draft.target })
            } else {
              addCards([createCard({ ...draft, deckId: deck.id, userId: user.id })])
            }
            setEditingCard(null)
            setAddMode(null)
          }}
        />
      ) : null}

      {addMode === 'bulk' ? (
        <BulkSheet
          onCancel={() => setAddMode(null)}
          onImport={(parsed) => {
            if (!user) return
            addCards(linesToCards(deck.id, user.id, parsed))
            setAddMode(null)
          }}
        />
      ) : null}
    </Page>
  )
}

function taskCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'задание'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задания'
  return 'заданий'
}

function AddChooser({
  onManual,
  onBulk,
  onCancel,
}: {
  onManual: () => void
  onBulk: () => void
  onCancel: () => void
}) {
  return (
    <Sheet onClose={onCancel}>
          <p className="mb-3 text-center text-sm font-semibold text-muted">Добавить задание</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onManual}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface text-accent">
                <PenLine size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold">Вручную</span>
                <span className="block text-xs text-muted">Один пропуск или форма</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onBulk}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface text-accent">
                <ListPlus size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold">Списком</span>
                <span className="block text-xs text-muted">Несколько строк сразу</span>
              </span>
            </button>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
    </Sheet>
  )
}

function BulkSheet({
  onCancel,
  onImport,
}: {
  onCancel: () => void
  onImport: (parsed: ReturnType<typeof parseExerciseText>['items']) => void
}) {
  const [bulk, setBulk] = useState('')
  const preview = useMemo(() => parseExerciseText(bulk), [bulk])

  return (
    <Sheet>
        <h2 className="font-display text-2xl">Список заданий</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Пропуск: <code className="rounded bg-surface px-1.5">Noi {'{blank}'} il treno | prendiamo</code>
          <br />
          Форма: <code className="rounded bg-surface px-1.5">la casa nuova (plurale) | le case nuove</code>
        </p>
        <Textarea
          className="mt-4"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          placeholder={"Noi {blank} il treno | prendiamo | 1 лицо мн.ч.\nla casa nuova (plurale) | le case nuove"}
        />
        {preview.items.length > 0 || preview.skipped > 0 ? (
          <p className="mt-3 text-sm text-muted">
            Заданий: {preview.items.length}
            {preview.skipped > 0 ? `. Пропущено строк: ${preview.skipped}` : ''}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button disabled={preview.items.length === 0} onClick={() => onImport(preview.items)}>
            Добавить {preview.items.length || ''}
          </Button>
        </div>
    </Sheet>
  )
}

function TaskForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: StudyCard
  onSave: (draft: {
    type: CardType
    term: string
    sentence?: string
    target: string
    options?: string[]
    explanation?: string
  }) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<CardType>(initial?.type === 'transform' ? 'transform' : 'cloze')
  const [term, setTerm] = useState(initial?.term ?? '')
  const [sentence, setSentence] = useState(initial?.sentence ?? '')
  const [target, setTarget] = useState(initial?.target ?? '')
  const [options, setOptions] = useState((initial?.options ?? []).join(', '))
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const canSave = type === 'cloze' ? sentence.includes('{blank}') && target.trim() : term.trim() && target.trim()

  return (
    <Sheet>
        <h2 className="font-display text-2xl">{initial ? 'Задание' : 'Новое задание'}</h2>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 text-sm">
            {(['cloze', 'transform'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={type === id ? 'min-h-10 rounded-xl bg-card font-semibold' : 'min-h-10 rounded-xl text-muted'}
              >
                {TYPE_LABELS[id]}
              </button>
            ))}
          </div>
          {type === 'cloze' ? (
            <Field label="Предложение с {blank}">
              <Input value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder="Noi {blank} la metro." />
            </Field>
          ) : (
            <Field label="Исходная форма">
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="la casa nuova (plurale)" />
            </Field>
          )}
          <Field label={type === 'cloze' ? 'Правильный пропуск' : 'Правильный ответ'}>
            <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder={type === 'cloze' ? 'prendiamo' : 'le case nuove'} />
          </Field>
          {type === 'cloze' ? (
            <Field label="Подсказка">
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="prendere" />
            </Field>
          ) : null}
          <Field label="Варианты через запятую">
            <Input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="необязательно" />
          </Field>
          <Field label="Объяснение при ошибке">
            <Textarea className="min-h-20" value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="необязательно" />
          </Field>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSave({
                type,
                term: term.trim() || target.trim(),
                sentence: sentence.trim() || undefined,
                target: target.trim(),
                options: options.split(',').map((part) => part.trim()).filter(Boolean),
                explanation: explanation.trim() || undefined,
              })
            }
          >
            Сохранить
          </Button>
        </div>
    </Sheet>
  )
}
