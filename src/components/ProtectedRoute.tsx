import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth-store'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        Загрузка…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
