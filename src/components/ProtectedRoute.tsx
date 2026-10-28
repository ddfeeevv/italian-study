import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { OnboardingGate } from './Onboarding'
import { useI18n } from '../i18n/translate'
import { useAuth } from '../store/auth-store'

export function ProtectedRoute() {
  const { t } = useI18n()
  const location = useLocation()
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        {t('common.loading')}
      </div>
    )
  }
  if (!session) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" replace state={{ from }} />
  }
  return (
    <>
      <Outlet />
      <OnboardingGate />
    </>
  )
}
