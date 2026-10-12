import type { Card, CardType } from '../types/models'
import { createCard } from './srs'

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
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (/^(term|слово|тип|#)/i.test(line) && /translation|перевод|target/i.test(line)) {
        return []
      }
      const parsed = parseLine(line)
      return parsed ? [parsed] : []
    })
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
  if (piped.length >= 2 && /\((plurale|femminile|singolare|maschile)\)/i.test(piped[0])) {
    return {
      type: 'transform',
      term: piped[0],
      target: piped[1],
      explanation: piped[2],
      options: piped[3] ? splitOptions(piped[3]) : undefined,
    }
  }

  if (piped.length >= 3 && piped[0] && piped[1]) {
    return {
      type: 'transform',
      term: piped[0],
      target: piped[1],
      explanation: piped[2],
      options: piped[3] ? splitOptions(piped[3]) : undefined,
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
      term: line.term,
      translation: line.translation,
      sentence: line.sentence,
      target: line.target,
      options: line.options,
      explanation: line.explanation,
      notes: line.notes,
    }),
  )
}

function parseTyped(type: CardType, rest: string): ParsedCard | null {
  if (type === 'cloze') return parseCloze(rest)
  if (type === 'transform') {
    const parts = rest.split('|').map((part) => part.trim())
    if (parts.length < 2) return null
    return {
      type: 'transform',
      term: parts[0],
      target: parts[1],
      explanation: parts[2],
      options: parts[3] ? splitOptions(parts[3]) : undefined,
    }
  }
  return parseVocab(rest)
}

function parseCloze(line: string): ParsedCard | null {
  const parts = line.split('|').map((part) => part.trim())
  const sentenceRaw = parts[0]
  if (!sentenceRaw || !/\{blank\}/i.test(sentenceRaw)) return null
  const hintMatch = sentenceRaw.match(/\(([^)]+)\)\s*$/)
  const sentence = sentenceRaw.replace(/\s*\(([^)]+)\)\s*$/, '').trim()
  const target = parts[1] ?? ''
  let explanation = parts[2] || undefined
  let options: string[] | undefined
  if (parts[3]) {
    options = splitOptions(parts[3])
  } else if (parts[2]?.includes(',')) {
    options = splitOptions(parts[2])
    explanation = undefined
  }
  return {
    type: 'cloze',
    term: hintMatch?.[1] ?? target,
    sentence,
    target,
    explanation,
    options,
  }
}

function parseVocab(line: string): ParsedCard | null {
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
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean)
}
