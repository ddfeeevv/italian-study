import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Field, IconButton, Input, List, Page, Sheet, Textarea } from '../components/ui'
import { useI18n } from '../i18n/translate'
import { dueCount, vocabCards } from '../lib/srs'
import { decksInSubject } from '../lib/subjects'
import { useAppStore } from '../store/app-store'
import type { Deck } from '../types/models'

const COLORS = ['#C45C26', '#3F6F5B', '#3D5A80', '#8B4D6B', '#B0892B']

export function DecksPage() {
  const { t, countInline } = useI18n()
  const { decks, cards, activeSubject, ready } = useAppStore()
  const wordDecks = decksInSubject(decks, activeSubject?.id).filter((deck) => deck.kind !== 'exercise')
  const [creating, setCreating] = useState(false)

  if (!ready) {
    return (
      <Page>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted">{t('decks.loading')}</p>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <header className="mb-6 flex items-end justify-between gap-3 pt-2">
        <h1 className="font-display text-3xl lg:text-4xl">{t('nav.decks')}</h1>
        <div className="lg:hidden">
          <IconButton label={t('decks.new')} onClick={() => setCreating(true)}>
            <Plus size={22} />
          </IconButton>
        </div>
        <div className="hidden lg:block">
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            {t('decks.new')}
          </Button>
        </div>
      </header>

      {wordDecks.length === 0 ? (
        <EmptyState
          title={t('decks.emptyTitle')}
          text={t('decks.emptyText')}
          action={<Button onClick={() => setCreating(true)}>{t('decks.create')}</Button>}
        />
      ) : (
        <List>
          {wordDecks.map((deck) => {
            const words = vocabCards(cards.filter((card) => card.deckId === deck.id))
            const due = dueCount(words)
            return (
              <Link
                key={deck.id}
                to={`/decks/${deck.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-surface"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: deck.color ?? COLORS[0] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{deck.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {due > 0
                      ? t('decks.metaDue', { items: countInline('words', words.length), due })
                      : t('decks.metaClear', { items: countInline('words', words.length) })}
                  </span>
                </span>
                {due > 0 ? (
                  <span className="min-w-6 rounded-full bg-accent px-2 py-0.5 text-center text-xs font-bold text-accent-fg">
                    {due}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </List>
      )}

      {creating ? (
        <DeckForm
          onCancel={() => setCreating(false)}
          onSave={() => setCreating(false)}
        />
      ) : null}
    </Page>
  )
}

export function DeckForm({
  initial,
  kind = 'words',
  onSave,
  onCancel,
}: {
  initial?: Deck
  kind?: 'words' | 'exercise'
  onSave: (input: { title: string; description: string; color?: string }, existing?: Deck) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { addDeck } = useAppStore()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])

  return (
    <Sheet>
        <h2 className="font-display text-2xl">
          {kind === 'exercise'
            ? initial
              ? t('decks.formExercise')
              : t('decks.formNewExercise')
            : initial
              ? t('decks.formDeck')
              : t('decks.formNewDeck')}
        </h2>
        <div className="mt-5 space-y-4">
          <Field label={t('decks.name')}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === 'exercise' ? t('decks.phExercise') : t('decks.phDeck')}
            />
          </Field>
          <Field label={t('decks.description')}>
            <Textarea
              className="min-h-24"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={kind === 'exercise' ? t('decks.descExercise') : t('decks.descDeck')}
            />
          </Field>
          <div className="flex gap-2">
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className="size-9 rounded-full border-2"
                style={{
                  background: swatch,
                  borderColor: color === swatch ? 'var(--fg)' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              const input = { title: title.trim(), description: description.trim(), color }
              if (initial) {
                onSave(input, initial)
                return
              }
              const created = addDeck({ ...input, kind })
              onSave(input)
              if (created) navigate(kind === 'exercise' ? `/exercises/${created.id}` : `/decks/${created.id}`)
            }}
          >
            {t('common.save')}
          </Button>
        </div>
    </Sheet>
  )
}
