import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SessionView } from '../components/session/SessionView'
import { useI18n } from '../i18n/translate'
import { dueCards, exerciseCards, vocabCards } from '../lib/srs'
import { cardsInSubject } from '../lib/subjects'
import { useAppStore } from '../store/app-store'

export function SessionPage({ kind }: { kind: 'vocab' | 'exercise' }) {
  const { deckId } = useParams()
  const { t } = useI18n()
  const practice = kind === 'exercise'
  const { decks, cards, activeSubject } = useAppStore()

  const deck = decks.find((item) => item.id === deckId)
  const scopedCards = deckId
    ? cards.filter((card) => card.deckId === deckId)
    : cardsInSubject(cards, decks, activeSubject?.id)
  const ofKind = kind === 'vocab' ? vocabCards(scopedCards) : exerciseCards(scopedCards)
  const sessionCards = useMemo(
    () => (kind === 'exercise' || practice ? ofKind : dueCards(ofKind)),
    [kind, practice, ofKind],
  )

  const title = deck ? deck.title : kind === 'exercise' ? t('session.exercises') : t('session.today')
  return <SessionView cards={sessionCards} title={title} practice={practice} kind={kind} />
}
