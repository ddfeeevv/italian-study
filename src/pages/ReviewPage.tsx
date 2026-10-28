import { Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { StreakCard } from '../components/StreakCard'
import { Button, Card, EmptyState, List, Page } from '../components/ui'
import { useI18n } from '../i18n/translate'
import { dueCards, dueCount, vocabCards } from '../lib/srs'
import { cardsInSubject, decksInSubject } from '../lib/subjects'
import { useAppStore } from '../store/app-store'

export function ReviewPage() {
  const { t, plural, countInline } = useI18n()
  const navigate = useNavigate()
  const { decks, cards, dueToday, activeSubject } = useAppStore()
  const visibleDecks = decksInSubject(decks, activeSubject?.id)
  const due = dueCards(vocabCards(cardsInSubject(cards, decks, activeSubject?.id)))

  return (
    <Page>
      <header className="mb-6 pt-2">
        <h1 className="font-display text-3xl lg:text-4xl">{t('review.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{t('review.lead')}</p>
      </header>

      <StreakCard />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <Card className="px-5 py-6 lg:sticky lg:top-8">
          <p className="font-display text-5xl">{dueToday}</p>
          <p className="mt-1 text-sm text-muted">{t('review.dueLabel', { noun: plural('words', dueToday) })}</p>
          <Button className="mt-6 w-full" disabled={dueToday === 0} onClick={() => navigate('/study')}>
            <Play size={16} />
            {t('review.start')}
          </Button>
        </Card>

        {due.length === 0 ? (
          <EmptyState
            title={t('review.clearTitle')}
            text={t('review.clearText')}
          />
        ) : (
          <List>
            {visibleDecks.map((deck) => {
              const count = dueCount(due.filter((card) => card.deckId === deck.id))
              if (count === 0) return null
              return (
                <Link
                  key={deck.id}
                  to={`/study/${deck.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-surface"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: deck.color ?? '#C45C26' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{deck.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{countInline('words', count)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-accent">{t('review.study')}</span>
                </Link>
              )
            })}
          </List>
        )}
      </div>
    </Page>
  )
}
