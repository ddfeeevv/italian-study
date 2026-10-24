import { BookOpen, CalendarCheck, GraduationCap, ListChecks, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { clsx } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import { useAuth } from '../store/auth-store'
import { SyncBadge } from './SyncBadge'

const ITEMS = [
  { to: '/', label: 'Колоды', icon: BookOpen, end: true },
  { to: '/review', label: 'Сегодня', icon: CalendarCheck, end: false, badge: true },
  { to: '/exercises', label: 'Упражнения', icon: ListChecks, end: false },
  { to: '/exam', label: 'Экзамен', icon: GraduationCap, end: true },
  { to: '/account', label: 'Аккаунт', icon: UserRound, end: false },
] as const

export function SideNav() {
  const { dueToday } = useAppStore()
  const { user } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-card px-3 py-6 lg:flex">
      <div className="px-3 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Parola</p>
        <p className="mt-1 font-display text-xl leading-tight">Итальянский</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {ITEMS.map((item) => {
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
                  {'badge' in item && dueToday > 0 ? (
                    <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-5 text-accent-fg">
                      {dueToday > 99 ? '99+' : dueToday}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
      <div className="mt-4 space-y-3 border-t border-line px-3 pt-4">
        <SyncBadge />
        {user?.email ? <p className="truncate text-xs text-muted">{user.email}</p> : null}
      </div>
    </aside>
  )
}

export function BottomNav() {
  const { dueToday } = useAppStore()

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-line bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'relative flex flex-col items-center gap-1 rounded-2xl px-0.5 py-1.5 text-center text-[10px] font-medium leading-tight transition sm:text-[11px]',
                    isActive ? 'text-accent' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                      {'badge' in item && dueToday > 0 ? (
                        <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-fg">
                          {dueToday > 99 ? '99+' : dueToday}
                        </span>
                      ) : null}
                    </span>
                    {item.label}
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
