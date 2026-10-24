import { createClient } from '@supabase/supabase-js'
import type { CardType, Script, Stage, SubjectKind } from '../types/models'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const url = supabaseUrl || 'https://xxzsivlzbiktxjmdadkr.supabase.co'
const anonKey = supabaseAnonKey || 'public-anon-key'

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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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
