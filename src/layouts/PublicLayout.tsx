import { Link, Outlet } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Brand } from '../components/layout/Brand'
import { Footer } from '../components/layout/Footer'
export function PublicLayout() {
  return <div className="public-layout"><a className="skip-link" href="#main">Saltar al contenido</a>
    <header className="public-header"><Brand /><nav aria-label="Navegación principal">
      <Link className="public-nav-link" to="/#comunidad">Nuestra comunidad</Link>
      <Link className="button button--primary" to="/login">Ingresar <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </nav></header><main id="main" tabIndex={-1}><Outlet /></main><Footer /></div>
}
