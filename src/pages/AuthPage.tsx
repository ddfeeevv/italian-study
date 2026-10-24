import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Card, Field, Input, Screen } from '../components/ui'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/auth-store'

export function AuthPage() {
  const { session, signIn, signUp, signInMagic } = useAuth()
  const [mode, setMode] = useState<'in' | 'up' | 'magic'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async () => {
    setBusy(true)
    setMessage('')
    const error =
      mode === 'magic'
        ? await signInMagic(email)
        : mode === 'up'
          ? await signUp(email, password)
          : await signIn(email, password)
    setBusy(false)
    if (error) {
      setMessage(error)
      return
    }
    if (mode === 'magic' || mode === 'up') {
      setMessage('Проверьте почту — там ссылка для входа.')
    }
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-2">
        <aside className="hidden flex-col justify-between border-r border-line bg-card px-12 py-10 lg:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
            <h1 className="mt-6 max-w-md font-display text-5xl leading-tight">
              Учить итальянский с телефона и с ноутбука
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Колоды, грамматика и интервалы повторения синхронизируются через Supabase.
            </p>
          </div>
          <p className="text-sm text-muted">Интервалы: 1 → 3 → 7 → 14 → 30 дней</p>
        </aside>
        <main className="flex flex-1 flex-col justify-center px-5 py-10 lg:px-16">
          <div className="mx-auto w-full max-w-md">
        <div className="lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
          <h1 className="mt-2 font-display text-4xl">Учить итальянский с любого устройства</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Войдите, чтобы колоды, грамматика и прогресс SRS синхронизировались через Supabase.
          </p>
        </div>
        <div className="mb-6 hidden lg:block">
          <h1 className="font-display text-4xl">Вход</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Колоды и прогресс подтянутся из того же аккаунта, что и на телефоне.
          </p>
        </div>

        {!supabaseConfigured ? (
          <Card className="mt-6 px-4 py-4 text-sm leading-6 text-warn">
            Нет ключей Supabase. Добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в `.env.local`.
          </Card>
        ) : (
          <Card className="mt-6 space-y-4 px-4 py-5">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 text-sm">
              {([
                ['in', 'Вход'],
                ['up', 'Регистрация'],
                ['magic', 'Ссылка'],
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
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
              />
            </Field>
            {mode !== 'magic' ? (
              <Field label="Пароль">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="минимум 6 символов"
                />
              </Field>
            ) : null}
            <Button className="w-full" disabled={busy || !email} onClick={() => void submit()}>
              {mode === 'magic' ? 'Прислать ссылку' : mode === 'up' ? 'Создать аккаунт' : 'Войти'}
            </Button>
            {message ? <p className="text-center text-sm text-muted">{message}</p> : null}
          </Card>
        )}
          </div>
        </main>
      </div>
    </Screen>
  )
}
