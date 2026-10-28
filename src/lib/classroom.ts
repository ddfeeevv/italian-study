import type { MessageKey } from '../i18n/messages'
import { t } from '../i18n/translate'
import { isMissingSocial, firstRow } from './social'
import { dayKey } from './streak'
import { supabase } from './supabase'
import type {
  ClassBoardRow,
  ClassPreviewRow,
  ClassroomCodeRow,
  JoinClassRow,
  MyClassRow,
  RedeemShareRow,
  ShareCodeRow,
  SharePreviewRow,
} from './supabase'

export type ClassDeck = {
  id: string
  title: string
  kind: 'words' | 'exercise'
  shared: boolean
  total: number
  fresh: number
  learning: number
  mastered: number
}

export type ClassStudent = {
  studentId: string
  username: string
  avatar: string
  joinedAt: string
  cards: number
  mastered: number
  working: number
  streak: number
  studiedToday: boolean
  decks: ClassDeck[]
}

export type ClassPreview = {
  username: string
  avatar: string
  already: boolean
}

export type MyTeacher = {
  classroomId: string
  username: string
  avatar: string
}

export type SharePreview = {
  title: string
  kind: 'words' | 'exercise'
  cards: number
  teacherUsername: string
  teacherAvatar: string
  own: boolean
  already: boolean
  deckId: string | null
}

export type RedeemedShare = {
  deckId: string
  kind: 'words' | 'exercise'
  already: boolean
}

export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

export function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}${path}`
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function classError(
  error: { code?: string; message?: string } | null,
  fallback: MessageKey,
): string {
  if (!error) return t(fallback)
  if (isMissingSocial(error)) return t('class.unavailable')
  const message = error.message ?? ''
  if (/not a student/i.test(message)) return t('class.studentsOnly')
  if (/not a teacher/i.test(message)) return t('class.notTeacher')
  if (/class full/i.test(message)) return t('class.full')
  if (/deck too big/i.test(message)) return t('class.tooBig')
  if (/own material/i.test(message)) return t('share.own')
  if (/bad code/i.test(message)) return t('class.badCode')
  if (/no such deck/i.test(message)) return t('share.failed')
  return t(fallback)
}

function kindOf(value: string): 'words' | 'exercise' {
  return value === 'exercise' ? 'exercise' : 'words'
}

function readDecks(value: unknown): ClassDeck[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.title !== 'string') return []
    return [
      {
        id: row.id,
        title: row.title,
        kind: row.kind === 'exercise' ? 'exercise' : 'words',
        shared: Boolean(row.shared),
        total: Number(row.total) || 0,
        fresh: Number(row.fresh) || 0,
        learning: Number(row.learning) || 0,
        mastered: Number(row.mastered) || 0,
      },
    ]
  })
}

export async function ensureClassroom(): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('ensure_classroom')
  if (error) return { code: null, error: classError(error, 'class.failed') }
  const row = firstRow(data as ClassroomCodeRow | ClassroomCodeRow[] | null)
  if (!row?.code) return { code: null, error: t('class.failed') }
  return { code: row.code, error: null }
}

export async function loadClassBoard(): Promise<{ students: ClassStudent[]; error: string | null }> {
  const { data, error } = await supabase.rpc('class_board', { today: dayKey(new Date()) })
  if (error) return { students: [], error: classError(error, 'class.failed') }
  const students = ((data ?? []) as ClassBoardRow[]).flatMap((row) => {
    if (!row.student_id || !row.username) return []
    return [
      {
        studentId: row.student_id,
        username: row.username,
        avatar: row.avatar,
        joinedAt: row.joined_at,
        cards: row.cards,
        mastered: row.mastered,
        working: row.working,
        streak: row.streak,
        studiedToday: row.studied_today,
        decks: readDecks(row.decks),
      },
    ]
  })
  return { students, error: null }
}

export async function dismissStudent(studentId: string): Promise<string | null> {
  const { error } = await supabase.rpc('dismiss_student', { student: studentId })
  return error ? classError(error, 'class.failed') : null
}

export async function previewClass(raw: string): Promise<{ preview: ClassPreview | null; error: string | null }> {
  const joinCode = cleanCode(raw)
  if (joinCode.length !== 6) return { preview: null, error: null }
  const { data, error } = await supabase.rpc('preview_class', { join_code: joinCode })
  if (error) return { preview: null, error: classError(error, 'class.failed') }
  const row = firstRow(data as ClassPreviewRow | ClassPreviewRow[] | null)
  if (!row?.username) return { preview: null, error: null }
  return {
    preview: { username: row.username, avatar: row.avatar, already: row.already },
    error: null,
  }
}

export async function joinClass(raw: string): Promise<{ username: string | null; already: boolean; error: string | null }> {
  const joinCode = cleanCode(raw)
  if (joinCode.length !== 6) return { username: null, already: false, error: t('class.badCode') }
  const { data, error } = await supabase.rpc('join_classroom', { join_code: joinCode })
  if (error) return { username: null, already: false, error: classError(error, 'class.failed') }
  const row = firstRow(data as JoinClassRow | JoinClassRow[] | null)
  if (!row?.username) return { username: null, already: false, error: t('class.badCode') }
  return { username: row.username, already: row.already, error: null }
}

export async function loadMyTeachers(): Promise<{ teachers: MyTeacher[]; error: string | null }> {
  const { data, error } = await supabase.rpc('my_classes')
  if (error) return { teachers: [], error: classError(error, 'class.failed') }
  const teachers = ((data ?? []) as MyClassRow[]).flatMap((row) => {
    if (!row.classroom_id || !row.username) return []
    return [{ classroomId: row.classroom_id, username: row.username, avatar: row.avatar }]
  })
  return { teachers, error: null }
}

export async function leaveClass(classroomId: string): Promise<string | null> {
  const { error } = await supabase.rpc('leave_class', { class_id: classroomId })
  return error ? classError(error, 'class.failed') : null
}

export async function shareDeck(deckId: string): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('share_deck', { deck: deckId })
  if (error) return { code: null, error: classError(error, 'share.failed') }
  const row = firstRow(data as ShareCodeRow | ShareCodeRow[] | null)
  if (!row?.code) return { code: null, error: t('share.failed') }
  return { code: row.code, error: null }
}

export async function previewShare(raw: string): Promise<{ preview: SharePreview | null; error: string | null }> {
  const shareCode = cleanCode(raw)
  if (shareCode.length !== 8) return { preview: null, error: null }
  const { data, error } = await supabase.rpc('preview_share', { share_code: shareCode })
  if (error) return { preview: null, error: classError(error, 'share.failed') }
  const row = firstRow(data as SharePreviewRow | SharePreviewRow[] | null)
  if (!row?.title) return { preview: null, error: null }
  return {
    preview: {
      title: row.title,
      kind: kindOf(row.kind),
      cards: row.cards,
      teacherUsername: row.teacher_username,
      teacherAvatar: row.teacher_avatar,
      own: row.own,
      already: row.already,
      deckId: row.deck_id,
    },
    error: null,
  }
}

export async function redeemShare(raw: string): Promise<{ redeemed: RedeemedShare | null; error: string | null }> {
  const shareCode = cleanCode(raw)
  if (shareCode.length !== 8) return { redeemed: null, error: t('class.badCode') }
  const { data, error } = await supabase.rpc('redeem_share', { share_code: shareCode })
  if (error) return { redeemed: null, error: classError(error, 'share.failed') }
  const row = firstRow(data as RedeemShareRow | RedeemShareRow[] | null)
  if (!row?.deck_id) return { redeemed: null, error: t('class.badCode') }
  return {
    redeemed: { deckId: row.deck_id, kind: kindOf(row.kind), already: row.already },
    error: null,
  }
}
