import { MAX_WORDS_PER_REQUEST } from './generation-quota'

export type TutorDraft = {
  topic?: string
  count?: number
}

export type TutorTurn =
  | { type: 'ask'; ask: 'topic' | 'count' | 'tooMany' | 'example'; draft: TutorDraft }
  | { type: 'ready'; topic: string; count: number; draft: TutorDraft }

const PHRASES = ['words about', 'word about', 'на тему', 'по теме', 'про тему', 'por favor'].sort(
  (a, b) => b.length - a.length,
)

const FILLER = new Set([
  'создай', 'сделай', 'собери', 'сгенерируй', 'добавь', 'хочу', 'давай', 'можно', 'можешь', 'пожалуйста', 'мне',
  'ещё', 'еще', 'колоду', 'колода', 'колоды', 'набор', 'карточек', 'карточки', 'карточка', 'карточку', 'слов',
  'слова', 'слово', 'про', 'на', 'тему', 'тема', 'теме', 'темы', 'штук', 'штуки', 'штука',
  'задание', 'задания', 'заданий', 'упражнение', 'упражнения', 'упражнений', 'вправу', 'вправи', 'вправ',
  'створи', 'зроби', 'слів', 'будь', 'ласка',
  'create', 'generate', 'make', 'add', 'please', 'deck', 'decks', 'card', 'cards', 'word', 'words', 'about',
  'topic', 'the', 'a', 'an', 'me', 'some', 'task', 'tasks', 'exercise', 'exercises',
  'crea', 'crear', 'genera', 'generar', 'palabras', 'palabra', 'sobre', 'mazo', 'tarjetas', 'tarjeta',
  'ejercicio', 'ejercicios', 'tarea', 'tareas',
  'erstelle', 'mach', 'bitte', 'wörter', 'worte', 'wort', 'über', 'thema', 'karten', 'karte', 'stapel',
  'übung', 'übungen', 'aufgabe', 'aufgaben',
  'crée', 'creer', 'créer', 'mots', 'mot', 'sur', 'paquet', 'cartes', 'carte', 'un', 'une',
  'exercice', 'exercices',
  'palavras', 'cartões', 'cartão', 'baralho', 'exercício', 'exercícios', 'tarefa', 'tarefas',
  'creare', 'parole', 'parola', 'mazzo', 'carte', 'carta', 'esercizio', 'esercizi',
  'utwórz', 'słowa', 'słów', 'słowo', 'temat', 'talia', 'fiszek', 'fiszki', 'ćwiczenie', 'ćwiczenia', 'zadanie', 'zadania', 'zadań',
  'oluştur', 'kelime', 'kelimeler', 'hakkında', 'deste', 'kart', 'alıştırma', 'alıştırmalar',
])

const COUNT_SUFFIX = new Set([
  'слов', 'слова', 'слово', 'слів', 'words', 'word', 'mots', 'mot', 'wörter', 'wort', 'worte', 'palabras',
  'palabra', 'palavras', 'palavra', 'parole', 'parola', 'kelime', 'słowa', 'słów', 'słowo', '个', '個', '词', '語',
  '회', '개',
  'задание', 'задания', 'заданий', 'упражнение', 'упражнения', 'упражнений', 'вправу', 'вправи', 'вправ',
  'task', 'tasks', 'exercise', 'exercises', 'ejercicio', 'ejercicios', 'tarea', 'tareas',
  'übung', 'übungen', 'aufgabe', 'aufgaben', 'exercice', 'exercices', 'exercício', 'exercícios',
  'esercizio', 'esercizi', 'ćwiczenie', 'ćwiczenia', 'zadanie', 'zadania', 'zadań', 'alıştırma', 'alıştırmalar',
])

export function nextTurn(draft: TutorDraft, text: string, maxCount = MAX_WORDS_PER_REQUEST): TutorTurn {
  const cap = Math.min(Math.max(1, Math.floor(maxCount) || 1), MAX_WORDS_PER_REQUEST)
  const parsed = parseUtterance(text)
  const topic = parsed.topic ?? draft.topic
  if (parsed.count !== undefined && parsed.count > cap) {
    return { type: 'ask', ask: 'tooMany', draft: topic ? { topic } : {} }
  }
  const count = parsed.count ?? draft.count
  if (topic && count) return { type: 'ready', topic, count, draft: {} }
  if (topic) return { type: 'ask', ask: 'count', draft: { topic } }
  if (count) return { type: 'ask', ask: 'topic', draft: { count } }
  return { type: 'ask', ask: 'example', draft }
}

export function parseUtterance(text: string): { topic?: string; count?: number } {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return {}
  const found = findCount(trimmed)
  const without = found ? `${trimmed.slice(0, found.start)} ${trimmed.slice(found.end)}` : trimmed
  return { topic: cleanTopic(without), count: found?.count }
}

function findCount(text: string): { count: number; start: number; end: number } | null {
  for (const match of text.matchAll(/(?:^|\s)(\d{1,3})([^\s.,!?]*)/g)) {
    const suffix = match[2] ?? ''
    if (suffix && !COUNT_SUFFIX.has(suffix.toLocaleLowerCase())) continue
    const start = match.index ?? 0
    const end = start + match[0].length
    if (/\d/.test(text[end] ?? '')) continue
    const count = Number(match[1])
    if (!Number.isInteger(count) || count < 1) continue
    return { count, start, end }
  }
  return null
}

function cleanTopic(value: string): string | undefined {
  const stripped = stripPhrases(value).replace(/\s+/g, ' ').trim()
  const kept = stripped
    .split(' ')
    .filter((token) => {
      const key = normToken(token)
      if (!key || FILLER.has(key) || /^\d+$/.test(key)) return false
      return true
    })
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
  const topic = kept.join(' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim()
  return isTopic(topic) ? topic : undefined
}

function stripPhrases(value: string): string {
  let next = value
  for (const phrase of PHRASES) {
    const pattern = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    next = next.replace(new RegExp(pattern, 'giu'), ' ')
  }
  return next
}

function normToken(token: string): string {
  return token.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function isTopic(value: string): boolean {
  if (!value || /^\d+$/.test(value)) return false
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(value)) return true
  return [...value].length >= 2
}
