import type { Card, Deck } from '../types/models'
import { createCard } from './srs'
import { nowIso, uid } from './utils'

const COLORS = {
  verbs: '#C45C26',
  everyday: '#3F6F5B',
  grammar: '#3D5A80',
}

const VERBS: Array<[string, string, string?]> = [
  ['essere', 'быть', 'неправильный'],
  ['avere', 'иметь', 'неправильный'],
  ['fare', 'делать', 'неправильный'],
  ['andare', 'идти / ехать', 'неправильный'],
  ['lavorare', 'работать', '1 спряжение'],
  ['parlare', 'говорить', '1 спряжение'],
  ['studiare', 'учиться', '1 спряжение'],
  ['mangiare', 'есть', '1 спряжение'],
  ['vivere', 'жить', '2 спряжение'],
  ['vedere', 'видеть', '2 спряжение'],
  ['bere', 'пить', 'неправильный'],
  ['dormire', 'спать', '3 спряжение'],
  ['venire', 'приходить', 'неправильный'],
  ['volere', 'хотеть', 'модальный'],
  ['potere', 'мочь', 'модальный'],
  ['dovere', 'долженствовать', 'модальный'],
]

const EVERYDAY: Array<[string, string, string?]> = [
  ['ciao', 'привет / пока'],
  ['buongiorno', 'добрый день'],
  ['buonasera', 'добрый вечер'],
  ['grazie', 'спасибо'],
  ['prego', 'пожалуйста / не за что'],
  ['scusa', 'извини'],
  ['per favore', 'пожалуйста (просьба)'],
  ['sì', 'да'],
  ['no', 'нет'],
  ['come stai?', 'как дела?'],
  ['mi chiamo', 'меня зовут'],
  ['piacere', 'приятно познакомиться'],
]

type ClozeSeed = {
  sentence: string
  target: string
  hint: string
  options: string[]
  explanation: string
}

const CLOZES: ClozeSeed[] = [
  {
    sentence: 'Noi {blank} la metro.',
    target: 'prendiamo',
    hint: 'prendere',
    options: ['prendo', 'prendiamo', 'prendete', 'prendono'],
    explanation: '1 лицо мн. ч. prendere → prendiamo.',
  },
  {
    sentence: 'Io {blank} italiano ogni giorno.',
    target: 'studio',
    hint: 'studiare',
    options: ['studio', 'studi', 'studia', 'studiamo'],
    explanation: '1 лицо ед. ч. глаголов на -are: -o.',
  },
  {
    sentence: 'Voi {blank} a Roma domani.',
    target: 'andate',
    hint: 'andare',
    options: ['vado', 'andiamo', 'andate', 'vanno'],
    explanation: '2 лицо мн. ч. andare → andate.',
  },
  {
    sentence: "L'{blank} studente è bravo.",
    target: 'lo',
    hint: 'артикли',
    options: ['il', 'lo', 'la', 'gli'],
    explanation: 'Перед S + согласная мужского рода используется LO.',
  },
  {
    sentence: 'Lei {blank} un caffè.',
    target: 'beve',
    hint: 'bere',
    options: ['bevo', 'bevi', 'beve', 'beviamo'],
    explanation: '3 лицо ед. ч. bere → beve.',
  },
  {
    sentence: 'Gli {blank} sono sul tavolo.',
    target: 'amici',
    hint: 'amico',
    options: ['amico', 'amici', 'amica', 'amiche'],
    explanation: 'Мужской род, мн. ч.: amico → amici.',
  },
]

type TransformSeed = {
  prompt: string
  target: string
  options: string[]
  explanation: string
}

const TRANSFORMS: TransformSeed[] = [
  {
    prompt: 'la casa nuova (plurale)',
    target: 'le case nuove',
    options: ['le case nuove', 'i casi nuovi', 'la case nuova', 'le casa nuove'],
    explanation: 'Женский род: la → le, casa → case, nuova → nuove.',
  },
  {
    prompt: 'il ragazzo alto (plurale)',
    target: 'i ragazzi alti',
    options: ['i ragazzi alti', 'gli ragazzo alti', 'le ragazze alte', 'i ragazzo alto'],
    explanation: 'Мужской род: il → i, -o → -i.',
  },
  {
    prompt: 'un amico (femminile)',
    target: "un'amica",
    options: ["un'amica", 'una amica', 'un amica', 'una amico'],
    explanation: 'Перед гласной женского рода: un’amica.',
  },
  {
    prompt: 'questo libro (plurale)',
    target: 'questi libri',
    options: ['questi libri', 'queste libri', 'questo libri', 'quei libro'],
    explanation: 'Questo → questi перед мужским мн. ч.',
  },
]

function deck(userId: string, title: string, description: string, color: string): Deck {
  return {
    id: uid(),
    userId,
    title,
    description,
    color,
    createdAt: nowIso(),
  }
}

export function buildSeed(userId: string): { decks: Deck[]; cards: Card[] } {
  const verbs = deck(userId, 'A1 — Глаголы', 'Базовые итальянские глаголы', COLORS.verbs)
  const everyday = deck(userId, 'A1 — На каждый день', 'Приветствия и вежливые формулы', COLORS.everyday)
  const grammar = deck(userId, 'A1 — Грамматика', 'Пропуски, артикли и согласование', COLORS.grammar)

  const cards = [
    ...VERBS.map(([term, translation, notes]) =>
      createCard({ deckId: verbs.id, userId, type: 'vocab', term, translation, notes, target: term }),
    ),
    ...EVERYDAY.map(([term, translation, notes]) =>
      createCard({ deckId: everyday.id, userId, type: 'vocab', term, translation, notes, target: term }),
    ),
    ...CLOZES.map((item) =>
      createCard({
        deckId: grammar.id,
        userId,
        type: 'cloze',
        term: item.hint,
        sentence: item.sentence,
        target: item.target,
        options: item.options,
        explanation: item.explanation,
      }),
    ),
    ...TRANSFORMS.map((item) =>
      createCard({
        deckId: grammar.id,
        userId,
        type: 'transform',
        term: item.prompt,
        target: item.target,
        options: item.options,
        explanation: item.explanation,
      }),
    ),
  ]

  return { decks: [verbs, everyday, grammar], cards }
}
