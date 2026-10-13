import { useCallback } from 'react'
import { Button } from '../../components/ui/Button'
import { ErrorState } from '../../components/feedback/States'
import { Skeleton } from '../../components/ui/Progress'
import { useResource } from '../../components/forms/useResource'
import { completeInstitutionalSheet, unavailableInstitutionalReader, zoneLabel } from './services/institutional'
import type { InstitutionalPerson, InstitutionalReader, InstitutionalSheetData } from './services/institutional'
import { projectStateLabel } from './services/projects'
import { TeamMembersView } from '../groups'
import './institutional-sheet.css'

function People({ people }: { people: InstitutionalPerson[] }) {
  return people.length ? <ul>{people.map(person => <li key={person.id}>{person.displayName ?? 'Nombre no disponible'}</li>)}</ul> : <>Sin registrar</>
}
export function InstitutionalSheetView({ data }: { data: InstitutionalSheetData }) {
  const { project, positions, programs, people } = data
  const organization = project.PYRUnibague_Organizations
  return <section className="p6b-sheet card" aria-label="Ficha institucional del proyecto">
    <div className="p6b-sheet-heading"><div><p>PAZ Y REGIÓN · UNIVERSIDAD DE IBAGUÉ</p><h2>Ficha institucional del proyecto</h2></div>
      <Button variant="secondary" onClick={() => window.print()}>Imprimir ficha</Button></div>
    <p className="p6b-sheet-name"><strong>{project.name}</strong></p>
    <dl className="p6b-sheet-grid">
      <div><dt>Institución participante</dt><dd>{organization?.legal_name ?? 'Sin registrar'}</dd></div>
      <div><dt>Instituciones colaboradoras</dt><dd><People people={people.organizations ?? []}/></dd></div>
      <div><dt>Semestre</dt><dd>{project.PYRUnibague_AcademicPeriods?.code ?? 'Sin registrar'}</dd></div>
      <div><dt>Ubicación</dt><dd>{project.PYRUnibague_Municipalities ? `${project.PYRUnibague_Municipalities.municipality_name}, ${project.PYRUnibague_Municipalities.department_name}` : 'Sin registrar'}</dd></div>
      <div><dt>Zona</dt><dd>{zoneLabel(project.zone_type)}</dd></div>
      <div><dt>Estado del proyecto</dt><dd>{projectStateLabel(project.status)}</dd></div>
      <div><dt>Contacto institucional</dt><dd>{organization?.website ?? 'Sin registrar'}</dd></div>
      <div><dt>Interlocutor</dt><dd><People people={people.interlocutors}/></dd></div>
      <div><dt>Asesor regional</dt><dd><People people={people.advisors}/></dd></div>
    </dl>
    {people.availability === 'not_integrated' && <p>Asesor e interlocutor pendientes de integración institucional.</p>}
    <h3>Plazas</h3><p>Capacidad ofertada: {positions.reduce((sum, position) => sum + position.capacity, 0)}. Cada plaza aporta su capacidad una sola vez; sus programas son compatibles.</p>
    {positions.length ? <ul className="p6b-sheet-positions">{positions.map(position => <li key={position.id}>
      <strong>{position.title}</strong><p>{position.capacity} cupos · {position.status} · {position.is_active ? 'Activa' : 'Inactiva'}</p>
      <p>Programas compatibles: {programs.filter(link => link.project_position_id === position.id).map(link => link.PYRUnibague_AcademicPrograms?.name ?? 'Sin registrar').join(', ') || 'Sin registrar'}</p>
    </li>)}</ul> : <p>Sin plazas registradas.</p>}
    <h3>Equipos Paz y Región</h3>{data.team?.groups.length ? data.team.groups.map(group => <div key={group.id}><h4>{group.name} · {group.status === 'active' ? 'Activo' : 'Cerrado'}</h4><p>Inicio: {group.started_on ?? 'Sin registrar'}</p><TeamMembersView team={data.team!} groupId={group.id}/></div>) : <p>Sin equipos registrados.</p>}
    <h3>Historial operativo</h3><dl className="p6b-sheet-grid">
      <div><dt>Registro</dt><dd>{new Date(project.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</dd></div>
      <div><dt>Última actualización</dt><dd>{new Date(project.updated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</dd></div>
    </dl>
  </section>
}
export function InstitutionalSheet({ projectId, readPeople = unavailableInstitutionalReader }: { projectId: string; readPeople?: InstitutionalReader }) {
  const resource = useResource(useCallback(() => completeInstitutionalSheet(projectId, readPeople), [projectId, readPeople]))
  if (resource.loading && !resource.data) return <Skeleton label="Cargando ficha institucional"/>
  if (resource.error) return <ErrorState title={resource.error} onRetry={() => void resource.reload()}/>
  return resource.data ? <InstitutionalSheetView data={resource.data}/> : null
}
