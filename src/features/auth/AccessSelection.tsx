import { Link } from 'react-router-dom'
import { Building2, GraduationCap, ArrowRight } from 'lucide-react'
import { InstitutionalMark } from '../../components/layout/Brand'

export default function AccessSelection() {
  return <section className="access-selection">
    <InstitutionalMark /><p className="eyebrow">Paz y Región</p>
    <h1>Elige tu acceso</h1><p className="muted">Un mismo programa, un espacio para cada comunidad.</p>
    <div className="access-options">
      <Link className="access-option" to="/login/institucional"><GraduationCap size={32} aria-hidden="true" /><h2>Acceso universitario</h2><p>Estudiantes, asesores, coordinación y personal universitario autorizado.</p><span>Ingresar a la comunidad universitaria <ArrowRight size={18} aria-hidden="true" /></span></Link>
      <Link className="access-option" to="/login/organizaciones"><Building2 size={32} aria-hidden="true" /><h2>Acceso de organizaciones</h2><p>Empresas, entidades públicas, fundaciones, instituciones y aliados externos.</p><span>Ingresar como organización <ArrowRight size={18} aria-hidden="true" /></span></Link>
    </div><Link className="text-link" to="/">Volver al inicio</Link>
  </section>
}
