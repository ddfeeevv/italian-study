import { Outlet } from 'react-router-dom'
import { SyncBadge } from './SyncBadge'
import { BottomNav } from './BottomNav'
import { Screen } from './ui'
import { useAuth } from '../store/auth-store'

export function AppShell() {
  const { user } = useAuth()
  return (
    <Screen>
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="truncate text-xs text-muted">{user?.email}</p>
        <SyncBadge />
      </div>
      <Outlet />
      <BottomNav />
    </Screen>
  )
}
