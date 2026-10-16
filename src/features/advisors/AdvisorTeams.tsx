import { useCallback, useState } from 'react'
import { useResource } from '../../components/forms/useResource'
import { ErrorState } from '../../components/feedback/States'
import { Skeleton } from '../../components/ui/Progress'
import { check, client } from '../../lib/supabase/feature-helpers'
import { parseProjectTeam } from '../groups/services/groups'

async function advisorTeam(project: string) {
  const db = await client(), result = await db.rpc('pyr_unibague_advisor_project_team', { p_project_id: project })
  check(result.error); return parseProjectTeam(result.data)
}
export function AdvisorTeams({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Consultar equipos del proyecto</summary>{open && <Teams projectId={projectId} />}</details>
}
function Teams({ projectId }: { projectId: string }) {
  const resource = useResource(useCallback(() => advisorTeam(projectId), [projectId]))
  if (resource.error) return <ErrorState title={resource.error} onRetry={() => void resource.reload()} />
  if (resource.loading || !resource.data) return <Skeleton label="Cargando equipos de asesoría" />
  const team = resource.data
  return <><p>Se muestran únicamente estudiantes bajo tu responsabilidad individual vigente.</p>
    {team.groups.length ? team.groups.map(group => <section key={group.id} aria-label={'Equipo ' + group.name}><h3>{group.name} · {group.status === 'active' ? 'Activo' : 'Cerrado'}</h3>
      <ul>{team.members.filter(member => member.group_id === group.id).map(member => {
        const student = team.assignments.find(row => row.id === member.assignment_id)
        return student && <li key={member.id}>{student.display_name ?? 'Sin nombre'} · {student.program_name ?? 'Programa sin registrar'}</li>
      })}</ul>
    </section>) : <p>Sin equipos registrados.</p>}
    <h3>Estudiantes confirmados bajo mi asesoría</h3>{team.assignments.length ? <ul>{team.assignments.map(student => <li key={student.id}>{student.display_name ?? 'Sin nombre'} · {student.program_name ?? 'Programa sin registrar'} · {student.position_title}</li>)}</ul> : <p>Sin estudiantes confirmados bajo tu asesoría en este proyecto.</p>}
  </>
}
