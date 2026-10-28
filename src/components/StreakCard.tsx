import { Flame } from 'lucide-react'
import { useMemo, useState } from 'react'
import { localeMeta } from '../i18n/locales'
import { useI18n } from '../i18n/translate'
import { weekKeys, type StreakView } from '../lib/streak'
import { clsx } from '../lib/utils'
import { useStreak } from '../store/streak-store'
import { Button, Card, Sheet } from './ui'

function streakTone(view: StreakView): string {
  if (view.canRestore) return 'bg-danger-soft text-danger'
  if (view.count > 0) return 'bg-warn-soft text-warn'
  return 'bg-surface text-muted'
}

function useStreakCopy() {
  const { t, plural } = useI18n()
  const streak = useStreak()
  const { view } = streak
  const savedDays = plural('days', view.savedCount)
  const resultDays = plural('days', view.restoredCount)
  const goal = view.goal
  const progress = { count: view.todayCount, goal }
  let status = view.todayCount > 0 ? t('streak.progress', progress) : t('streak.start', { goal })
  if (view.canRestore && view.practicedToday) {
    status = t('streak.offerToday', { count: view.savedCount, days: savedDays })
  } else if (view.canRestore) {
    status = t('streak.offer', { count: view.savedCount, days: savedDays })
  } else if (view.atRisk) {
    status = t('streak.atRisk', progress)
  } else if (view.practicedToday) {
    status = t('streak.practiced')
  } else if (view.restoreBlock === 'used' && view.count === 0) {
    status = t('streak.restoreUsed', { goal })
  }
  const hint = view.practicedToday
    ? t('streak.restoreHintToday', { count: view.restoredCount, days: resultDays, goal })
    : t('streak.restoreHint', { count: view.restoredCount, days: resultDays, goal })
  const restoreLabel = t('streak.restore', { count: view.restoredCount, days: resultDays })
  const openLabel = `${t('streak.open', { count: view.count, days: plural('days', view.count) })}. ${status}`
  return { ...streak, status, hint, restoreLabel, openLabel, t, plural }
}

function StreakWeek({ view }: { view: StreakView }) {
  const { locale } = useI18n()
  const html = localeMeta(locale).html
  const weekday = useMemo(() => new Intl.DateTimeFormat(html, { weekday: 'short' }), [html])
  const full = useMemo(() => new Intl.DateTimeFormat(html, { weekday: 'long', day: 'numeric', month: 'long' }), [html])
  const days = weekKeys(view.today)

  return (
    <div className="grid max-w-sm grid-cols-7 gap-1.5">
      {days.map((day) => {
        const [y, m, d] = day.split('-').map(Number)
        const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
        const done = Boolean(view.streakStart && view.streakEnd && day >= view.streakStart && day <= view.streakEnd)
        const today = day === view.today
        const label = full.format(date)
        return (
          <div key={day} className="flex min-w-0 flex-col items-center gap-1" title={label}>
            <span className={clsx('w-full truncate text-center text-[11px] leading-none', today ? 'font-semibold text-fg' : 'text-muted')}>
              {weekday.format(date)}
            </span>
            <span
              className={clsx(
                'flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-[11px] font-semibold',
                done && 'bg-warn text-accent-fg',
                !done && today && 'border-2 border-warn text-warn',
                !done && !today && 'bg-surface text-muted',
              )}
            >
              {done ? <Flame size={14} fill="currentColor" aria-hidden="true" /> : d}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function StreakSummary({ view, status }: { view: StreakView; status: string }) {
  const { plural, t } = useI18n()
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
        <span className={clsx('flex size-12 shrink-0 items-center justify-center rounded-full', streakTone(view))}>
          <Flame
            size={22}
            fill={view.practicedToday ? 'currentColor' : 'none'}
            aria-hidden="true"
            className={view.atRisk ? 'animate-pulse' : undefined}
          />
        </span>
        <div>
          <p className={clsx('font-display text-4xl leading-none', view.canRestore ? 'text-danger' : view.count > 0 ? 'text-warn' : 'text-muted')}>
            {view.count}
          </p>
          <p className="mt-1 text-sm text-muted">{plural('days', view.count)}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <StreakWeek view={view} />
        <p className="mt-3 text-sm leading-6 text-fg">{status}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{t('streak.rule')}</p>
      </div>
    </div>
  )
}

function StreakSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { view, restore, status, hint, restoreLabel, t } = useStreakCopy()
  if (!open) return null
  return (
    <Sheet onClose={onClose}>
      <h2 className="font-display text-2xl">{t('streak.title')}</h2>
      <div className="mt-4">
        <StreakSummary view={view} status={status} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{t('streak.lead')}</p>
      {view.canRestore ? (
        <div className="mt-5 grid gap-2">
          <p className="text-sm leading-6">{hint}</p>
          <Button
            className="w-full"
            onClick={() => {
              restore()
            }}
          >
            <Flame size={16} fill="currentColor" aria-hidden="true" />
            {restoreLabel}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
          {t('common.done')}
        </Button>
      )}
    </Sheet>
  )
}

export function StreakBadge({ wide = false }: { wide?: boolean }) {
  const { view, status, openLabel, plural } = useStreakCopy()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={status}
        aria-label={openLabel}
        className={clsx(
          'text-left transition hover:opacity-90',
          streakTone(view),
          wide
            ? 'mb-4 flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5'
            : 'inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-bold',
        )}
      >
        <Flame
          size={wide ? 18 : 15}
          fill={view.practicedToday ? 'currentColor' : 'none'}
          aria-hidden="true"
          className={view.atRisk ? 'animate-pulse' : undefined}
        />
        <span className={wide ? 'font-display text-2xl leading-none' : undefined}>{view.count}</span>
        {!view.practicedToday && (view.todayCount > 0 || view.count > 0) ? (
          <span className={clsx('font-semibold tabular-nums', wide ? 'text-xs' : 'text-[11px]')}>
            {view.todayCount}/{view.goal}
          </span>
        ) : null}
        {wide ? <span className="min-w-0 truncate text-xs font-semibold">{plural('days', view.count)}</span> : null}
      </button>
      <StreakSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function StreakCard() {
  const { view, status, restoreLabel } = useStreakCopy()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Card className="mb-6 px-4 py-4 sm:px-5">
        <StreakSummary view={view} status={status} />
        {view.canRestore ? (
          <Button className="mt-4 w-full sm:w-auto" onClick={() => setOpen(true)}>
            <Flame size={16} fill="currentColor" aria-hidden="true" />
            {restoreLabel}
          </Button>
        ) : null}
      </Card>
      <StreakSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function StreakCompleteLine() {
  const { t, plural } = useI18n()
  const { view } = useStreak()
  if (!view.practicedToday && view.todayCount <= 0) return null
  const lit = view.practicedToday && view.count > 0
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-warn">
      <Flame size={16} fill={lit ? 'currentColor' : 'none'} aria-hidden="true" />
      {lit
        ? t('streak.session', { count: view.count, days: plural('days', view.count) })
        : t('streak.progress', { count: view.todayCount, goal: view.goal })}
    </p>
  )
}
