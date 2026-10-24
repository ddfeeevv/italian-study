import { LogOut, Moon, Sun, Volume2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Button, Card, Field, Input, Page } from '../components/ui'
import { masteredCount } from '../lib/srs'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import type { ThemePreference } from '../types/models'

const THEMES: Array<{ id: ThemePreference; label: string }> = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'system', label: 'Система' },
]

export function AccountPage() {
  const { user, signOut } = useAuth()
  const { cards, settings, setSettings } = useAppStore()
  const securityLock = useRef(false)
  const [securityBusy, setSecurityBusy] = useState(false)

  const setSecurityLock = (busy: boolean) => {
    if (busy) {
      if (securityLock.current) return false
      securityLock.current = true
      setSecurityBusy(true)
      return true
    }
    securityLock.current = false
    setSecurityBusy(false)
    return true
  }

  return (
    <Page>
      <header className="mb-6 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Аккаунт</p>
        <h1 className="mt-1 font-display text-3xl lg:text-4xl">Профиль</h1>
        <p className="mt-2 truncate text-sm text-muted">{user?.email}</p>
        {user?.new_email ? (
          <p className="mt-2 text-sm leading-6 text-muted">
            Ждёт подтверждения: {user.new_email}. Почта сменится после ссылок из писем на новый и текущий
            адрес.
          </p>
        ) : null}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="grid grid-cols-3 gap-3 px-4 py-5 text-center lg:col-span-2 lg:px-8 lg:py-8">
          <Stat value={cards.length} label="карточек" />
          <Stat value={masteredCount(cards)} label="освоено" />
          <Stat value={cards.filter((card) => card.stage > 0).length} label="в работе" />
        </Card>

        <Card className="px-4 py-4">
          <p className="mb-3 text-sm font-semibold">Тема</p>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSettings({ theme: theme.id })}
                className={
                  settings.theme === theme.id
                    ? 'flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-card text-sm font-semibold text-fg shadow-sm'
                    : 'flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted'
                }
              >
                {theme.id === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                {theme.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="px-4 py-4">
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoPlayAudio}
            onClick={() => setSettings({ autoPlayAudio: !settings.autoPlayAudio })}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-surface text-accent">
              <Volume2 size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Автопроизношение</span>
              <span className="block text-xs leading-5 text-muted">
                Озвучивать итальянский при открытии карточки. Пробел — повтор.
              </span>
            </span>
            <span
              className={
                settings.autoPlayAudio
                  ? 'relative h-7 w-12 shrink-0 rounded-full bg-accent'
                  : 'relative h-7 w-12 shrink-0 rounded-full bg-line'
              }
            >
              <span
                className={
                  settings.autoPlayAudio
                    ? 'absolute top-0.5 left-6 size-6 rounded-full bg-white shadow-sm transition-all'
                    : 'absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-all'
                }
              />
            </span>
          </button>
        </Card>

        <EmailChangeForm email={user?.email ?? ''} locked={securityBusy} onBusy={setSecurityLock} />
        <PasswordChangeForm email={user?.email ?? ''} locked={securityBusy} onBusy={setSecurityLock} />

        <Button className="w-full lg:w-fit lg:px-8" variant="secondary" onClick={() => void signOut()}>
          <LogOut size={16} />
          Выйти
        </Button>
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-muted lg:mx-0 lg:text-left">
        Интервалы: 1 → 3 → 7 → 14 → 30 дней. Ошибка сбрасывает карточку и оставляет её в сессии.
        Прогресс пишется в Supabase и кэшируется на устройстве.
      </p>
    </Page>
  )
}

function EmailChangeForm({
  email,
  locked,
  onBusy,
}: {
  email: string
  locked: boolean
  onBusy: (busy: boolean) => boolean
}) {
  const { changeEmail } = useAuth()
  const [nextEmail, setNextEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [message, setMessage] = useState<Notice | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked || !onBusy(true)) return
    setMessage(null)
    let error: string | null
    try {
      error = await changeEmail(currentPassword, nextEmail)
    } catch {
      error = 'Не удалось обновить данные. Попробуйте ещё раз.'
    } finally {
      setCurrentPassword('')
      onBusy(false)
    }
    if (error) {
      setMessage({ tone: 'err', text: error })
      return
    }
    setNextEmail('')
    setMessage({
      tone: 'ok',
      text: 'Письма отправлены. Новый адрес заработает после подтверждения ссылок из обоих ящиков.',
    })
  }

  return (
    <Card className="px-4 py-4">
      <p className="text-sm font-semibold">Почта</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        Нужен текущий пароль. Адрес сменится после подтверждения ссылками из писем на новую и текущую почту.
      </p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
        <AccountUsername email={email} />
        <Field label="Новая почта">
          <Input
            type="email"
            name="new-email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={nextEmail}
            onChange={(event) => setNextEmail(event.target.value)}
            placeholder="new@email.com"
          />
        </Field>
        <Field label="Текущий пароль">
          <Input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Button className="w-full" type="submit" disabled={locked || !nextEmail || !currentPassword}>
          Отправить подтверждение
        </Button>
        {message ? <NoticeText notice={message} /> : null}
      </form>
    </Card>
  )
}

function PasswordChangeForm({
  email,
  locked,
  onBusy,
}: {
  email: string
  locked: boolean
  onBusy: (busy: boolean) => boolean
}) {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<Notice | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked) return
    if (nextPassword !== confirmPassword) {
      setMessage({ tone: 'err', text: 'Новый пароль и повтор не совпадают' })
      return
    }
    if (!onBusy(true)) return
    setMessage(null)
    let error: string | null
    try {
      error = await changePassword(currentPassword, nextPassword)
    } catch {
      error = 'Не удалось обновить данные. Попробуйте ещё раз.'
    } finally {
      setCurrentPassword('')
      onBusy(false)
    }
    if (error) {
      setMessage({ tone: 'err', text: error })
      return
    }
    setNextPassword('')
    setConfirmPassword('')
    setMessage({ tone: 'ok', text: 'Пароль обновлён. Другие сессии завершены.' })
  }

  return (
    <Card className="px-4 py-4">
      <p className="text-sm font-semibold">Пароль</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        Минимум 8 символов. После смены этот браузер останется в аккаунте, остальные сессии завершатся.
      </p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
        <AccountUsername email={email} />
        <Field label="Текущий пароль">
          <Input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Field label="Новый пароль">
          <Input
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
          />
        </Field>
        <Field label="Повтор нового пароля">
          <Input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>
        <Button
          className="w-full"
          type="submit"
          disabled={locked || !currentPassword || !nextPassword || !confirmPassword}
        >
          Сменить пароль
        </Button>
        {message ? <NoticeText notice={message} /> : null}
      </form>
    </Card>
  )
}

function AccountUsername({ email }: { email: string }) {
  return (
    <input
      type="email"
      name="username"
      autoComplete="username"
      value={email}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
    />
  )
}

type Notice = { tone: 'ok' | 'err'; text: string }

function NoticeText({ notice }: { notice: Notice }) {
  return (
    <p
      role={notice.tone === 'err' ? 'alert' : 'status'}
      className={notice.tone === 'err' ? 'text-center text-sm text-warn' : 'text-center text-sm text-success'}
    >
      {notice.text}
    </p>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl lg:text-4xl">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
