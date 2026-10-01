import { Link } from 'react-router-dom'
import { appConfig } from '../../config/app'
export function Brand() {
  return <Link className="brand" to="/" aria-label={appConfig.name + ' · Inicio'}>
    <span className="brand-monogram" aria-hidden="true">p<span>r</span></span>
    <span><strong>{appConfig.name}</strong><small>{appConfig.institution}</small></span></Link>
}
export function Identity({ name, detail }: { name: string; detail: string }) {
  return <div className="identity"><span className="avatar" aria-hidden="true">{name.slice(0, 1)}</span>
    <span><strong>{name}</strong><small>{detail}</small></span></div>
}
