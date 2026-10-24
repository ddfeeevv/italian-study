import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LanguageMenu } from '../components/LanguageSwitcher'
import { Button, Card, Field, Input, Screen } from '../components/ui'
import { useI18n } from '../i18n/translate'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/auth-store'

export function AuthPage() {
  const { t } = useI18n()
  const { session, signIn, signUp, signInMagic } = useAuth()
  const [mode, setMode] = useState<'in' | 'up' | 'magic'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [rateLimitUntil, setRateLimitUntil] = useState(0)

  if (session) return <Navigate to="/" replace />

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const submit = async () => {
    if (Date.now() < rateLimitUntil) {
      setMessage({ tone: 'error', text: t('auth.waitRetry') })
      return
    }
    if (!emailOk) {
      setMessage({ tone: 'error', text: t('auth.badEmail') })
      return
    }
    if (mode !== 'magic' && password.length < 8) {
      setMessage({ tone: 'error', text: t('auth.passwordShort', { min: 8 }) })
      return
    }
    setBusy(true)
    setMessage(null)
    const error =
      mode === 'magic'
        ? await signInMagic(email)
        : mode === 'up'
          ? await signUp(email, password)
          : await signIn(email, password)
    setBusy(false)
    if (error) {
      setMessage({ tone: 'error', text: error })
      setRateLimitUntil(Date.now() + 3000)
      return
    }
    if (mode === 'magic' || mode === 'up') {
      setMessage({ tone: 'info', text: t('auth.checkEmail') })
    }
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-2">
        <aside className="hidden flex-col justify-between border-r border-line bg-card px-12 py-10 lg:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
            <h1 className="mt-6 max-w-md font-display text-5xl leading-tight">{t('auth.heroTitle')}</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">{t('auth.heroText')}</p>
          </div>
          <p className="text-sm text-muted">{t('auth.intervals')}</p>
        </aside>
        <main className="flex flex-1 flex-col justify-center px-5 py-10 lg:px-16">
          <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex justify-end">
            <LanguageMenu />
          </div>
          <div className="lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
          <h1 className="mt-2 font-display text-4xl">{t('auth.mobileTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t('auth.mobileText')}</p>
        </div>
        <div className="mb-6 hidden lg:block">
          <h1 className="font-display text-4xl">{t('auth.loginTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t('auth.loginText')}</p>
        </div>

        {!supabaseConfigured ? (
          <Card className="mt-6 px-4 py-4 text-sm leading-6 text-warn">
            {t('auth.missingKeys')}
          </Card>
        ) : (
          <Card className="mt-8 space-y-4 px-4 py-5">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 text-sm">
              {([
                ['in', t('auth.tabIn')],
                ['up', t('auth.tabUp')],
                ['magic', t('auth.tabMagic')],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={
                    mode === id
                      ? 'min-h-10 rounded-xl bg-card font-semibold'
                      : 'min-h-10 rounded-xl text-muted'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <Field label={t('auth.email')}>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
              />
            </Field>
            {mode !== 'magic' ? (
              <Field label={t('auth.password')}>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.passwordHint')}
                />
              </Field>
            ) : null}
            <Button className="w-full" disabled={busy || !email.trim()} onClick={() => void submit()}>
              {mode === 'magic' ? t('auth.sendLink') : mode === 'up' ? t('auth.createAccount') : t('auth.signIn')}
            </Button>
            {message ? (
              <p
                role={message.tone === 'error' ? 'alert' : 'status'}
                className={
                  message.tone === 'error'
                    ? 'rounded-2xl bg-danger-soft px-3 py-2 text-center text-sm text-danger'
                    : 'rounded-2xl bg-success-soft px-3 py-2 text-center text-sm text-success'
                }
              >
                {message.text}
              </p>
            ) : null}
          </Card>
        )}
          </div>
        </main>
      </div>
    </Screen>
  )
}
