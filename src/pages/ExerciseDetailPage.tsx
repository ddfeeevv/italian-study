import { ListPlus, Pencil, PenLine, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, EmptyState, Field, IconButton, Input, List, Page, Sheet, Textarea } from '../components/ui'
import { ShareDeckButton } from '../components/ShareDeckButton'
import { linesToCards, parseExerciseText, sanitizeUserInput } from '../lib/import-export'
import { createCard, exerciseCards } from '../lib/srs'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { useI18n } from '../i18n/translate'
import type { MessageKey } from '../i18n/messages'
import type { Card as StudyCard, CardType } from '../types/models'
import { DeckForm } from './DecksPage'

type AddMode = 'menu' | 'manual' | 'bulk' | null

export function ExerciseDetailPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { t, plural } = useI18n()
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
          title={t('exercise.notFound')}
          text={t('exercise.gone')}
          action={<Link to="/exercises">{t('common.back')}</Link>}
        />
      </Page>
    )
  }

  const removeExercise = () => {
    if (window.confirm(t('exercise.confirmDelete'))) {
      deleteDeck(deck.id)
      navigate('/exercises')
    }
  }

  return (
    <Page>
      <div className="lg:grid lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-8">
          <button type="button" onClick={() => navigate('/exercises')} className="mb-3 text-sm font-medium text-muted">
            ← {t('nav.exercises')}
          </button>

          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl leading-tight">{deck.title}</h1>
              {deck.description ? <p className="mt-2 text-sm leading-6 text-muted">{deck.description}</p> : null}
              <p className="mt-3 text-sm text-muted">
                {tasks.length} {plural('tasks', tasks.length)}
                {legacy ? ` · ${t('exam.fromDeck')}` : ''}
              </p>
            </div>
            {legacy ? null : (
              <IconButton label={t('exercise.edit')} onClick={() => setEditingDeck(true)}>
                <Pencil size={18} />
              </IconButton>
            )}
          </header>

          {legacy ? (
            <p className="mb-4 text-sm leading-6 text-muted">
              {t('exercise.legacyNote')}
            </p>
          ) : null}

          <div className="mb-6 space-y-2">
            <Button className="w-full" disabled={tasks.length === 0} onClick={() => navigate(`/drill/${deck.id}`)}>
              <Play size={16} />
              {t('exercise.go')}
            </Button>
            <ShareDeckButton deckId={deck.id} />
          </div>

          {legacy ? null : (
            <button type="button" className="hidden text-sm text-danger lg:inline" onClick={removeExercise}>
              {t('exercise.delete')}
            </button>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('exercise.tasks')}</h2>
            {legacy ? null : (
              <button
                type="button"
                onClick={() => setAddMode('menu')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
              >
                <Plus size={16} />
                {t('common.add')}
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            legacy ? (
              <EmptyState title={t('exercise.legacyEmptyTitle')} text={t('exercise.legacyEmptyText')} />
            ) : (
              <EmptyState
                title={t('exercise.emptyTitle')}
                text={t('exercise.emptyText')}
                action={<Button onClick={() => setAddMode('menu')}>{t('exercise.first')}</Button>}
              />
            )
          ) : (
            <List>
              {tasks.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setEditingCard(card)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {card.type === 'cloze' ? card.sentence ?? card.term : card.term}
                    </span>
                    <span className="block truncate text-sm text-muted">{card.target}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{t(`type.${card.type}` as MessageKey)}</span>
                </button>
              ))}
            </List>
          )}

          {legacy ? null : (
            <button type="button" className="mt-8 text-sm text-danger lg:hidden" onClick={removeExercise}>
              {t('exercise.delete')}
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
            const clean = {
              ...draft,
              term: sanitizeUserInput(draft.term),
              sentence: draft.sentence ? sanitizeUserInput(draft.sentence) : undefined,
              target: sanitizeUserInput(draft.target || draft.term),
              explanation: draft.explanation ? sanitizeUserInput(draft.explanation) : undefined,
              options: draft.options?.map(sanitizeUserInput),
            }
            if (editingCard) {
              updateCard({
                ...editingCard,
                ...clean,
                sentence: clean.sentence ?? editingCard.sentence,
                options: clean.options ?? editingCard.options,
                target: clean.target,
              })
            } else {
              addCards([createCard({ ...clean, deckId: deck.id, userId: user.id })])
            }
            setEditingCard(null)
            setAddMode(null)
          }}
          onDelete={
            editingCard
              ? () => {
                  if (!window.confirm(t('deck.confirmDeleteCard'))) return
                  deleteCard(editingCard.id)
                  setEditingCard(null)
                  setAddMode(null)
                }
              : undefined
          }
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

function AddChooser({
  onManual,
  onBulk,
  onCancel,
}: {
  onManual: () => void
  onBulk: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  return (
    <Sheet onClose={onCancel}>
          <p className="mb-3 text-center text-sm font-semibold text-muted">{t('exercise.addTitle')}</p>
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
                <span className="block text-sm font-semibold">{t('deck.manual')}</span>
                <span className="block text-xs text-muted">{t('exercise.manualHint')}</span>
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
                <span className="block text-sm font-semibold">{t('exercise.list')}</span>
                <span className="block text-xs text-muted">{t('exercise.listHint')}</span>
              </span>
            </button>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
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
  const { t } = useI18n()
  const [bulk, setBulk] = useState('')
  const preview = useMemo(() => parseExerciseText(bulk), [bulk])

  return (
    <Sheet>
        <h2 className="font-display text-2xl">{t('exercise.listTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t('exercise.blankLine')} <code className="rounded bg-surface px-1.5">Noi {'{blank}'} il treno | prendiamo</code>
          <br />
          {t('exercise.formLine')} <code className="rounded bg-surface px-1.5">la casa nuova (plurale) | le case nuove</code>
        </p>
        <Textarea
          className="mt-4"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          placeholder={t('exercise.listPlaceholder')}
        />
        {preview.items.length > 0 || preview.skipped > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {t('exercise.previewCount', { count: preview.items.length })}
            {preview.skipped > 0 ? t('exercise.previewSkipped', { count: preview.skipped }) : ''}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={preview.items.length === 0} onClick={() => onImport(preview.items)}>
            {t('exercise.addN', { count: preview.items.length || '' })}
          </Button>
        </div>
    </Sheet>
  )
}

function TaskForm({
  initial,
  onSave,
  onCancel,
  onDelete,
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
  onDelete?: () => void
}) {
  const { t } = useI18n()
  const [type, setType] = useState<CardType>(initial?.type === 'transform' ? 'transform' : 'cloze')
  const [term, setTerm] = useState(initial?.term ?? '')
  const [sentence, setSentence] = useState(initial?.sentence ?? '')
  const [target, setTarget] = useState(initial?.target ?? '')
  const [options, setOptions] = useState((initial?.options ?? []).join(', '))
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const canSave = type === 'cloze' ? sentence.includes('{blank}') && target.trim() : term.trim() && target.trim()

  return (
    <Sheet>
        <h2 className="font-display text-2xl">{initial ? t('exercise.editTask') : t('exercise.newTask')}</h2>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 text-sm">
            {(['cloze', 'transform'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={type === id ? 'min-h-10 rounded-xl bg-card font-semibold' : 'min-h-10 rounded-xl text-muted'}
              >
                {t(`type.${id}` as MessageKey)}
              </button>
            ))}
          </div>
          {type === 'cloze' ? (
            <Field label={t('exercise.sentence', { blank: '{blank}' })}>
              <Input value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder={t('exercise.sentencePh')} />
            </Field>
          ) : (
            <Field label={t('exercise.source')}>
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t('exercise.sourcePh')} />
            </Field>
          )}
          <Field label={type === 'cloze' ? t('exercise.correctBlank') : t('exercise.correctAnswer')}>
            <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder={type === 'cloze' ? t('exercise.blankPh') : t('exercise.answerPh')} />
          </Field>
          {type === 'cloze' ? (
            <Field label={t('exercise.clue')}>
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t('exercise.cluePh')} />
            </Field>
          ) : null}
          <Field label={t('exercise.options')}>
            <Input value={options} onChange={(event) => setOptions(event.target.value)} placeholder={t('common.optional')} />
          </Field>
          <Field label={t('deck.explanation')}>
            <Textarea className="min-h-20" value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder={t('common.optional')} />
          </Field>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
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
            {t('common.save')}
          </Button>
        </div>
        {onDelete ? (
          <button type="button" onClick={onDelete} className="mt-4 w-full py-2 text-sm font-medium text-danger">
            {t('exercise.deleteTask')}
          </button>
        ) : null}
    </Sheet>
  )
}
