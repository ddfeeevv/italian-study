import { createClient } from '@supabase/supabase-js'
import type { CardType, Script, Stage, SubjectKind } from '../types/models'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const url = supabaseUrl || 'http://127.0.0.1:54321'
const anonKey = supabaseAnonKey || 'missing-anon-key'

export type SubjectRow = {
  id: string
  user_id: string
  title: string
  kind: SubjectKind
  locale: string | null
  accents: string[]
  answer_script: Script
  prompt_script: Script
  speech_label: string
  preset_id: string | null
  created_at: string
}

export type DeckRow = {
  id: string
  user_id: string
  title: string
  description: string
  color: string | null
  subject_id?: string | null
  created_at: string
}

export type StreakRow = {
  user_id: string
  count: number
  last_date: string | null
  saved_count: number
  saved_date: string | null
  restore_month: string | null
  progress_date: string | null
  progress_ids: string[]
  updated_at: string
}

export type ProfileRow = {
  id: string
  username: string
  avatar: string
  customized: boolean
  created_at: string
  updated_at: string
}

export type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
  updated_at: string
}

export type FriendProgressRow = {
  friendship_id: string
  user_id: string
  username: string
  avatar: string
  relation: string
  cards: number
  mastered: number
  working: number
  streak: number
  studied_today: boolean
  pair_streak: number
}

export type CardRow = {
  id: string
  deck_id: string
  user_id: string
  type: CardType
  term: string
  translation: string
  sentence: string | null
  target: string
  options: string[]
  explanation: string | null
  notes: string | null
  stage: Stage
  next_review_date: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      subjects: {
        Row: SubjectRow
        Insert: Partial<SubjectRow> & Pick<SubjectRow, 'user_id' | 'title'>
        Update: Partial<SubjectRow>
        Relationships: []
      }
      decks: {
        Row: DeckRow
        Insert: Partial<DeckRow> & Pick<DeckRow, 'user_id' | 'title'>
        Update: Partial<DeckRow>
        Relationships: []
      }
      cards: {
        Row: CardRow
        Insert: Partial<CardRow> & Pick<CardRow, 'deck_id' | 'user_id' | 'term' | 'target'>
        Update: Partial<CardRow>
        Relationships: []
      }
      streaks: {
        Row: StreakRow
        Insert: Omit<StreakRow, 'progress_date' | 'progress_ids'> & Partial<Pick<StreakRow, 'progress_date' | 'progress_ids'>>
        Update: Partial<StreakRow>
        Relationships: []
      }
      profiles: {
        Row: ProfileRow
        Insert: Pick<ProfileRow, 'id' | 'username'> & Partial<ProfileRow>
        Update: Partial<Pick<ProfileRow, 'username' | 'avatar' | 'customized'>>
        Relationships: []
      }
      friendships: {
        Row: FriendshipRow
        Insert: Pick<FriendshipRow, 'requester_id' | 'addressee_id'> & Partial<FriendshipRow>
        Update: Partial<Pick<FriendshipRow, 'status'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      mark_studied: {
        Args: { study_day: string }
        Returns: undefined
      }
      ensure_profile: {
        Args: Record<string, never>
        Returns: ProfileRow
      }
      search_profiles: {
        Args: { q: string }
        Returns: Pick<ProfileRow, 'id' | 'username' | 'avatar'>[]
      }
      friend_progress: {
        Args: { today: string }
        Returns: FriendProgressRow[]
      }
    }
    Enums: {
      card_type: CardType
    }
    CompositeTypes: Record<string, never>
  }
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
