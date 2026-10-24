import { Navigate, Outlet } from 'react-router-dom'
import { useI18n } from '../i18n/translate'
import { useAuth } from '../store/auth-store'

export function ProtectedRoute() {
  const { t } = useI18n()
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        {t('common.loading')}
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
