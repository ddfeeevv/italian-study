import { ListPlus, Pencil, PenLine, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SpeakButton } from '../components/SpeakButton'
import { Button, Card, EmptyState, Field, IconButton, Input, Page, Sheet, Textarea } from '../components/ui'
import { linesToCards, parseWordText } from '../lib/import-export'
import { createCard, dueCount, vocabCards } from '../lib/srs'
import { italianSpeechText } from '../lib/tts'
import { STAGE_LABELS, type Card as StudyCard } from '../types/models'
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
  const words = vocabCards(cards)
  const dueWords = dueCount(words)
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

  if (deck.kind === 'exercise') {
    return <Navigate to={`/exercises/${deck.id}`} replace />
  }

  const removeDeck = () => {
    if (window.confirm('Удалить колоду и все её карточки?')) {
      deleteDeck(deck.id)
      navigate('/')
    }
  }

  return (
    <Page>
      <div className="lg:grid lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-8">
          <button type="button" onClick={() => navigate('/')} className="mb-3 text-sm font-medium text-muted">
            ← Колоды
          </button>

          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl leading-tight">{deck.title}</h1>
              {deck.description ? <p className="mt-2 text-sm leading-6 text-muted">{deck.description}</p> : null}
              <p className="mt-3 text-sm text-muted">
                {words.length} слов · {dueWords} к повторению
              </p>
            </div>
            <IconButton label="Изменить колоду" onClick={() => setEditingDeck(true)}>
              <Pencil size={18} />
            </IconButton>
          </header>

          <Button className="mb-6 w-full" disabled={dueWords === 0} onClick={() => navigate(`/study/${deck.id}`)}>
            <Play size={16} />
            Учить
          </Button>

          <button type="button" className="hidden text-sm text-danger lg:inline" onClick={removeDeck}>
            Удалить колоду
          </button>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Слова</h2>
            <button
              type="button"
              onClick={() => setAddMode('menu')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
            >
              <Plus size={16} />
              Добавить
            </button>
          </div>

          {words.length === 0 ? (
            <EmptyState
              title="В колоде нет слов"
              text="Добавьте по одному или вставьте список: слово — перевод."
              action={<Button onClick={() => setAddMode('menu')}>Первое слово</Button>}
            />
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {words.map((card) => (
                <Card key={card.id} className="flex items-center gap-3 px-4 py-3">
                  <SpeakButton text={italianSpeechText(card)} />
                  <button type="button" onClick={() => setEditingCard(card)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{card.term}</p>
                    <p className="truncate text-sm text-muted">{card.translation}</p>
                  </button>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-1 text-[11px] font-semibold text-muted">
                    {STAGE_LABELS[card.stage]}
                  </span>
                  <IconButton label="Удалить карточку" onClick={() => deleteCard(card.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}

          <button type="button" className="mt-8 text-sm text-danger lg:hidden" onClick={removeDeck}>
            Удалить колоду
          </button>
        </div>
      </div>

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
    <Sheet onClose={onCancel}>
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
                <span className="block text-xs text-muted">Одно слово и перевод</span>
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
    </Sheet>
  )
}

function BulkImportSheet({
  onCancel,
  onImport,
}: {
  onCancel: () => void
  onImport: (parsed: ReturnType<typeof parseWordText>['items']) => void
}) {
  const [bulk, setBulk] = useState('')
  const preview = useMemo(() => parseWordText(bulk), [bulk])

  return (
    <Sheet>
        <h2 className="font-display text-2xl">Пакетный импорт</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Каждая строка — слово и перевод: <code className="rounded bg-surface px-1.5">lavorare - работать</code>
        </p>
        <Textarea
          className="mt-4"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          placeholder={'lavorare - работать\nciao, привет\ngrazie; спасибо'}
        />
        {preview.items.length > 0 || preview.skipped > 0 ? (
          <p className="mt-3 text-sm text-muted">
            Слов: {preview.items.length}
            {preview.items.length > 0
              ? `. ${preview.items
                  .slice(0, 3)
                  .map((line) => line.term)
                  .join(', ')}${preview.items.length > 3 ? '…' : ''}`
              : ''}
            {preview.skipped > 0 ? `. Пропущено строк: ${preview.skipped} — это не слова.` : ''}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button disabled={preview.items.length === 0} onClick={() => onImport(preview.items)}>
            Импорт {preview.items.length || ''}
          </Button>
        </div>
    </Sheet>
  )
}

function CardForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: StudyCard
  onSave: (draft: {
    type: 'vocab'
    term: string
    translation?: string
    target?: string
    explanation?: string
    notes?: string
  }) => void
  onCancel: () => void
}) {
  const [term, setTerm] = useState(initial?.term ?? '')
  const [translation, setTranslation] = useState(initial?.translation ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const canSave = Boolean(term.trim() && translation.trim())

  return (
    <Sheet>
        <h2 className="font-display text-2xl">{initial ? 'Слово' : 'Новое слово'}</h2>
        <div className="mt-5 space-y-4">
          <Field label="Слово">
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="lavorare" />
          </Field>
          <Field label="Перевод">
            <Input value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder="работать" />
          </Field>
          <Field label="Объяснение при ошибке">
            <Textarea className="min-h-20" value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="необязательно" />
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
                type: 'vocab',
                term: term.trim(),
                translation: translation.trim(),
                target: term.trim(),
                explanation: explanation.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            Сохранить
          </Button>
        </div>
    </Sheet>
  )
}
