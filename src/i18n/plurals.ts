import { forms } from './line'
import type { Locale } from './locales'

export const PLURALS = {
  words: forms(
    ['слово', 'слова', 'слов'],
    ['word', 'words', 'words'],
    ['palabra', 'palabras', 'palabras'],
    ['Wort', 'Wörter', 'Wörter'],
    ['mot', 'mots', 'mots'],
    ['palavra', 'palavras', 'palavras'],
    ['parola', 'parole', 'parole'],
    ['个词', '个词', '个词'],
    ['語', '語', '語'],
    ['개 단어', '개 단어', '개 단어'],
    ['kelime', 'kelime', 'kelime'],
    ['słowo', 'słowa', 'słów'],
    ['слово', 'слова', 'слів'],
  ),
  cards: forms(
    ['карточка', 'карточки', 'карточек'],
    ['card', 'cards', 'cards'],
    ['tarjeta', 'tarjetas', 'tarjetas'],
    ['Karte', 'Karten', 'Karten'],
    ['carte', 'cartes', 'cartes'],
    ['cartão', 'cartões', 'cartões'],
    ['scheda', 'schede', 'schede'],
    ['张卡片', '张卡片', '张卡片'],
    ['枚', '枚', '枚'],
    ['장', '장', '장'],
    ['kart', 'kart', 'kart'],
    ['fiszka', 'fiszki', 'fiszek'],
    ['картка', 'картки', 'карток'],
  ),
  tasks: forms(
    ['задание', 'задания', 'заданий'],
    ['task', 'tasks', 'tasks'],
    ['tarea', 'tareas', 'tareas'],
    ['Aufgabe', 'Aufgaben', 'Aufgaben'],
    ['exercice', 'exercices', 'exercices'],
    ['tarefa', 'tarefas', 'tarefas'],
    ['esercizio', 'esercizi', 'esercizi'],
    ['道题', '道题', '道题'],
    ['問', '問', '問'],
    ['개 문제', '개 문제', '개 문제'],
    ['görev', 'görev', 'görev'],
    ['zadanie', 'zadania', 'zadań'],
    ['завдання', 'завдання', 'завдань'],
  ),
  days: forms(
    ['день', 'дня', 'дней'],
    ['day', 'days', 'days'],
    ['día', 'días', 'días'],
    ['Tag', 'Tage', 'Tage'],
    ['jour', 'jours', 'jours'],
    ['dia', 'dias', 'dias'],
    ['giorno', 'giorni', 'giorni'],
    ['天', '天', '天'],
    ['日', '日', '日'],
    ['일', '일', '일'],
    ['gün', 'gün', 'gün'],
    ['dzień', 'dni', 'dni'],
    ['день', 'дні', 'днів'],
  ),
  requests: forms(
    ['генерация', 'генерации', 'генераций'],
    ['generation', 'generations', 'generations'],
    ['generación', 'generaciones', 'generaciones'],
    ['Generierung', 'Generierungen', 'Generierungen'],
    ['génération', 'générations', 'générations'],
    ['geração', 'gerações', 'gerações'],
    ['generazione', 'generazioni', 'generazioni'],
    ['次', '次', '次'],
    ['回', '回', '回'],
    ['회', '회', '회'],
    ['üretim', 'üretim', 'üretim'],
    ['generacja', 'generacje', 'generacji'],
    ['генерація', 'генерації', 'генерацій'],
  ),
  questions: forms(
    ['вопрос', 'вопроса', 'вопросов'],
    ['question', 'questions', 'questions'],
    ['pregunta', 'preguntas', 'preguntas'],
    ['Frage', 'Fragen', 'Fragen'],
    ['question', 'questions', 'questions'],
    ['pergunta', 'perguntas', 'perguntas'],
    ['domanda', 'domande', 'domande'],
    ['道题', '道题', '道题'],
    ['問', '問', '問'],
    ['개 문제', '개 문제', '개 문제'],
    ['soru', 'soru', 'soru'],
    ['pytanie', 'pytania', 'pytań'],
    ['питання', 'питання', 'питань'],
  ),
}

export type PluralKey = keyof typeof PLURALS

export function pickPlural(locale: Locale, count: number, trio: readonly [string, string, string]): string {
  const n = Math.abs(Math.trunc(count))
  if (locale === 'ru' || locale === 'uk' || locale === 'pl') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return trio[0]
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return trio[1]
    return trio[2]
  }
  if (locale === 'zh' || locale === 'ja' || locale === 'ko' || locale === 'tr') return trio[0]
  return n === 1 ? trio[0] : trio[2]
}
