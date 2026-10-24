import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, IconButton, List, Page } from '../components/ui'
import { useI18n } from '../i18n/translate'
import { exerciseCards } from '../lib/srs'
import { decksInSubject } from '../lib/subjects'
import { useAppStore } from '../store/app-store'
import { DeckForm } from './DecksPage'

const FALLBACK_COLOR = '#3D5A80'

export function ExercisesPage() {
  const { t, countInline } = useI18n()
  const { decks, cards, activeSubject } = useAppStore()
  const visible = decksInSubject(decks, activeSubject?.id)
  const [creating, setCreating] = useState(false)
  const sets = visible.filter((deck) => deck.kind === 'exercise')
  const leftover = visible
    .filter((deck) => deck.kind !== 'exercise')
    .map((deck) => ({
      deck,
      count: exerciseCards(cards.filter((card) => card.deckId === deck.id)).length,
    }))
    .filter((item) => item.count > 0)

  return (
    <Page>
      <header className="mb-6 flex items-end justify-between gap-3 pt-2">
        <h1 className="font-display text-3xl lg:text-4xl">{t('exercises.title')}</h1>
        <div className="lg:hidden">
          <IconButton label={t('exercises.new')} onClick={() => setCreating(true)}>
            <Plus size={22} />
          </IconButton>
        </div>
        <div className="hidden lg:block">
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            {t('exercises.new')}
          </Button>
        </div>
      </header>
      <p className="mb-6 text-sm leading-6 text-muted">
        {t('exercises.lead')}
      </p>

      {sets.length === 0 && leftover.length === 0 ? (
        <EmptyState
          title={t('decks.emptyTitle')}
          text={t('exercises.emptyText')}
          action={<Button onClick={() => setCreating(true)}>{t('exercises.new')}</Button>}
        />
      ) : (
        <List>
          {sets.map((deck) => {
            const count = exerciseCards(cards.filter((card) => card.deckId === deck.id)).length
            return (
              <Link
                key={deck.id}
                to={`/exercises/${deck.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-surface"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: deck.color ?? FALLBACK_COLOR }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{deck.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {countInline('tasks', count)}
                    {deck.description ? ` · ${deck.description}` : ''}
                  </span>
                </span>
              </Link>
            )
          })}
          {leftover.map(({ deck, count }) => (
            <Link
              key={deck.id}
              to={`/exercises/${deck.id}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-surface"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: deck.color ?? FALLBACK_COLOR }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{deck.title}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {t('exercises.fromDeck', { items: countInline('tasks', count) })}
                </span>
              </span>
            </Link>
          ))}
        </List>
      )}

      {creating ? (
        <DeckForm kind="exercise" onCancel={() => setCreating(false)} onSave={() => setCreating(false)} />
      ) : null}
    </Page>
  )
}

