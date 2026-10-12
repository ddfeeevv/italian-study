import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Field, IconButton, Input, Page, Textarea } from '../components/ui'
import { dueCount } from '../lib/srs'
import { useAppStore } from '../store/app-store'
import type { Deck } from '../types/models'

const COLORS = ['#C45C26', '#3F6F5B', '#3D5A80', '#8B4D6B', '#B0892B']

export function DecksPage() {
  const { decks, cards } = useAppStore()
  const [creating, setCreating] = useState(false)

  return (
    <Page>
      <header className="mb-6 flex items-end justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
          <h1 className="mt-1 font-display text-3xl">Колоды</h1>
        </div>
        <IconButton label="Новая колода" onClick={() => setCreating(true)}>
          <Plus size={22} />
        </IconButton>
      </header>

      {decks.length === 0 ? (
        <EmptyState
          title="Пока пусто"
          text="Создайте первую колоду и добавьте слова в формате слово — перевод."
          action={<Button onClick={() => setCreating(true)}>Создать колоду</Button>}
        />
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => {
            const deckCards = cards.filter((card) => card.deckId === deck.id)
            const due = dueCount(deckCards)
            return (
              <Link key={deck.id} to={`/decks/${deck.id}`} className="block">
                <Card className="flex items-center gap-4 px-4 py-4 transition active:scale-[0.99]">
                  <span
                    className="size-12 shrink-0 rounded-2xl"
                    style={{ background: deck.color ?? COLORS[0] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{deck.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {deckCards.length} карточек · {due > 0 ? `${due} к повторению` : 'на сегодня чисто'}
                    </span>
                  </span>
                  {due > 0 ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">
                      {due}
                    </span>
                  ) : null}
                  <ChevronRight size={18} className="text-muted" />
                </Card>
              </Link>
            )
          })}
        </div>
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
  onSave,
  onCancel,
}: {
  initial?: Deck
  onSave: (input: { title: string; description: string; color?: string }, existing?: Deck) => void
  onCancel: () => void
}) {
  const navigate = useNavigate()
  const { addDeck } = useAppStore()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-0 sm:items-center">
      <Card className="w-full max-w-md rounded-b-none px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-3xl sm:pb-5">
        <h2 className="font-display text-2xl">{initial ? 'Колода' : 'Новая колода'}</h2>
        <div className="mt-5 space-y-4">
          <Field label="Название">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A1 — Глаголы" />
          </Field>
          <Field label="Описание">
            <Textarea
              className="min-h-24"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Коротко, зачем эта колода"
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
            Отмена
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              const input = { title: title.trim(), description: description.trim(), color }
              if (initial) {
                onSave(input, initial)
                return
              }
              const created = addDeck(input)
              onSave(input)
              if (created) navigate(`/decks/${created.id}`)
            }}
          >
            Сохранить
          </Button>
        </div>
      </Card>
    </div>
  )
}
