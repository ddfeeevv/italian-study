import { BookOpen, CalendarCheck, Plus, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { clsx } from '../lib/utils'
import { useAppStore } from '../store/app-store'

const ITEMS = [
  { to: '/', label: 'Колоды', icon: BookOpen, end: true },
  { to: '/review', label: 'Сегодня', icon: CalendarCheck, end: false, badge: true },
  { to: '/add', label: 'Добавить', icon: Plus, end: false },
  { to: '/account', label: 'Аккаунт', icon: UserRound, end: false },
] as const

export function BottomNav() {
  const { dueToday } = useAppStore()

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-line bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <ul className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'relative flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition',
                    isActive ? 'text-accent' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                      {'badge' in item && dueToday > 0 ? (
                        <span className="absolute -right-3 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-fg">
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
