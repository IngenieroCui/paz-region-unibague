import { Logout } from '../../features/auth/Logout'
import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconButton } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { roleLabels, rolePaths, roles } from '../../config/app'
import type { Role } from '../../config/app'
export function Topbar({ role, preview, onOpenMenu }: { role: Role; preview: boolean; onOpenMenu: () => void }) {
  return <header className="topbar"><div className="topbar-start"><IconButton label="Abrir navegación" className="mobile-menu-button" onClick={onOpenMenu}><Menu size={22} aria-hidden="true" /></IconButton>
    <span>Paz y Región <span className="breadcrumb-divider">/</span> <strong>{roleLabels[role]}</strong></span></div>
    {preview && <nav className="role-switch" aria-label="Cambiar vista de desarrollo">{roles.map(item =>
      <Link key={item} to={'/dev/' + rolePaths[item]} aria-current={item === role ? 'page' : undefined}>{roleLabels[item]}</Link>)}</nav>}
    {!preview && <div className="auth-actions"><Link to="/select-role">Cambiar espacio</Link><Logout /></div>}
    <Badge tone="info">{preview ? 'Preview' : 'Mi espacio'}</Badge></header>
}
