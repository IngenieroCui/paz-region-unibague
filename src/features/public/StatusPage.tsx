import { useAuth } from '../auth/auth-context'
import { Logout } from '../auth/Logout'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Signpost } from 'lucide-react'
export default function StatusPage({ unauthorized = false }: { unauthorized?: boolean }) {
  const auth = useAuth()
  const Icon = unauthorized ? ShieldCheck : Signpost
  return <section className="status-page"><Icon size={42} aria-hidden="true" /><p className="eyebrow">{unauthorized ? 'ACCESO RESTRINGIDO' : 'ERROR 404'}</p>
    <h1>{unauthorized ? 'Este espacio requiere autorización' : 'No encontramos esta página'}</h1>
    <p>{unauthorized ? auth.session && !auth.roles.length ? 'Tu acceso a Paz y Región todavía no ha sido habilitado' : 'Tu cuenta necesita un rol autorizado para acceder a este espacio.' : 'La dirección puede haber cambiado. Puedes regresar al inicio para continuar.'}</p>
    {unauthorized && auth.session && !auth.roles.length && <Link className="text-link" to="/registro/organizacion">Si solicitaste una cuenta externa, retoma el registro de tu organización</Link>}
    <Link className="button button--primary" to={unauthorized ? '/login' : '/'}><ArrowLeft size={18} aria-hidden="true" />{unauthorized ? 'Ir al acceso' : 'Volver al inicio'}</Link>{unauthorized && auth.session && <Logout />}</section>
}
