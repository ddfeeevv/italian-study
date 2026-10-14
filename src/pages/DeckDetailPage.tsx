import { Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SpeakButton } from '../components/SpeakButton'
import { Button, Card, EmptyState, Field, IconButton, Input, Page, Textarea } from '../components/ui'
import { createCard, dueCount } from '../lib/srs'
import { italianSpeechText } from '../lib/tts'
import { STAGE_LABELS, TYPE_LABELS, type Card as StudyCard, type CardType } from '../types/models'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { DeckForm } from './DecksPage'

export function DeckDetailPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { decks, cardsByDeck, updateDeck, deleteDeck, addCards, updateCard, deleteCard } = useAppStore()
  const deck = decks.find((item) => item.id === deckId)
  const cards = deckId ? cardsByDeck(deckId) : []
  const due = dueCount(cards)
  const [editingDeck, setEditingDeck] = useState(false)
  const [editingCard, setEditingCard] = useState<StudyCard | 'new' | null>(null)

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
        <button type="button" onClick={() => setEditingCard('new')} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          title="В колоде нет слов"
          text="Добавьте карточки по одной или вставьте список на экране «Слова»."
          action={<Button onClick={() => setEditingCard('new')}>Первое слово</Button>}
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

      {editingCard ? (
        <CardForm
          initial={editingCard === 'new' ? undefined : editingCard}
          onCancel={() => setEditingCard(null)}
          onSave={(draft) => {
            if (!user) return
            if (editingCard === 'new') {
              addCards([createCard({ ...draft, deckId: deck.id, userId: user.id })])
            } else {
              updateCard({ ...editingCard, ...draft, target: draft.target || draft.term })
            }
            setEditingCard(null)
          }}
        />
      ) : null}
    </Page>
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
