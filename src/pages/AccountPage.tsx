import { LogOut, Moon, Sun, Volume2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Button, Card, Field, Input, Page } from '../components/ui'
import { useI18n } from '../i18n/translate'
import { masteredCount } from '../lib/srs'
import { cardsInSubject } from '../lib/subjects'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import type { ThemePreference } from '../types/models'

export function AccountPage() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const themes: Array<{ id: ThemePreference; label: string }> = [
    { id: 'light', label: t('account.themeLight') },
    { id: 'dark', label: t('account.themeDark') },
    { id: 'system', label: t('account.themeSystem') },
  ]
  const { cards, decks, settings, setSettings, activeSubject } = useAppStore()
  const subjectCards = cardsInSubject(cards, decks, activeSubject?.id)
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
        <h1 className="font-display text-3xl lg:text-4xl">{t('account.title')}</h1>
        <p className="mt-2 truncate text-sm text-muted">{user?.email}</p>
        {user?.new_email ? (
          <p className="mt-2 text-sm leading-6 text-muted">
            {t('account.pendingEmail', { email: user.new_email })}
          </p>
        ) : null}
      </header>

      <Card className="grid grid-cols-3 gap-3 px-4 py-5 text-center lg:px-8 lg:py-8">
        <Stat value={subjectCards.length} label={t('account.cards')} />
        <Stat value={masteredCount(subjectCards)} label={t('account.mastered')} />
        <Stat value={subjectCards.filter((card) => card.stage > 0).length} label={t('account.working')} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col justify-center px-4 py-4">
          <p className="mb-3 text-sm font-semibold">{t('account.theme')}</p>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1">
            {themes.map((theme) => (
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

        <Card className="flex h-full items-center px-4 py-4">
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
              <span className="block text-sm font-semibold">{t('account.autoplay')}</span>
              <span className="block text-xs leading-5 text-muted">{t('account.autoplayHint')}</span>
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
      </div>

      <div className="mt-8 grid items-start gap-4 border-t border-line pt-8 lg:grid-cols-2">
        <EmailChangeForm email={user?.email ?? ''} locked={securityBusy} onBusy={setSecurityLock} />
        <PasswordChangeForm email={user?.email ?? ''} locked={securityBusy} onBusy={setSecurityLock} />
      </div>

      <Button className="mt-8 w-full lg:w-fit lg:px-8" variant="secondary" onClick={() => void signOut()}>
        <LogOut size={16} />
        {t('account.signOut')}
      </Button>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-muted lg:mx-0 lg:text-left">
        {t('common.contact')}:{' '}
        <a className="text-accent underline-offset-2 hover:underline" href="mailto:d.dfeeevv@gmail.com">
          d.dfeeevv@gmail.com
        </a>
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
  const { t } = useI18n()
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
      error = t('auth.updateFailed')
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
      text: t('account.emailSent'),
    })
  }

  return (
    <Card className="px-4 py-4">
      <p className="text-sm font-semibold">{t('account.email')}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{t('account.emailHint')}</p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
        <AccountUsername email={email} />
        <Field label={t('account.newEmail')}>
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
        <Field label={t('account.currentPassword')}>
          <Input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Button className="w-full" type="submit" disabled={locked || !nextEmail || !currentPassword}>
          {t('account.sendConfirm')}
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
  const { t } = useI18n()
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<Notice | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked) return
    if (nextPassword !== confirmPassword) {
      setMessage({ tone: 'err', text: t('account.passwordMismatch') })
      return
    }
    if (!onBusy(true)) return
    setMessage(null)
    let error: string | null
    try {
      error = await changePassword(currentPassword, nextPassword)
    } catch {
      error = t('auth.updateFailed')
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
    setMessage({ tone: 'ok', text: t('account.passwordUpdated') })
  }

  return (
    <Card className="px-4 py-4">
      <p className="text-sm font-semibold">{t('account.password')}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{t('account.passwordHint')}</p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
        <AccountUsername email={email} />
        <Field label={t('account.currentPassword')}>
          <Input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Field label={t('account.newPassword')}>
          <Input
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
          />
        </Field>
        <Field label={t('account.repeatPassword')}>
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
          {t('account.changePassword')}
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
