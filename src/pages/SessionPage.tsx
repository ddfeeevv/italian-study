import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SessionView } from '../components/session/SessionView'
import { dueCards, exerciseCards, vocabCards } from '../lib/srs'
import { useAppStore } from '../store/app-store'

export function SessionPage({ kind }: { kind: 'vocab' | 'exercise' }) {
  const { deckId } = useParams()
  const practice = kind === 'exercise'
  const { decks, cards } = useAppStore()

  const deck = decks.find((item) => item.id === deckId)
  const ofKind = kind === 'vocab' ? vocabCards(cards) : exerciseCards(cards)
  const scoped = deckId ? ofKind.filter((card) => card.deckId === deckId) : ofKind
  const sessionCards = useMemo(
    () => (kind === 'exercise' || practice ? scoped : dueCards(scoped)),
    [kind, practice, scoped],
  )

  const title = deck ? deck.title : kind === 'exercise' ? 'Упражнения' : 'Сегодня'
  return <SessionView cards={sessionCards} title={title} practice={practice} kind={kind} />
}
