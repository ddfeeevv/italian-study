import { BookOpen, CalendarCheck, GraduationCap, ListChecks, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n/translate'
import { clsx } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { useSocial } from '../store/social-store'
import { LanguageMenu } from './LanguageSwitcher'
import { StreakBadge } from './StreakCard'
import { SubjectSwitcher } from './SubjectSwitcher'
import { SyncBadge } from './SyncBadge'
import { AvatarBadge } from './AvatarBadge'

function useNavItems() {
  const { t } = useI18n()
  return [
    { to: '/', label: t('nav.decks'), icon: BookOpen, end: true, badge: false },
    { to: '/review', label: t('nav.today'), icon: CalendarCheck, end: false, badge: true },
    { to: '/exercises', label: t('nav.exercises'), icon: ListChecks, end: false, badge: false },
    { to: '/exam', label: t('nav.exam'), icon: GraduationCap, end: true, badge: false },
    { to: '/account', label: t('nav.account'), icon: UserRound, end: false, badge: false },
  ]
}

export function SideNav() {
  const items = useNavItems()
  const { dueToday } = useAppStore()
  const { user } = useAuth()
  const { profile, incomingCount } = useSocial()

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-card px-3 py-6 lg:flex">
      <div className="px-3 pb-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
        <div className="mt-1">
          <SubjectSwitcher wide />
        </div>
      </div>
      <StreakBadge wide />
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-surface text-accent' : 'text-muted hover:bg-surface hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.to === '/review' && dueToday > 0 ? (
                    <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-5 text-accent-fg">
                      {dueToday > 99 ? '99+' : dueToday}
                    </span>
                  ) : null}
                  {item.to === '/account' && incomingCount > 0 ? (
                    <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-5 text-accent-fg">
                      {incomingCount > 99 ? '99+' : incomingCount}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
      <div className="mt-4 space-y-3 border-t border-line px-3 pt-4">
        <LanguageMenu up wide />
        <SyncBadge />
        {profile ? (
          <div className="flex items-center gap-2">
            <AvatarBadge avatar={profile.avatar} size="sm" />
            <p className="truncate text-xs text-muted">@{profile.username}</p>
          </div>
        ) : user?.email ? (
          <p className="truncate text-xs text-muted">{user.email}</p>
        ) : null}
      </div>
    </aside>
  )
}

export function BottomNav() {
  const items = useNavItems()
  const { dueToday } = useAppStore()
  const { incomingCount } = useSocial()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
      <ul className="mx-auto grid w-full max-w-lg grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to} className="min-w-0">
              <NavLink
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) =>
                  clsx(
                    'relative flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center text-xs font-medium leading-none transition',
                    isActive ? 'bg-surface text-accent' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                      {item.to === '/review' && dueToday > 0 ? (
                        <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-fg">
                          {dueToday > 99 ? '99+' : dueToday}
                        </span>
                      ) : null}
                      {item.to === '/account' && incomingCount > 0 ? (
                        <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-fg">
                          {incomingCount > 99 ? '99+' : incomingCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="w-full truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
