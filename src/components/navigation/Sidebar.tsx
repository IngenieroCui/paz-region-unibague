import { useAuth } from '../../features/auth/auth-context'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Brand, Identity } from '../layout/Brand'
import { navigation, productionNavigation } from '../../config/navigation'
import { roleLabels } from '../../config/app'
import type { Role } from '../../config/app'
export function Sidebar({ role, basePath, onNavigate, preview = false }: { role: Role; basePath: string; onNavigate?: () => void; preview?: boolean }) {
  const auth = useAuth()
  const location = useLocation()
  const orgSearch = !preview && role === 'ORGANIZATION' ? location.search : ''
  return <div className="sidebar-content"><Brand /><div className="sidebar-context"><span className="eyebrow">ESPACIO DE TRABAJO</span><strong>{roleLabels[role]}</strong></div>
    <nav aria-label="Navegación del espacio">{(preview ? navigation : productionNavigation)[role].map(item => <NavLink key={item.path} end to={basePath + (item.path ? '/' + item.path : '') + orgSearch}
      onClick={onNavigate} className={({ isActive }) => 'sidebar-link' + (isActive ? ' is-active' : '')}>
      <item.icon size={19} aria-hidden="true" />{item.label}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">PAZ Y REGIÓN</span><p>Un espacio para construir juntos.</p><Link to="/" onClick={onNavigate}>Conoce el programa <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <Identity name={preview ? "Vista de desarrollo" : auth.session?.user.email ?? "Cuenta autorizada"} detail={preview ? "Sin sesión de usuario" : roleLabels[role]} /><Link className="sidebar-back" to="/" onClick={onNavigate}><ArrowLeft size={16} aria-hidden="true" />Volver al inicio</Link></div>
  </div>
}
