import { Outlet } from 'react-router-dom'
import { SyncBadge } from './SyncBadge'
import { BottomNav, SideNav } from './BottomNav'
import { useAuth } from '../store/auth-store'

export function AppShell() {
  const { user } = useAuth()
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <SideNav />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg md:border-x md:border-line lg:mx-0 lg:max-w-none lg:min-w-0 lg:border-x-0">
        <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <SyncBadge />
        </div>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
