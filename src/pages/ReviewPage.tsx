import { Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Page } from '../components/ui'
import { dueCards, dueCount } from '../lib/srs'
import { useAppStore } from '../store/app-store'

export function ReviewPage() {
  const navigate = useNavigate()
  const { decks, cards, dueToday } = useAppStore()
  const due = dueCards(cards)

  return (
    <Page>
      <header className="mb-6 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Повторение</p>
        <h1 className="mt-1 font-display text-3xl">Сегодня</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Слова и грамматика с подошедшим интервалом. Каждая карточка — выбор, затем ввод.
        </p>
      </header>

      <Card className="mb-6 px-5 py-6">
        <p className="font-display text-5xl">{dueToday}</p>
        <p className="mt-1 text-sm text-muted">карточек к повторению</p>
        <Button className="mt-6 w-full" disabled={dueToday === 0} onClick={() => navigate('/study')}>
          <Play size={16} />
          Начать сессию
        </Button>
      </Card>

      {due.length === 0 ? (
        <EmptyState
          title="На сегодня чисто"
          text="Новые слова появятся сразу после добавления. Остальные вернутся по расписанию интервалов."
        />
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => {
            const count = dueCount(cards.filter((card) => card.deckId === deck.id))
            if (count === 0) return null
            return (
              <Link key={deck.id} to={`/study/${deck.id}`}>
                <Card className="flex items-center justify-between px-4 py-4">
                  <div>
                    <p className="font-semibold">{deck.title}</p>
                    <p className="text-sm text-muted">{count} карточек</p>
                  </div>
                  <span className="text-sm font-semibold text-accent">Учить</span>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </Page>
  )
}
