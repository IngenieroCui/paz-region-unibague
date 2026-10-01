import { ArrowRight, Check, Circle, FileText, GraduationCap, ListChecks, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionHeader } from '../../components/layout/Headers'
import { QuickActionCard } from '../../components/layout/DashboardCards'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Progress } from '../../components/ui/Progress'
import { EmptyState } from '../../components/feedback/States'
import { studentDemo } from '../preview/demo-data'
export default function StudentPreview() {
  return <><PageHeader eyebrow="TU ESPACIO EN PAZ Y REGIÓN" title="Hola, estudiante."
    description="Cada paso te acerca a tu experiencia en el territorio." action={<Badge tone="info">Perfil de ejemplo</Badge>} />
    <div className="dashboard-grid"><Card className="profile-card"><div className="row"><span className="icon-tile"><GraduationCap size={24} aria-hidden="true" /></span><Badge tone="warning">En preparación</Badge></div>
      <h2>Tu historia es el punto de partida</h2><p className="muted">Este ejemplo muestra cómo podrás organizar tu perfil antes de iniciar el proceso.</p>
      <Progress value={studentDemo.completion} label="Perfil de ejemplo" /><Link className="button button--primary" to="profile">Explorar mi perfil <ArrowRight size={17} aria-hidden="true" /></Link>
    </Card><Card><SectionHeader title="Tus próximos pasos" description="Secuencia ilustrativa; pendiente de validación." />
      <ol className="step-list">{studentDemo.steps.map((step, index) => <li key={step.title}><span className={step.completed ? 'step-icon completed' : 'step-icon'}>
        {step.completed ? <Check size={17} aria-hidden="true" /> : <span>{index + 1}</span>}</span><div><h3>{step.title}</h3><p>{step.description}</p><small>{step.completed ? 'Completado · Ejemplo' : 'Pendiente · Ejemplo'}</small></div></li>)}</ol></Card></div>
    <div className="dashboard-grid"><Card><SectionHeader title="Tu proceso" action={<Badge>Sin iniciar · Ejemplo</Badge>} />
      <div className="process-summary"><Circle size={20} aria-hidden="true" /><div><h3>Un camino por construir</h3><p className="muted">Aquí podrás consultar el avance del proceso cuando esté habilitado.</p></div></div>
      <EmptyState title="Todavía no hay una asignación">En esta vista no existe una asignación real. Los proyectos y los siguientes pasos aparecerán cuando el proceso esté disponible.</EmptyState>
    </Card><section><SectionHeader title="A tu alcance" /><div className="quick-actions">
      <QuickActionCard title="Mi perfil" description="Formación e intereses" to="profile" icon={UserRound} />
      <QuickActionCard title="Mi proceso" description="Un lugar para cada paso" to="process" icon={ListChecks} />
      <QuickActionCard title="Mis documentos" description="Un espacio para tus entregables" to="documents" icon={FileText} />
    </div><p className="workspace-note">Avanza a tu ritmo. Los requisitos se definirán con la Universidad.</p></section></div>
  </>
}
