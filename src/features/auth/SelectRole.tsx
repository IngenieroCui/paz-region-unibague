import { Link, Navigate } from 'react-router-dom'
import { LoadingState, ErrorState } from '../../components/feedback/States'
import { roleLabels, rolePaths } from '../../config/app'
import { useAuth } from './auth-context'
import { workspaceForRoles } from './services/auth'
export default function SelectRole() {
  const auth = useAuth()
  if (auth.status === 'loading') return <LoadingState />
  if (auth.status === 'error') return <ErrorState title="No pudimos verificar tus permisos" />
  if (!auth.session) return <Navigate to="/login" replace />
  if (auth.roles.length < 2) return <Navigate to={workspaceForRoles(auth.roles)} replace />
  return <section className="status-page"><h1>Elige tu espacio</h1><p>Tu cuenta tiene acceso a varios espacios.</p>
    <nav aria-label="Espacios autorizados">{auth.roles.map(role => <Link className="button button--secondary" key={role} to={'/app/' + rolePaths[role]}>{roleLabels[role]}</Link>)}</nav>
  </section>
}
