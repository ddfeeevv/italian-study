import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'

type AuthStore = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signInMagic: (email: string) => Promise<string | null>
  changeEmail: (currentPassword: string, nextEmail: string) => Promise<string | null>
  changePassword: (currentPassword: string, nextPassword: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthStore | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthStore>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error?.message ?? null
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authRedirectTo() },
        })
        return error?.message ?? null
      },
      signInMagic: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: authRedirectTo() },
        })
        return error?.message ?? null
      },
      changeEmail: async (currentPassword, nextEmail) => {
        const email = session?.user.email
        const userId = session?.user.id
        if (!email || !userId) return 'Сессия не найдена. Войдите снова.'
        const normalized = nextEmail.trim().toLowerCase()
        if (!isEmail(normalized)) return 'Укажите корректную почту'
        if (normalized === email.toLowerCase()) return 'Это уже текущая почта'
        const proof = await proveCurrentPassword(userId, email, currentPassword)
        if (proof) return proof
        const { error } = await supabase.auth.updateUser(
          { email: normalized },
          { emailRedirectTo: authRedirectTo() },
        )
        return error ? authErrorMessage(error) : null
      },
      changePassword: async (currentPassword, nextPassword) => {
        const email = session?.user.email
        const userId = session?.user.id
        if (!email || !userId) return 'Сессия не найдена. Войдите снова.'
        const issue = passwordIssue(nextPassword)
        if (issue) return issue
        if (nextPassword === currentPassword) return 'Новый пароль должен отличаться от текущего'
        if (nextPassword.toLowerCase() === email.toLowerCase()) return 'Пароль не должен совпадать с почтой'
        const proof = await proveCurrentPassword(userId, email, currentPassword)
        if (proof) return proof
        const { error } = await supabase.auth.updateUser({
          password: nextPassword,
          current_password: currentPassword,
        })
        if (error) return authErrorMessage(error)
        const { error: othersError } = await supabase.auth.signOut({ scope: 'others' })
        if (othersError) {
          return 'Пароль обновлён, но другие сессии не удалось завершить. Выйдите на остальных устройствах вручную.'
        }
        return null
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function authRedirectTo(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '')
}

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72

function passwordIssue(password: string): string | null {
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return 'Пароль слишком длинный'
  return null
}

function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function proveCurrentPassword(
  userId: string,
  email: string,
  password: string,
): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return authErrorMessage(error)
  if (data.user?.id !== userId) {
    await supabase.auth.signOut({ scope: 'local' })
    return 'Не удалось подтвердить аккаунт'
  }
  return null
}

function authErrorMessage(error: { message: string; code?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
    case 'current_password_mismatch':
    case 'reauthentication_not_valid':
      return 'Неверный текущий пароль'
    case 'current_password_required':
    case 'reauthentication_needed':
    case 'reauth_nonce_missing':
      return 'Нужно заново подтвердить текущий пароль'
    case 'same_password':
      return 'Новый пароль должен отличаться от текущего'
    case 'weak_password':
      return 'Этот пароль слишком простой или уже встречался в утечках. Выберите другой.'
    case 'email_exists':
    case 'user_already_exists':
      return 'Эта почта уже занята'
    case 'email_address_invalid':
      return 'Укажите корректную почту'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Слишком много попыток. Подождите немного и попробуйте снова.'
    default:
      if (/invalid login credentials|current password/i.test(error.message)) {
        return 'Неверный текущий пароль'
      }
      return 'Не удалось обновить данные. Попробуйте ещё раз.'
  }
}

export function useAuth(): AuthStore {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
