import { ArrowRight, Building2, FileCheck2, FolderOpen, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionHeader } from '../../components/layout/Headers'
import { MetricCard, QuickActionCard } from '../../components/layout/DashboardCards'
import { Alert, EmptyState } from '../../components/feedback/States'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { organizationDemo } from '../preview/demo-data'
export default function OrganizationPreview() {
  return <><PageHeader eyebrow="VÍNCULOS CON EL TERRITORIO" title="El espacio de tu organización."
    description="Un punto de encuentro para participar en Paz y Región." action={<Badge tone="warning">Por validar · Ejemplo</Badge>} />
    <Alert tone="warning" title="Validación institucional pendiente · Ejemplo">La propuesta visual contempla capacidades restringidas hasta la revisión. Las condiciones se definirán con Unibagué.</Alert>
    <div className="metrics-grid metrics-grid--three"><MetricCard title="Proyectos de ejemplo" value={organizationDemo.projects} note="Borradores ilustrativos" icon={FolderOpen} />
      <MetricCard title="Cupos de ejemplo" value={organizationDemo.requests} note="Sin solicitudes reales" icon={Users} />
      <MetricCard title="Pendientes de ejemplo" value={organizationDemo.pending} note="Revisión institucional" icon={FileCheck2} /></div>
    <div className="dashboard-grid"><Card><SectionHeader title="Tu organización" action={<Building2 size={22} aria-hidden="true" />} />
      <div className="organization-summary"><span className="avatar avatar--large" aria-hidden="true">O</span><div><h3>Organización de ejemplo</h3><p className="muted">Entidad participante · Perfil ilustrativo</p></div></div>
      <p className="muted">Este espacio incluirá el perfil de entidades públicas, privadas o comunitarias. El tipo y los campos se definirán más adelante.</p>
      <Link className="text-link" to="profile">Explorar el perfil <ArrowRight size={16} aria-hidden="true" /></Link>
    </Card><Card><SectionHeader title="Proyectos" action={<Button disabled>Crear proyecto</Button>} />
      <EmptyState title="Los proyectos tendrán su propio espacio">Aquí podrás conocer el estado de tus propuestas cuando se habilite esta función.</EmptyState>
      <p className="field-hint">Creación no disponible en esta fase.</p></Card></div>
    <SectionHeader title="Prepara tu participación" /><div className="action-grid">
      <QuickActionCard title="Perfil de la organización" description="Un lugar para presentar a tu entidad" to="profile" icon={Building2} />
      <QuickActionCard title="Proyectos y solicitudes" description="Explora el espacio de futuras propuestas" to="projects" icon={FolderOpen} /></div>
  </>
}
