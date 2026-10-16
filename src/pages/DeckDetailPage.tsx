import { ListPlus, Pencil, PenLine, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SpeakButton } from '../components/SpeakButton'
import { Button, Card, EmptyState, Field, IconButton, Input, Page, Textarea } from '../components/ui'
import { linesToCards, parseBulkText } from '../lib/import-export'
import { createCard, dueCount } from '../lib/srs'
import { italianSpeechText } from '../lib/tts'
import { STAGE_LABELS, TYPE_LABELS, type Card as StudyCard, type CardType } from '../types/models'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { DeckForm } from './DecksPage'

type AddMode = 'menu' | 'manual' | 'bulk' | null

export function DeckDetailPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { decks, cardsByDeck, updateDeck, deleteDeck, addCards, updateCard, deleteCard } = useAppStore()
  const deck = decks.find((item) => item.id === deckId)
  const cards = deckId ? cardsByDeck(deckId) : []
  const due = dueCount(cards)
  const [editingDeck, setEditingDeck] = useState(false)
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)

  if (!deck || !deckId) {
    return (
      <Page>
        <EmptyState title="Колода не найдена" text="Возможно, её уже удалили." action={<Link to="/">Назад</Link>} />
      </Page>
    )
  }

  return (
    <Page>
      <button type="button" onClick={() => navigate('/')} className="mb-3 text-sm font-medium text-muted">
        ← Колоды
      </button>

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight">{deck.title}</h1>
          {deck.description ? <p className="mt-2 text-sm leading-6 text-muted">{deck.description}</p> : null}
          <p className="mt-3 text-sm text-muted">
            {cards.length} карточек · {due} к повторению
          </p>
        </div>
        <IconButton label="Изменить колоду" onClick={() => setEditingDeck(true)}>
          <Pencil size={18} />
        </IconButton>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Button className="w-full" disabled={due === 0} onClick={() => navigate(`/study/${deck.id}`)}>
          <Play size={16} />
          Учить {due > 0 ? `(${due})` : ''}
        </Button>
        <Button variant="secondary" className="w-full" disabled={cards.length === 0} onClick={() => navigate(`/study/${deck.id}?mode=all`)}>
          Практика
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Карточки</h2>
        <button
          type="button"
          onClick={() => setAddMode('menu')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          title="В колоде нет слов"
          text="Добавьте по одной или вставьте список через пакетный импорт."
          action={<Button onClick={() => setAddMode('menu')}>Первое слово</Button>}
        />
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <Card key={card.id} className="flex items-center gap-3 px-4 py-3">
              <SpeakButton text={italianSpeechText(card)} />
              <button type="button" onClick={() => setEditingCard(card)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">{card.type === 'cloze' ? card.sentence ?? card.term : card.term}</p>
                <p className="truncate text-sm text-muted">{card.target || card.translation}</p>
              </button>
              <span className="shrink-0 rounded-full bg-surface px-2 py-1 text-[11px] font-semibold text-muted">
                {TYPE_LABELS[card.type]} · {STAGE_LABELS[card.stage]}
              </span>
              <IconButton label="Удалить карточку" onClick={() => deleteCard(card.id)}>
                <Trash2 size={16} />
              </IconButton>
            </Card>
          ))}
        </div>
      )}

      <button
        type="button"
        className="mt-8 text-sm text-danger"
        onClick={() => {
          if (window.confirm('Удалить колоду и все её карточки?')) {
            deleteDeck(deck.id)
            navigate('/')
          }
        }}
      >
        Удалить колоду
      </button>

      {editingDeck ? (
        <DeckForm
          initial={deck}
          onCancel={() => setEditingDeck(false)}
          onSave={(input, existing) => {
            if (existing) updateDeck({ ...existing, ...input })
            setEditingDeck(false)
          }}
        />
      ) : null}

      {addMode === 'menu' ? (
        <AddChooser
          onManual={() => setAddMode('manual')}
          onBulk={() => setAddMode('bulk')}
          onCancel={() => setAddMode(null)}
        />
      ) : null}

      {addMode === 'manual' || editingCard ? (
        <CardForm
          initial={editingCard ?? undefined}
          onCancel={() => {
            setEditingCard(null)
            setAddMode(null)
          }}
          onSave={(draft) => {
            if (!user) return
            if (editingCard) {
              updateCard({ ...editingCard, ...draft, target: draft.target || draft.term })
            } else {
              addCards([createCard({ ...draft, deckId: deck.id, userId: user.id })])
            }
            setEditingCard(null)
            setAddMode(null)
          }}
        />
      ) : null}

      {addMode === 'bulk' ? (
        <BulkImportSheet
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div
        className="w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Card className="rounded-b-none px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-3xl">
          <p className="mb-3 text-center text-sm font-semibold text-muted">Добавить в колоду</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onManual}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left transition active:scale-[0.99] hover:border-accent"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface text-accent">
                <PenLine size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Вручную</span>
                <span className="block text-xs text-muted">Одна карточка: слово, пропуск или форма</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onBulk}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left transition active:scale-[0.99] hover:border-accent"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface text-accent">
                <ListPlus size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Пакетный импорт</span>
                <span className="block text-xs text-muted">Вставить список строк сразу</span>
              </span>
            </button>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        </Card>
      </div>
    </div>
  )
}

function BulkImportSheet({
  onCancel,
  onImport,
}: {
  onCancel: () => void
  onImport: (parsed: ReturnType<typeof parseBulkText>) => void
}) {
  const [bulk, setBulk] = useState('')
  const preview = useMemo(() => parseBulkText(bulk), [bulk])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
      <Card className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-b-none px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
        <h2 className="font-display text-2xl">Пакетный импорт</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Слова: <code className="rounded bg-surface px-1.5">lavorare - работать</code>
          <br />
          Пропуск: <code className="rounded bg-surface px-1.5">Noi {'{blank}'} il treno | prendiamo | 1 лицо мн.ч.</code>
          <br />
          Форма: <code className="rounded bg-surface px-1.5">la casa nuova (plurale) | le case nuove</code>
        </p>
        <Textarea
          className="mt-4"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          placeholder={'lavorare - работать\nscrivere - писать\nNoi {blank} il treno | prendiamo | 1 лицо мн.ч.'}
        />
        {preview.length > 0 ? (
          <p className="mt-3 text-sm text-muted">
            Распознано: {preview.length}. {preview.slice(0, 3).map((line) => line.target || line.term).join(', ')}
            {preview.length > 3 ? '…' : ''}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button disabled={preview.length === 0} onClick={() => onImport(preview)}>
            Импорт {preview.length || ''}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function CardForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: StudyCard
  onSave: (draft: {
    type: CardType
    term: string
    translation?: string
    sentence?: string
    target?: string
    options?: string[]
    explanation?: string
    notes?: string
  }) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<CardType>(initial?.type ?? 'vocab')
  const [term, setTerm] = useState(initial?.term ?? '')
  const [translation, setTranslation] = useState(initial?.translation ?? '')
  const [sentence, setSentence] = useState(initial?.sentence ?? '')
  const [target, setTarget] = useState(initial?.target ?? '')
  const [options, setOptions] = useState((initial?.options ?? []).join(', '))
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const canSave =
    type === 'vocab' ? term.trim() && translation.trim() : type === 'cloze' ? sentence.includes('{blank}') && target.trim() : term.trim() && target.trim()

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
      <Card className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-b-none px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
        <h2 className="font-display text-2xl">{initial ? 'Карточка' : 'Новая карточка'}</h2>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 text-sm">
            {(['vocab', 'cloze', 'transform'] as const).map((id) => (
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
            <Field label={type === 'transform' ? 'Исходная форма' : 'Слово'}>
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={type === 'transform' ? 'la casa nuova (plurale)' : 'lavorare'} />
            </Field>
          )}
          {type === 'vocab' ? (
            <Field label="Перевод">
              <Input value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder="работать" />
            </Field>
          ) : (
            <Field label={type === 'cloze' ? 'Правильный пропуск' : 'Правильный ответ'}>
              <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder={type === 'cloze' ? 'prendiamo' : 'le case nuove'} />
            </Field>
          )}
          {type === 'cloze' ? (
            <Field label="Подсказка / инфинитив">
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="prendere" />
            </Field>
          ) : null}
          {type !== 'vocab' ? (
            <Field label="Варианты через запятую">
              <Input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="prendo, prendiamo, prendete, prendono" />
            </Field>
          ) : null}
          <Field label="Объяснение при ошибке">
            <Textarea className="min-h-20" value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Перед S + согласная мужского рода используется LO" />
          </Field>
          <Field label="Заметка">
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="необязательно" />
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
                translation: translation.trim() || undefined,
                sentence: sentence.trim() || undefined,
                target: (target || term).trim(),
                options: options.split(',').map((part) => part.trim()).filter(Boolean),
                explanation: explanation.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            Сохранить
          </Button>
        </div>
      </Card>
    </div>
  )
}
