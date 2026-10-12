import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { SessionView } from '../components/session/SessionView'
import { dueCards } from '../lib/srs'
import { useAppStore } from '../store/app-store'

export function SessionPage() {
  const { deckId } = useParams()
  const [params] = useSearchParams()
  const practice = params.get('mode') === 'all'
  const { decks, cards } = useAppStore()

  const deck = decks.find((item) => item.id === deckId)
  const scoped = deckId ? cards.filter((card) => card.deckId === deckId) : cards
  const sessionCards = useMemo(
    () => (practice ? scoped : dueCards(scoped)),
    [practice, scoped],
  )

  const title = deck ? deck.title : 'Сегодня'
  return <SessionView cards={sessionCards} title={title} practice={practice} />
}
