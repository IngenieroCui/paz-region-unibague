import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useResource } from '../../components/forms/useResource'
import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Progress'
import { ErrorState } from '../../components/feedback/States'
import { allPages, check, client, FeatureError } from '../../lib/supabase/feature-helpers'
import type { Json } from '../../lib/supabase/database.types'
import { Select } from '../../components/ui/Fields'
import { PageHeader } from '../../components/layout/Headers'

async function assignmentPeriods() {
  const db = await client()
  return allPages((from, to) => db.from('PYRUnibague_AcademicPeriods').select('*').order('created_at', { ascending: false }).order('id').range(from, to))
}
export function StudentAssignmentPage() {
  const periods = useResource(assignmentPeriods), [params, setParams] = useSearchParams()
  const requested = params.get('period')
  const period = periods.data?.find(row => row.id === requested)?.id ?? periods.data?.find(row => row.is_current)?.id ?? periods.data?.[0]?.id ?? ''
  return <div className="module-stack"><PageHeader title="Mi asignación" description="Consulta tu destino y equipo por periodo académico." />
    {periods.error ? <ErrorState title={periods.error} onRetry={() => void periods.reload()} /> : periods.loading ? <Skeleton label="Cargando periodos" /> : period ? <Select label="Periodo de mi asignación" value={period} onChange={event => setParams({ period: event.target.value })}>{periods.data?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select> : <p>La Universidad aún no ha configurado periodos académicos.</p>}
    {period && <StudentAssignment key={period} periodId={period} />}
  </div>
}

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
  return { status: label(row.status ?? 'confirmed'), municipality: label(row.municipality ?? null), organization: label(row.organization), project: label(row.project), position: label(row.position), advisor: label(row.advisor), group: label(row.group),
    teammates: row.teammates.map(value => { const person = object(value); return { id: label(person.id), name: label(person.name), program: label(person.program ?? null) } }) }
}
export function StudentAssignment({ periodId }: { periodId: string }) {
  const resource = useResource(useCallback(() => readStudentAssignment(periodId), [periodId]))
  return <Card><h2>Mi asignación confirmada</h2>{resource.loading ? <Skeleton label="Cargando asignación"/> : resource.error ? <ErrorState title={resource.error} onRetry={() => void resource.reload()}/> : resource.data ? <>
    <dl><dt>Estado</dt><dd>{resource.data.status === 'confirmed' ? 'Confirmada' : resource.data.status}</dd><dt>Municipio</dt><dd>{resource.data.municipality}</dd><dt>Organización</dt><dd>{resource.data.organization}</dd><dt>Proyecto</dt><dd>{resource.data.project}</dd><dt>Plaza / perfil</dt><dd>{resource.data.position}</dd><dt>Asesor individual</dt><dd>{resource.data.advisor}</dd><dt>Equipo</dt><dd>{resource.data.group}</dd></dl>
    <h3>Compañeros de equipo</h3>{resource.data.teammates.length ? <ul>{resource.data.teammates.map(person => <li key={person.id}>{person.name} · {person.program}</li>)}</ul> : <p>Sin compañeros vinculados.</p>}
  </> : <p>Aún no tienes una asignación confirmada en este periodo.</p>}</Card>
}
