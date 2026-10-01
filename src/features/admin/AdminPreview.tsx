import { useState } from 'react'
import { Building2, FolderOpen, Layers, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionHeader } from '../../components/layout/Headers'
import { MetricCard, QuickActionCard } from '../../components/layout/DashboardCards'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { SearchInput, Select } from '../../components/ui/Fields'
import { EmptyState } from '../../components/feedback/States'
import { adminDemo } from '../preview/demo-data'
export default function AdminPreview() {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const rows = adminDemo.queue.filter(row => (!kind || row.kind === kind) && row.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
  return <><PageHeader eyebrow="COORDINACIÓN DEL PROGRAMA" title="Una mirada al proceso."
    description="Información clara para acompañar cada participación." action={<Badge tone="info">Periodo de ejemplo</Badge>} />
    <div className="period-strip"><div><span className="eyebrow">PERIODO ACADÉMICO</span><strong>Sin periodo institucional configurado</strong></div>
      <span>Las cifras siguientes son exclusivamente ilustrativas.</span></div>
    <div className="metrics-grid"><MetricCard title="Estudiantes" value={adminDemo.metrics.students} note="Dato de ejemplo" icon={Users} />
      <MetricCard title="Organizaciones" value={adminDemo.metrics.organizations} note="Dato de ejemplo" icon={Building2} />
      <MetricCard title="Proyectos" value={adminDemo.metrics.projects} note="Dato de ejemplo" icon={FolderOpen} />
      <MetricCard title="Plazas" value={adminDemo.metrics.positions} note="Dato de ejemplo" icon={Layers} /></div>
    <Card><SectionHeader title="Bandeja de atención" description="Filtra esta lista de ejemplo para explorar la interacción." action={<Badge tone="warning">3 ejemplos</Badge>} />
      <div className="table-toolbar"><SearchInput label="Buscar en los ejemplos" placeholder="Nombre de organización o proyecto" value={query} onChange={event => setQuery(event.target.value)} />
        <Select label="Tipo de elemento" value={kind} onChange={event => setKind(event.target.value)}><option value="">Todos los tipos</option><option>Organización</option><option>Proyecto</option></Select></div>
      <div className="table-region" tabIndex={0} role="region" aria-label="Bandeja de atención de ejemplo"><table><caption className="sr-only">Elementos de ejemplo pendientes de atención</caption>
        <thead><tr><th scope="col">Elemento</th><th scope="col">Tipo</th><th scope="col">Estado de ejemplo</th><th scope="col">Acceso</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.kind}</td><td><Badge tone={row.tone}>{row.state}</Badge></td>
          <td><Link className="text-link" to={row.kind === 'Proyecto' ? 'projects' : 'organizations'} aria-label={'Explorar ' + row.name}>Explorar</Link></td></tr>)}</tbody></table></div>
      {rows.length === 0 && <EmptyState title="No hay coincidencias">Prueba otro nombre o cambia el tipo de elemento.</EmptyState>}
      <p className="table-note" role="status">{rows.length} de {adminDemo.queue.length} elementos de ejemplo</p>
    </Card><SectionHeader title="Accesos de coordinación" /><div className="action-grid">
      <QuickActionCard title="Estudiantes y organizaciones" description="Espacio de consulta y revisión" to="students" icon={Users} />
      <QuickActionCard title="Proyectos y plazas" description="Una vista común de la participación" to="projects" icon={FolderOpen} />
    </div>
  </>
}
