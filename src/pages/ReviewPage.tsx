import { Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Page } from '../components/ui'
import { dueCards, dueCount, vocabCards } from '../lib/srs'
import { useAppStore } from '../store/app-store'

export function ReviewPage() {
  const navigate = useNavigate()
  const { decks, cards, dueToday } = useAppStore()
  const due = dueCards(vocabCards(cards))

  return (
    <Page>
      <header className="mb-6 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Повторение</p>
        <h1 className="mt-1 font-display text-3xl lg:text-4xl">Сегодня</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Слова с подошедшим интервалом. Новые сначала показываем, уже выученные сразу спрашиваем: выбор, затем ввод.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <Card className="px-5 py-6 lg:sticky lg:top-8">
          <p className="font-display text-5xl">{dueToday}</p>
          <p className="mt-1 text-sm text-muted">слов к повторению</p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            {decks.map((deck) => {
              const count = dueCount(due.filter((card) => card.deckId === deck.id))
              if (count === 0) return null
              return (
                <Link key={deck.id} to={`/study/${deck.id}`} className="block h-full">
                  <Card className="flex h-full items-center justify-between gap-3 px-4 py-4 transition hover:border-accent">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{deck.title}</p>
                      <p className="text-sm text-muted">{count} слов</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-accent">Учить</span>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Page>
  )
}
