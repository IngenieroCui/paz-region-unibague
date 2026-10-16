import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { Editor } from '../../components/forms/Editor'
import { text } from '../../components/forms/form-data'
import { useResource } from '../../components/forms/useResource'
import { DataTable, PagedResults } from '../../components/forms/PagedData'
import { nullable } from '../../lib/supabase/feature-helpers'
import { addGroupMember, availableAssignments, bogotaToday, groupAccess, readProjectTeam, retireGroupMember, saveGroup } from './services/groups'
import type { Group, GroupMember, ProjectTeam } from './services/groups'

export function GroupsPage() {
  const { projectId = '' } = useParams(), { session,roles } = useAuth()
  const allowed = !!session && (roles.includes('ADMIN') || roles.includes('ORGANIZATION'))
  const admin = roles.includes('ADMIN'), user = session?.user.id ?? ''
  const access = useResource(useCallback(() => allowed && projectId ? groupAccess(projectId,user,admin) : Promise.resolve(null),[allowed,projectId,user,admin]))
  if (!allowed) return <Alert tone="error" title="No tienes permiso para consultar equipos."/>
  if (!projectId) return <Alert title="Selecciona un proyecto para ver sus equipos."/>
  if (access.error) return <ErrorState title={access.error} onRetry={() => void access.reload()}/>
  if (!access.data) return <Skeleton label="Cargando proyecto"/>
  return <div className="module-stack"><PageHeader title={'Equipos · '+access.data.project.name}/><GroupsPanel projectId={projectId} canManage={access.data.canManage}/></div>
}
export function GroupsPanel({ projectId,canManage,onChange }: { projectId: string; canManage: boolean; onChange?: () => void }) {
  const [confirmedPage,setConfirmedPage] = useState(0)
  const resource = useResource(useCallback(() => readProjectTeam(projectId),[projectId]))
  const reload = resource.reload
  const refresh = useCallback(async () => { await reload(); onChange?.() },[reload,onChange])
  if (resource.loading && !resource.data) return <Skeleton label="Cargando equipos e integrantes"/>
  if (resource.error) return <ErrorState title={resource.error} onRetry={() => void resource.reload()}/>
  if (!resource.data) return null
  const team = resource.data
  const confirmed = team.assignments.filter(a => a.is_active && a.status === 'confirmed' && a.unassigned_at === null)
  return <section aria-label="Equipos del proyecto" className="module-stack"><h2>Equipos e integrantes</h2>
    <p>Los integrantes provienen de asignaciones confirmadas. Retirar una persona conserva su historial.</p>
    <h3>Estudiantes confirmados en el proyecto</h3><PagedResults loading={false} error="" count={confirmed.length} page={Math.min(confirmedPage,Math.max(0,Math.ceil(confirmed.length/25)-1))} setPage={setConfirmedPage} reload={resource.reload}>
      <DataTable caption="Estudiantes confirmados" rows={confirmed.slice(Math.min(confirmedPage,Math.max(0,Math.ceil(confirmed.length/25)-1))*25,Math.min(confirmedPage,Math.max(0,Math.ceil(confirmed.length/25)-1))*25+25)} rowKey={row => row.id} columns={[
        { label:'Estudiante',cell:row => row.display_name ?? 'No registrado' },{ label:'Programa',cell:row => row.program_name ?? 'No registrado' },{ label:'Plaza',cell:row => row.position_title },
      ]}/>
    </PagedResults>
    {!team.groups.length && <EmptyState title="Sin equipos registrados">Crea un equipo para este proyecto y vincula asignaciones existentes.</EmptyState>}
    {team.groups.map(group => <Card key={group.id}><h3>{group.name}</h3><p>{group.status === 'active' ? 'Activo' : 'Cerrado'} · Inicio: {group.started_on ?? 'Sin registrar'}</p>
      {canManage && <details><summary>Editar equipo</summary><GroupForm key={group.updated_at} projectId={projectId} group={group} reload={refresh}/></details>}
      <h4>Integrantes vigentes</h4><TeamMembersView team={team} groupId={group.id} statusFilter="active"/>
      {team.members.some(member => member.group_id === group.id && member.status === 'inactive') && <section aria-label={'Historial de ' + group.name}><h4>Integrantes retirados</h4><TeamMembersView team={team} groupId={group.id} statusFilter="inactive"/></section>}
      {canManage && team.members.filter(member => member.group_id === group.id && member.status === 'active').map(member => <RetireMember key={member.id} member={member} team={team} reload={refresh}/>)}
      {canManage && group.status === 'active' && <MemberForm group={group} team={team} reload={refresh}/>}
    </Card>)}
    {canManage && <Card><h3>Crear equipo</h3><GroupForm projectId={projectId} reload={refresh}/></Card>}
  </section>
}
export function TeamMembersView({ team,groupId,statusFilter }: { team: ProjectTeam; groupId: string; statusFilter?: 'active' | 'inactive' }) {
  const members = team.members.filter(member => member.group_id === groupId && (!statusFilter || member.status === statusFilter))
  if (!members.length) return <p>Sin integrantes.</p>
  return <ul className="module-list">{members.map(member => {
    const assignment = team.assignments.find(assignment => assignment.id === member.assignment_id)
    return <li key={member.id}><span>{assignment?.display_name ?? 'Nombre no disponible'} · {assignment?.program_name ?? 'Programa sin registrar'}<br/>{assignment?.position_title ?? 'Plaza sin registrar'} · {member.status === 'active' ? 'Activo' : 'Retirado'} · Ingreso: {member.joined_on ?? 'Sin registrar'}{member.left_on ? ' · Salida: '+member.left_on : ''}</span></li>
  })}</ul>
}
function GroupForm({ projectId,group,reload }: { projectId: string; group?: Group; reload: () => Promise<void> }) {
  return <Editor label={group ? 'Guardar equipo' : 'Crear equipo'} resetOnSave={!group} onSave={async form => {
    const status = text(form,'status'); if (status !== 'active' && status !== 'closed') return
    await saveGroup(group?.id ?? null,projectId,{ name:text(form,'name'),status,started_on:nullable(text(form,'started_on')) }); await reload()
  }}><Input label="Nombre del equipo" name="name" required maxLength={240} defaultValue={group?.name ?? ''}/><Select label="Estado del equipo" name="status" defaultValue={group?.status ?? 'active'}><option value="active">Activo</option><option value="closed">Cerrado</option></Select><Input label="Fecha de inicio" name="started_on" type="date" defaultValue={group?.started_on ?? ''}/></Editor>
}
function MemberForm({ group,team,reload }: { group: Group; team: ProjectTeam; reload: () => Promise<void> }) {
  const available = availableAssignments(team)
  if (!available.length) return <p>No hay asignaciones confirmadas disponibles para incorporar.</p>
  return <Editor label="Vincular integrante" resetOnSave onSave={async form => { const assignment = available.find(assignment => assignment.id === text(form,'assignment')); if (!assignment) return; await addGroupMember(group,assignment,nullable(text(form,'joined_on'))); await reload() }}><Select label="Asignación confirmada" name="assignment" required><option value="">Selecciona integrante</option>{available.map(assignment => <option key={assignment.id} value={assignment.id}>{assignment.display_name ?? 'Nombre no disponible'} · {assignment.program_name ?? 'Programa sin registrar'} · {assignment.position_title}</option>)}</Select><Input label="Fecha de ingreso" name="joined_on" type="date"/></Editor>
}
function RetireMember({ member,team,reload }: { member: GroupMember; team: ProjectTeam; reload: () => Promise<void> }) {
  const [open,setOpen] = useState(false)
  const name = team.assignments.find(assignment => assignment.id === member.assignment_id)?.display_name ?? 'integrante'
  return <><Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Cancelar retiro de ' : 'Retirar a '}{name}</Button>{open && <Editor label="Confirmar retiro" onSave={async form => { await retireGroupMember(member,text(form,'left_on')); await reload(); setOpen(false) }}><Input label={'Fecha de salida de '+name} name="left_on" type="date" required min={member.joined_on ?? undefined} defaultValue={bogotaToday()}/></Editor>}</>
}
