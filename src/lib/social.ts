import { t } from '../i18n/translate'
import type { MessageKey } from '../i18n/messages'
import { DEFAULT_AVATAR, isAvatar } from './avatars'
import { supabase } from './supabase'
import type { FriendProgressRow, ProfileRow } from './supabase'

export type Profile = {
  id: string
  username: string
  avatar: string
  customized: boolean
}

export type FriendRelation = 'incoming' | 'outgoing' | 'friend'

export type FriendRow = {
  friendshipId: string
  userId: string
  username: string
  avatar: string
  relation: FriendRelation
  cards: number
  mastered: number
  working: number
  streak: number
  studiedToday: boolean
  pairStreak: number
}

export type SearchHit = {
  id: string
  username: string
  avatar: string
}

const USERNAME = /^[a-z0-9_]{3,20}$/

export function cleanUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

export function usernameError(name: string): string | null {
  if (name.length < 3) return t('social.usernameShort')
  if (!USERNAME.test(name)) return t('social.usernameBad')
  return null
}

export function isMissingSocial(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42883' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the function')
  )
}

export function socialError(
  error: { code?: string; message?: string } | null,
  fallback: MessageKey,
): string {
  if (!error) return t(fallback)
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (code === '23505' && /username/i.test(message)) return t('social.usernameTaken')
  if (code === '23505' || /already related/i.test(message)) return t('social.already')
  if (/bad username|profiles_username_format/i.test(message)) return t('social.usernameBad')
  if (/too many/i.test(message)) return t('social.tooMany')
  return t(fallback)
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    avatar: isAvatar(row.avatar) ? row.avatar : DEFAULT_AVATAR,
    customized: Boolean(row.customized),
  }
}

export function mapFriend(row: FriendProgressRow): FriendRow | null {
  if (row.relation !== 'incoming' && row.relation !== 'outgoing' && row.relation !== 'friend') return null
  return {
    friendshipId: row.friendship_id,
    userId: row.user_id,
    username: row.username,
    avatar: row.avatar,
    relation: row.relation,
    cards: row.cards,
    mastered: row.mastered,
    working: row.working,
    streak: row.streak,
    studiedToday: row.studied_today,
    pairStreak: row.pair_streak,
  }
}

export function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (!data) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

export async function searchProfiles(raw: string): Promise<{ hits: SearchHit[]; error: string | null }> {
  const q = cleanUsername(raw)
  if (q.length < 2) return { hits: [], error: t('social.searchShort') }
  const { data, error } = await supabase.rpc('search_profiles', { q })
  if (error) return { hits: [], error: socialError(error, 'social.searchFailed') }
  const hits = (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    avatar: row.avatar,
  }))
  return { hits, error: null }
}
