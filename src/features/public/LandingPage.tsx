import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Building2, GraduationCap, Landmark, MapPin } from 'lucide-react'
import { appConfig, roles, roleLabels, rolePaths } from '../../config/app'

const audiences = [
  { number: '01', title: 'Estudiantes', icon: GraduationCap, text: 'Un espacio para conectar tu formación con la experiencia en el territorio.' },
  { number: '02', title: 'Organizaciones', icon: Building2, text: 'Entidades públicas, privadas y comunitarias que participan en Paz y Región.' },
  { number: '03', title: 'Universidad', icon: Landmark, text: 'Un punto de encuentro para acompañar y articular el proceso del programa.' },
]
export default function LandingPage() {
  return <><section className="landing-hero">
    <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" />UNIVERSIDAD DE IBAGUÉ</p>
      <h1>El conocimiento<br />encuentra su<br /><em>territorio.</em></h1>
      <p className="hero-description">{appConfig.description} Un espacio de encuentro entre estudiantes, organizaciones y Universidad.</p>
      <div className="hero-actions"><Link className="button button--primary" to="/login">Ingresar a la plataforma <ArrowRight size={18} aria-hidden="true" /></Link>
        <a className="text-link" href="#comunidad">Conoce el espacio <ArrowDown size={17} aria-hidden="true" /></a></div>
      <p className="hero-footnote">Formación académica. Conexión regional. Propósito compartido.</p></div>
    <div className="territory-art" aria-hidden="true"><div className="art-caption"><MapPin size={16} /> UNA REGIÓN, MUCHAS CONEXIONES</div>
      <svg className="territory-lines" viewBox="0 0 520 530" fill="none">
        <path className="contour" d="M-30 340C80 60 180 80 310 150S550 300 550 50M-25 370C85 90 170 105 300 175S550 325 575 75M-20 400C90 120 160 130 290 200S550 350 600 100M-15 430C95 150 150 155 280 225S550 375 625 125M-10 460C100 180 140 180 270 250S550 400 650 150M-5 490C105 210 130 205 260 275S550 425 675 175M0 520C110 240 120 230 250 300S550 450 700 200" />
        <path className="connection" d="M140 176L368 242L232 389Z" />
        <circle className="art-orbit" cx="260" cy="276" r="155" />
        <circle className="art-orbit" cx="260" cy="276" r="193" />
        <circle className="art-dot" cx="140" cy="176" r="7" /><circle className="art-dot" cx="368" cy="242" r="7" /><circle className="art-dot" cx="232" cy="389" r="7" />
      </svg>
      <div className="art-label art-label--students"><GraduationCap size={24} /><span>Talento<span>Estudiantes</span></span></div>
      <div className="art-label art-label--organizations"><Building2 size={24} /><span>Territorio<span>Organizaciones</span></span></div>
      <div className="art-label art-label--university"><Landmark size={24} /><span>Conocimiento<span>Universidad</span></span></div>
      <div className="art-center">Paz y Región<small>CONSTRUIR DESDE EL ENCUENTRO</small></div>
      <div className="art-bottom"><span>VÍNCULOS QUE TRANSFORMAN</span><span>PyR / Unibagué</span></div></div>
  </section>
  <section className="community-section" id="comunidad"><div className="community-heading"><p className="eyebrow">UN PROPÓSITO COMPARTIDO</p>
    <h2>Tres miradas.<br />Un mismo espacio.</h2><p>Una base común para organizar y acompañar la participación en Paz y Región.</p></div>
    <div className="audience-grid">{audiences.map(({ title, number, text, icon: Icon }) =>
      <article className="audience-card" key={number}><div className="row"><span className="audience-number">{number}</span><Icon size={26} aria-hidden="true" /></div>
        <h3>{title}</h3><p>{text}</p><Link to="/login" className="text-link">Acceder al espacio <ArrowRight size={16} aria-hidden="true" /></Link></article>)}</div>
  </section>
  {appConfig.features.rolePreview && <aside className="dev-preview-index"><div><strong>Explora las experiencias</strong><p>Solo desarrollo · Ejemplos visuales, sin sesiones ni datos reales.</p></div>
    <nav aria-label="Vistas de desarrollo">{roles.map(role => <Link key={role} to={'/dev/' + rolePaths[role]}>{roleLabels[role]} <ArrowUpRightIcon /></Link>)}</nav></aside>}
  </>
}
function ArrowUpRightIcon() { return <ArrowRight size={15} aria-hidden="true" /> }
