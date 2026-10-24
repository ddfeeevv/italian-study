import type { Card, CardType } from '../types/models'
import { createCard } from './srs'

export function sanitizeUserInput(input: string): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

export type ParsedCard = {
  type: CardType
  term: string
  translation?: string
  sentence?: string
  target?: string
  options?: string[]
  explanation?: string
  notes?: string
}

export function parseBulkText(raw: string): ParsedCard[] {
  return parseWordText(raw).items
}

export function parseWordText(raw: string): { items: ParsedCard[]; skipped: number } {
  return parseFiltered(raw, (card) => card.type === 'vocab')
}

export function parseExerciseText(raw: string): { items: ParsedCard[]; skipped: number } {
  return parseFiltered(raw, (card) => card.type !== 'vocab')
}

function parseFiltered(
  raw: string,
  keep: (card: ParsedCard) => boolean,
): { items: ParsedCard[]; skipped: number } {
  const items: ParsedCard[] = []
  let skipped = 0
  for (const line of raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    if (/^(term|слово|тип|#)/i.test(line) && /translation|перевод|target/i.test(line)) continue
    const parsed = parseLine(line)
    if (!parsed || !keep(parsed)) {
      skipped += 1
      continue
    }
    items.push(parsed)
  }
  return { items, skipped }
}

export function parseLine(line: string): ParsedCard | null {
  const typed = line.match(/^(vocab|cloze|transform)\s*[:|]\s*(.+)$/i)
  if (typed) {
    return parseTyped(typed[1].toLowerCase() as CardType, typed[2])
  }

  if (/\{blank\}/i.test(line)) {
    return parseCloze(line)
  }

  const piped = line.split('|').map((part) => part.trim())
  if (piped.length >= 2 && piped[0] && piped[1]) {
    // Grammar / transform style: Prompt | Target [| Options] [| Explanation]
    // Detect transform-ish prompts (gender/number cues) or any 3–4 column pipe row
    // that is not vocab dash-syntax.
    if (
      piped.length >= 3 ||
      /\((plurale|femminile|singolare|maschile|мн\.?\s*ч|ед\.?\s*ч|ж\.?\s*р|м\.?\s*р)[^)]*\)/i.test(
        piped[0],
      )
    ) {
      return parsePromptTargetRow(piped, 'transform')
    }
  }

  return parseVocab(line)
}

export function linesToCards(deckId: string, userId: string, lines: ParsedCard[]): Card[] {
  return lines.map((line) =>
    createCard({
      deckId,
      userId,
      type: line.type,
      term: sanitizeUserInput(line.term),
      translation: line.translation ? sanitizeUserInput(line.translation) : undefined,
      sentence: line.sentence ? sanitizeUserInput(line.sentence) : undefined,
      target: line.target ? sanitizeUserInput(line.target) : undefined,
      options: line.options?.map(sanitizeUserInput),
      explanation: line.explanation ? sanitizeUserInput(line.explanation) : undefined,
      notes: line.notes ? sanitizeUserInput(line.notes) : undefined,
    }),
  )
}

function parseTyped(type: CardType, rest: string): ParsedCard | null {
  if (type === 'cloze') return parseCloze(rest)
  if (type === 'transform') {
    const parts = rest.split('|').map((part) => part.trim())
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return parsePromptTargetRow(parts, 'transform')
  }
  return parseVocab(rest)
}

/**
 * Shared pipe columns:
 * 2: Prompt | Target
 * 3: Prompt | Target | Explanation
 * 4: Prompt | Target | Options (comma-separated) | Explanation
 */
function parsePromptTargetRow(
  parts: string[],
  type: 'transform' | 'cloze',
): ParsedCard {
  const prompt = parts[0]
  const target = parts[1]
  let options: string[] | undefined
  let explanation: string | undefined

  if (parts.length >= 4) {
    options = splitOptions(parts[2])
    explanation = parts[3] || undefined
  } else if (parts.length === 3) {
    explanation = parts[2] || undefined
  }

  if (type === 'cloze') {
    const hintMatch = prompt.match(/\(([^)]+)\)\s*$/)
    const sentence = prompt.replace(/\s*\(([^)]+)\)\s*$/, '').trim()
    return {
      type: 'cloze',
      term: hintMatch?.[1] ?? '',
      sentence,
      target,
      options,
      explanation,
    }
  }

  return {
    type: 'transform',
    term: prompt,
    target,
    options,
    explanation,
  }
}

function parseCloze(line: string): ParsedCard | null {
  const parts = line.split('|').map((part) => part.trim())
  if (!parts[0] || !/\{blank\}/i.test(parts[0])) return null
  if (!parts[1]) return null
  return parsePromptTargetRow(parts, 'cloze')
}

function parseVocab(line: string): ParsedCard | null {
  // Also allow vocab via pipes: term | translation [| notes]
  const piped = line.split('|').map((part) => part.trim())
  if (piped.length === 2 && piped[0] && piped[1] && !/\{blank\}/i.test(piped[0])) {
    // Ambiguous with transform 2-col — treat as vocab only when no morphology cue
    if (!/\([^)]+\)/.test(piped[0])) {
      return {
        type: 'vocab',
        term: piped[0],
        translation: piped[1],
        target: piped[0],
      }
    }
  }

  const dashed = line.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (dashed) {
    const noteMatch = dashed[2].match(/^(.*?)\s*\((.+)\)\s*$/)
    return {
      type: 'vocab',
      term: dashed[1].trim(),
      translation: noteMatch ? noteMatch[1].trim() : dashed[2].trim(),
      notes: noteMatch?.[2].trim(),
      target: dashed[1].trim(),
    }
  }

  const comma = line.match(/^([^,;]+)\s*[,;]\s*([^,;]+)(?:\s*[,;]\s*(.+))?$/)
  if (comma) {
    return {
      type: 'vocab',
      term: comma[1].trim(),
      translation: comma[2].trim(),
      notes: comma[3]?.trim(),
      target: comma[1].trim(),
    }
  }

  const tab = line.split('\t').map((part) => part.trim())
  if (tab.length >= 2 && tab[0] && tab[1]) {
    return {
      type: 'vocab',
      term: tab[0],
      translation: tab[1],
      notes: tab[2],
      target: tab[0],
    }
  }

  return null
}

function splitOptions(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}
