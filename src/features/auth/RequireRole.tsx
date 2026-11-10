import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../../config/app'
import { LoadingState, ErrorState } from '../../components/feedback/States'
import { useAuth } from './auth-context'
export function RequireRole({ role }: { role: Role }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <LoadingState />
  if (auth.status === 'error') return <ErrorState title="No pudimos verificar tu sesión" onRetry={() => window.location.reload()} />
  if (!auth.session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Only roles loaded from the persisted-role RPC authorize this workspace.
  if (!auth.roles.includes(role)) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}
