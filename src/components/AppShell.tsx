import { Outlet } from 'react-router-dom'
import { SyncBadge } from './SyncBadge'
import { BottomNav, SideNav } from './BottomNav'
import { LanguageMenu } from './LanguageSwitcher'
import { SubjectSwitcher } from './SubjectSwitcher'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <SideNav />
      <div className="flex min-h-dvh w-full min-w-0 flex-col bg-bg">
        <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 lg:hidden">
          <div className="min-w-0 flex-1">
            <SubjectSwitcher />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageMenu iconOnly />
            <SyncBadge compact />
          </div>
        </div>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
