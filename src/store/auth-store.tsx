import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { t } from '../i18n/translate'
import { cacheKey, queueKey } from '../lib/cache'
import { supabase } from '../lib/supabase'

type AuthStore = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, role: 'student' | 'teacher') => Promise<string | null>
  signInMagic: (email: string, role: 'student' | 'teacher') => Promise<string | null>
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
      signUp: async (email, password, role) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authRedirectTo(),
            data: { needs_onboarding: true, account_role: role },
          },
        })
        return error?.message ?? null
      },
      signInMagic: async (email, role) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: authRedirectTo(),
            data: { account_role: role },
          },
        })
        return error?.message ?? null
      },
      changeEmail: async (currentPassword, nextEmail) => {
        const email = session?.user.email
        const userId = session?.user.id
        if (!email || !userId) return t('auth.sessionMissing')
        const normalized = nextEmail.trim().toLowerCase()
        if (!isEmail(normalized)) return t('auth.badEmail')
        if (normalized === email.toLowerCase()) return t('auth.sameEmail')
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
        if (!email || !userId) return t('auth.sessionMissing')
        const issue = passwordIssue(nextPassword)
        if (issue) return issue
        if (nextPassword === currentPassword) return t('auth.passwordDifferent')
        if (nextPassword.toLowerCase() === email.toLowerCase()) return t('auth.passwordMatchesEmail')
        const proof = await proveCurrentPassword(userId, email, currentPassword)
        if (proof) return proof
        const { error } = await supabase.auth.updateUser({
          password: nextPassword,
          current_password: currentPassword,
        })
        if (error) return authErrorMessage(error)
        const { error: othersError } = await supabase.auth.signOut({ scope: 'others' })
        if (othersError) {
          return t('auth.signOutOthersFailed')
        }
        return null
      },
      signOut: async () => {
        const userId = session?.user?.id
        if (userId) {
          localStorage.removeItem(cacheKey(userId))
          localStorage.removeItem(queueKey(userId))
        }
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
    return t('auth.passwordShort', { min: MIN_PASSWORD_LENGTH })
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return t('auth.passwordLong')
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
    return t('auth.accountUnconfirmed')
  }
  return null
}

function authErrorMessage(error: { message: string; code?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
    case 'current_password_mismatch':
    case 'reauthentication_not_valid':
      return t('auth.wrongPassword')
    case 'current_password_required':
    case 'reauthentication_needed':
    case 'reauth_nonce_missing':
      return t('auth.reauth')
    case 'same_password':
      return t('auth.passwordDifferent')
    case 'weak_password':
      return t('auth.weakPassword')
    case 'email_exists':
    case 'user_already_exists':
      return t('auth.emailTaken')
    case 'email_address_invalid':
      return t('auth.badEmail')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('auth.rateLimit')
    default:
      if (/invalid login credentials|current password/i.test(error.message)) {
        return t('auth.wrongPassword')
      }
      return t('auth.updateFailed')
  }
}

export function useAuth(): AuthStore {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
