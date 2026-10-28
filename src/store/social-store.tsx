import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n/translate'
import { DEFAULT_AVATAR, isAvatar } from '../lib/avatars'
import {
  cleanUsername,
  firstRow,
  isMissingSocial,
  mapFriend,
  mapProfile,
  socialError,
  usernameError,
  type FriendRow,
  type Profile,
} from '../lib/social'
import { dayKey } from '../lib/streak'
import { supabase } from '../lib/supabase'
import type { FriendProgressRow, ProfileRow } from '../lib/supabase'
import { useAuth } from './auth-store'

type SocialStore = {
  ready: boolean
  unavailable: boolean
  error: string | null
  profile: Profile | null
  friends: FriendRow[]
  incomingCount: number
  refresh: () => Promise<void>
  saveProfile: (username: string, avatar: string) => Promise<string | null>
  sendRequest: (userId: string) => Promise<string | null>
  accept: (friendshipId: string) => Promise<string | null>
  remove: (friendshipId: string) => Promise<string | null>
}

const SocialContext = createContext<SocialStore | null>(null)

function readProfile(data: unknown): Profile | null {
  const row = firstRow(data as ProfileRow | ProfileRow[] | null)
  if (!row || typeof row.id !== 'string' || typeof row.username !== 'string') return null
  return mapProfile({
    id: row.id,
    username: row.username,
    avatar: typeof row.avatar === 'string' ? row.avatar : DEFAULT_AVATAR,
    customized: Boolean(row.customized),
    role: row.role === 'teacher' ? 'teacher' : 'student',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  })
}

function readFriends(data: unknown): FriendRow[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const mapped = mapFriend(row as FriendProgressRow)
    return mapped ? [mapped] : []
  })
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const userRef = useRef(userId)
  const gen = useRef(0)
  userRef.current = userId
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [friends, setFriends] = useState<FriendRow[]>([])

  const refresh = useCallback(async () => {
    const id = userRef.current
    if (!id) return
    const token = ++gen.current
    const [profileRes, boardRes] = await Promise.all([
      supabase.rpc('ensure_profile'),
      supabase.rpc('friend_progress', { today: dayKey(new Date()) }),
    ])
    if (token !== gen.current || userRef.current !== id) return
    if (isMissingSocial(profileRes.error) || isMissingSocial(boardRes.error)) {
      setUnavailable(true)
      setProfile(null)
      setFriends([])
      setError(null)
      setReady(true)
      return
    }
    const nextProfile = readProfile(profileRes.data)
    if (profileRes.error || !nextProfile) {
      setError(socialError(profileRes.error, 'social.actionFailed'))
      setReady(true)
      return
    }
    setUnavailable(false)
    setProfile(nextProfile)
    if (boardRes.error) {
      setError(socialError(boardRes.error, 'social.actionFailed'))
    } else {
      setFriends(readFriends(boardRes.data))
      setError(null)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!userId) {
      gen.current += 1
      setProfile(null)
      setFriends([])
      setReady(false)
      setUnavailable(false)
      setError(null)
      return
    }
    setReady(false)
    void refresh()
  }, [refresh, userId])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && userRef.current) void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  const saveProfile = useCallback(async (username: string, avatar: string) => {
    const id = userRef.current
    if (!id) return t('auth.sessionMissing')
    const name = cleanUsername(username)
    const issue = usernameError(name)
    if (issue) return issue
    if (!isAvatar(avatar)) return t('social.saveFailed')
    const { data, error: saveError } = await supabase
      .from('profiles')
      .update({ username: name, avatar, customized: true })
      .eq('id', id)
      .select('*')
      .single()
    if (userRef.current !== id) return t('auth.sessionMissing')
    if (saveError || !data) return socialError(saveError, 'social.saveFailed')
    setProfile(mapProfile(data))
    return null
  }, [])

  const sendRequest = useCallback(
    async (targetId: string) => {
      const id = userRef.current
      if (!id) return t('auth.sessionMissing')
      if (targetId === id) return t('social.usernameBad')
      const { error: insertError } = await supabase.from('friendships').insert({
        requester_id: id,
        addressee_id: targetId,
        status: 'pending',
      })
      if (insertError) return socialError(insertError, 'social.actionFailed')
      await refresh()
      return null
    },
    [refresh],
  )

  const accept = useCallback(
    async (friendshipId: string) => {
      const id = userRef.current
      if (!id) return t('auth.sessionMissing')
      const { data, error: updateError } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
        .eq('addressee_id', id)
        .eq('status', 'pending')
        .select('id')
      if (updateError || !data?.length) return socialError(updateError, 'social.actionFailed')
      await refresh()
      return null
    },
    [refresh],
  )

  const remove = useCallback(
    async (friendshipId: string) => {
      const id = userRef.current
      if (!id) return t('auth.sessionMissing')
      const { data, error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .select('id')
      if (deleteError || !data?.length) return socialError(deleteError, 'social.actionFailed')
      await refresh()
      return null
    },
    [refresh],
  )

  const incomingCount = useMemo(
    () => friends.filter((row) => row.relation === 'incoming').length,
    [friends],
  )

  const value = useMemo<SocialStore>(
    () => ({
      ready,
      unavailable,
      error,
      profile,
      friends,
      incomingCount,
      refresh,
      saveProfile,
      sendRequest,
      accept,
      remove,
    }),
    [accept, error, friends, incomingCount, profile, ready, refresh, remove, saveProfile, sendRequest, unavailable],
  )

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocial(): SocialStore {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error('useSocial must be used within SocialProvider')
  return ctx
}
