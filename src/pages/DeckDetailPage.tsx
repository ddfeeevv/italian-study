import { ListPlus, Pencil, PenLine, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SpeakButton } from '../components/SpeakButton'
import { Button, EmptyState, Field, IconButton, Input, List, Page, Sheet, Textarea } from '../components/ui'
import { linesToCards, parseWordText } from '../lib/import-export'
import { createCard, dueCount, vocabCards } from '../lib/srs'
import { speechText } from '../lib/tts'
import { subjectSpeech } from '../lib/subjects'
import { useI18n } from '../i18n/translate'
import type { MessageKey } from '../i18n/messages'
import type { Card as StudyCard } from '../types/models'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { DeckForm } from './DecksPage'

type AddMode = 'menu' | 'manual' | 'bulk' | null

export function DeckDetailPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const { t, plural } = useI18n()
  const { user } = useAuth()
  const { decks, cardsByDeck, subjects, updateDeck, deleteDeck, addCards, updateCard, deleteCard } = useAppStore()
  const deck = decks.find((item) => item.id === deckId)
  const cards = deckId ? cardsByDeck(deckId) : []
  const words = vocabCards(cards)
  const dueWords = dueCount(words)
  const [editingDeck, setEditingDeck] = useState(false)
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const subject = subjects.find((item) => item.id === deck?.subjectId)
  const speech = subjectSpeech(subject)
  const presetId = subject?.presetId

  if (!deck || !deckId) {
    return (
      <Page>
        <EmptyState title={t('deck.notFound')} text={t('deck.gone')} action={<Link to="/">{t('common.back')}</Link>} />
      </Page>
    )
  }

  if (deck.kind === 'exercise') {
    return <Navigate to={`/exercises/${deck.id}`} replace />
  }

  const removeDeck = () => {
    if (window.confirm(t('deck.confirmDelete'))) {
      deleteDeck(deck.id)
      navigate('/')
    }
  }

  return (
    <Page>
      <div className="lg:grid lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-8">
          <button type="button" onClick={() => navigate('/')} className="mb-3 text-sm font-medium text-muted">
            ← {t('nav.decks')}
          </button>

          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl leading-tight">{deck.title}</h1>
              {deck.description ? <p className="mt-2 text-sm leading-6 text-muted">{deck.description}</p> : null}
              <p className="mt-3 text-sm text-muted">
                {t('decks.metaDueOnly', { count: words.length, noun: plural('words', words.length), due: dueWords })}
              </p>
            </div>
            <IconButton label={t('deck.edit')} onClick={() => setEditingDeck(true)}>
              <Pencil size={18} />
            </IconButton>
          </header>

          <Button className="mb-6 w-full" disabled={dueWords === 0} onClick={() => navigate(`/study/${deck.id}`)}>
            <Play size={16} />
            {t('common.learn')}
          </Button>

          <button type="button" className="hidden text-sm text-danger lg:inline" onClick={removeDeck}>
            {t('deck.delete')}
          </button>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('deck.words')}</h2>
            <button
              type="button"
              onClick={() => setAddMode('menu')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
            >
              <Plus size={16} />
              {t('common.add')}
            </button>
          </div>

          {words.length === 0 ? (
            <EmptyState
              title={t('deck.emptyTitle')}
              text={t('deck.emptyText')}
              action={<Button onClick={() => setAddMode('menu')}>{t('deck.firstWord')}</Button>}
            />
          ) : (
            <List>
              {words.map((card) => (
                <div key={card.id} className="flex items-center gap-2 px-3 py-2">
                  <SpeakButton text={speechText(card)} locale={speech.locale} label={speech.label} />
                  <button type="button" onClick={() => setEditingCard(card)} className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{card.term}</span>
                      <span className="block truncate text-sm text-muted">{card.translation}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{t(`stage.${card.stage}` as MessageKey)}</span>
                  </button>
                </div>
              ))}
            </List>
          )}

          <button type="button" className="mt-8 text-sm text-danger lg:hidden" onClick={removeDeck}>
            {t('deck.delete')}
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
          presetId={presetId}
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
          onDelete={
            editingCard
              ? () => {
                  deleteCard(editingCard.id)
                  setEditingCard(null)
                  setAddMode(null)
                }
              : undefined
          }
        />
      ) : null}

      {addMode === 'bulk' ? (
        <BulkImportSheet
          presetId={presetId}
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
          <p className="mb-3 text-center text-sm font-semibold text-muted">{t('deck.addTitle')}</p>
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
                <span className="block text-sm font-semibold">{t('deck.manual')}</span>
                <span className="block text-xs text-muted">{t('deck.manualHint')}</span>
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
                <span className="block text-sm font-semibold">{t('deck.bulk')}</span>
                <span className="block text-xs text-muted">{t('deck.bulkHint')}</span>
              </span>
            </button>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
    </Sheet>
  )
}

function BulkImportSheet({
  presetId,
  onCancel,
  onImport,
}: {
  presetId?: string | null
  onCancel: () => void
  onImport: (parsed: ReturnType<typeof parseWordText>['items']) => void
}) {
  const { t, wordExample, bulkExample } = useI18n()
  const sample = wordExample(presetId)
  const [bulk, setBulk] = useState('')
  const preview = useMemo(() => parseWordText(bulk), [bulk])

  return (
    <Sheet>
        <h2 className="font-display text-2xl">{t('deck.bulkTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t('deck.bulkHelp')} <code className="rounded bg-surface px-1.5">{sample.term} - {sample.translation}</code>
        </p>
        <Textarea
          className="mt-4"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          placeholder={bulkExample(presetId)}
        />
        {preview.items.length > 0 || preview.skipped > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {t('deck.previewCount', { count: preview.items.length })}
            {preview.items.length > 0
              ? `. ${preview.items
                  .slice(0, 3)
                  .map((line) => line.term)
                  .join(', ')}${preview.items.length > 3 ? '…' : ''}`
              : ''}
            {preview.skipped > 0 ? t('deck.previewSkipped', { count: preview.skipped }) : ''}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={preview.items.length === 0} onClick={() => onImport(preview.items)}>
            {t('deck.import', { count: preview.items.length || '' })}
          </Button>
        </div>
    </Sheet>
  )
}

function CardForm({
  presetId,
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  presetId?: string | null
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
  onDelete?: () => void
}) {
  const { t, wordExample } = useI18n()
  const sample = wordExample(presetId)
  const [term, setTerm] = useState(initial?.term ?? '')
  const [translation, setTranslation] = useState(initial?.translation ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const canSave = Boolean(term.trim() && translation.trim())

  return (
    <Sheet>
        <h2 className="font-display text-2xl">{initial ? t('deck.editWord') : t('deck.newWord')}</h2>
        <div className="mt-5 space-y-4">
          <Field label={t('deck.term')}>
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={sample.term} />
          </Field>
          <Field label={t('deck.translation')}>
            <Input value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder={sample.translation} />
          </Field>
          <Field label={t('deck.explanation')}>
            <Textarea className="min-h-20" value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder={t('common.optional')} />
          </Field>
          <Field label={t('deck.note')}>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('common.optional')} />
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
                type: 'vocab',
                term: term.trim(),
                translation: translation.trim(),
                target: term.trim(),
                explanation: explanation.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            {t('common.save')}
          </Button>
        </div>
        {onDelete ? (
          <button type="button" onClick={onDelete} className="mt-4 w-full py-2 text-sm font-medium text-danger">
            {t('deck.deleteCard')}
          </button>
        ) : null}
    </Sheet>
  )
}
