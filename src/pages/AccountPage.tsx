import { LogOut, Moon, Sun, Volume2 } from 'lucide-react'
import { Button, Card, Page } from '../components/ui'
import { SyncBadge } from '../components/SyncBadge'
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

  return (
    <Page>
      <header className="mb-6 flex items-start justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Аккаунт</p>
          <h1 className="mt-1 font-display text-3xl">Профиль</h1>
          <p className="mt-2 truncate text-sm text-muted">{user?.email}</p>
        </div>
        <SyncBadge />
      </header>

      <Card className="mb-4 grid grid-cols-3 gap-3 px-4 py-5 text-center">
        <Stat value={cards.length} label="карточек" />
        <Stat value={masteredCount(cards)} label="освоено" />
        <Stat value={cards.filter((card) => card.stage > 0).length} label="в работе" />
      </Card>

      <Card className="mb-4 px-4 py-4">
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

      <Card className="mb-4 px-4 py-4">
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

      <Button className="w-full" variant="secondary" onClick={() => void signOut()}>
        <LogOut size={16} />
        Выйти
      </Button>

      <p className="mt-8 text-center text-xs leading-5 text-muted">
        Интервалы: 1 → 3 → 7 → 14 → 30 дней. Ошибка сбрасывает карточку и оставляет её в сессии.
        Прогресс пишется в Supabase и кэшируется на устройстве.
      </p>
    </Page>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
