import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, IconButton, Page } from '../components/ui'
import { exerciseCards } from '../lib/srs'
import { useAppStore } from '../store/app-store'
import { DeckForm } from './DecksPage'

const FALLBACK_COLOR = '#3D5A80'

export function ExercisesPage() {
  const { decks, cards } = useAppStore()
  const [creating, setCreating] = useState(false)
  const sets = decks.filter((deck) => deck.kind === 'exercise')
  const leftover = decks
    .filter((deck) => deck.kind !== 'exercise')
    .map((deck) => ({
      deck,
      count: exerciseCards(cards.filter((card) => card.deckId === deck.id)).length,
    }))
    .filter((item) => item.count > 0)

  return (
    <Page>
      <header className="mb-6 flex items-end justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Грамматика</p>
          <h1 className="mt-1 font-display text-3xl lg:text-4xl">Упражнения</h1>
        </div>
        <div className="lg:hidden">
          <IconButton label="Новое упражнение" onClick={() => setCreating(true)}>
            <Plus size={22} />
          </IconButton>
        </div>
        <div className="hidden lg:block">
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            Новое упражнение
          </Button>
        </div>
      </header>
      <p className="mb-6 text-sm leading-6 text-muted">
        Пропуски и формы. Делаются один раз и не возвращаются по расписанию — открыть снова можно когда захотите.
      </p>

      {sets.length === 0 && leftover.length === 0 ? (
        <EmptyState
          title="Пока пусто"
          text="Создайте упражнение и добавьте в него пропуски или формы."
          action={<Button onClick={() => setCreating(true)}>Новое упражнение</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sets.map((deck) => {
            const count = exerciseCards(cards.filter((card) => card.deckId === deck.id)).length
            return (
              <Link key={deck.id} to={`/exercises/${deck.id}`} className="block h-full">
                <Card className="flex h-full items-center gap-4 px-4 py-4 transition hover:border-accent active:scale-[0.99]">
                  <span
                    className="size-12 shrink-0 rounded-2xl"
                    style={{ background: deck.color ?? FALLBACK_COLOR }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{deck.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {count} {countLabel(count)}
                      {deck.description ? ` · ${deck.description}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </Card>
              </Link>
            )
          })}
          {leftover.map(({ deck, count }) => (
            <Link key={deck.id} to={`/exercises/${deck.id}`} className="block h-full">
              <Card className="flex h-full items-center gap-4 px-4 py-4 transition hover:border-accent">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{deck.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {count} {countLabel(count)} из колоды
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      {creating ? (
        <DeckForm kind="exercise" onCancel={() => setCreating(false)} onSave={() => setCreating(false)} />
      ) : null}
    </Page>
  )
}

function countLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'задание'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задания'
  return 'заданий'
}
