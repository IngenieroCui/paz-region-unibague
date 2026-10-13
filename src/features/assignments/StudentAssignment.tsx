import { useCallback } from 'react'
import { useResource } from '../../components/forms/useResource'
import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Progress'
import { ErrorState } from '../../components/feedback/States'
import { check, client, FeatureError } from '../../lib/supabase/feature-helpers'
import type { Json } from '../../lib/supabase/database.types'

function object(value: Json): { [key: string]: Json | undefined } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FeatureError('Respuesta de asignación incompleta.')
  return value
}
function label(value: Json | undefined) {
  if (value === null) return 'Sin asignar'
  if (typeof value !== 'string') throw new FeatureError('Respuesta de asignación incompleta.')
  return value
}
async function readStudentAssignment(period: string) {
  const db = await client(), response = await db.rpc('pyr_unibague_student_assignment', { p_period_id: period })
  check(response.error)
  if (response.data === null) return null
  const row = object(response.data)
  if (!Array.isArray(row.teammates)) throw new FeatureError('Respuesta de equipo incompleta.')
  return { organization: label(row.organization), project: label(row.project), position: label(row.position), advisor: label(row.advisor), group: label(row.group),
    teammates: row.teammates.map(value => { const person = object(value); return { id: label(person.id), name: label(person.name) } }) }
}
export function StudentAssignment({ periodId }: { periodId: string }) {
  const resource = useResource(useCallback(() => readStudentAssignment(periodId), [periodId]))
  return <Card><h2>Mi asignación confirmada</h2>{resource.loading ? <Skeleton label="Cargando asignación"/> : resource.error ? <ErrorState title={resource.error} onRetry={() => void resource.reload()}/> : resource.data ? <>
    <dl><dt>Organización</dt><dd>{resource.data.organization}</dd><dt>Proyecto</dt><dd>{resource.data.project}</dd><dt>Plaza / perfil</dt><dd>{resource.data.position}</dd><dt>Asesor individual</dt><dd>{resource.data.advisor}</dd><dt>Equipo</dt><dd>{resource.data.group}</dd></dl>
    <h3>Compañeros de equipo</h3>{resource.data.teammates.length ? <ul>{resource.data.teammates.map(person => <li key={person.id}>{person.name}</li>)}</ul> : <p>Sin compañeros vinculados.</p>}
  </> : <p>Aún no tienes una asignación confirmada en este periodo.</p>}</Card>
}
