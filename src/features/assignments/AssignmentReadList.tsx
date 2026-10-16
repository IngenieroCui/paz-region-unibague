import { useCallback, useState } from 'react'
import { useResource } from '../../components/forms/useResource'
import { DataTable, PagedResults } from '../../components/forms/PagedData'
import { loadAssignmentHistory, loadAssignmentEvents } from './services'
import type { HistoryFilters } from './services'
import type { AssignmentRow } from './types'

/** Read-only integration surface for Student/Organization. Database RLS is authoritative. */
export function AssignmentReadList({ periodId, studentId, positionIds, activeOnly = false, studentLabel = id => id, positionLabel = id => id, onInspect }: HistoryFilters & { periodId: string; studentLabel?: (id: string) => string; positionLabel?: (id: string) => string; onInspect?: (row: AssignmentRow) => void }) {
  const [page, setPage] = useState(0)
  // Primitive key avoids refetches when callers construct a new ids array on each render.
  const positionKey = positionIds?.join(',')
  const loader = useCallback(() => loadAssignmentHistory(periodId, page, { studentId, positionIds: positionKey === undefined ? undefined : positionKey ? positionKey.split(',') : [], activeOnly }), [periodId, page, studentId, positionKey, activeOnly])
  const history = useResource(loader)
  return <PagedResults loading={history.loading} error={history.error} count={history.data?.count ?? 0} page={page} setPage={setPage} reload={history.reload}>
    <DataTable caption="Historial de asignaciones" rows={history.data?.rows ?? []} rowKey={row => row.id} columns={[
      { label: 'Estudiante', cell: row => studentLabel(row.student_id) }, { label: 'Plaza', cell: row => positionLabel(row.project_position_id) },
      { label: 'Estado', cell: row => row.is_active ? 'Confirmada' : 'Retirada' }, { label: 'Origen', cell: row => row.source },
      { label: 'Asignada', cell: row => new Date(row.assigned_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) },
      { label: 'Retirada', cell: row => row.unassigned_at ? new Date(row.unassigned_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '—' },
      ...(onInspect ? [{ label: 'Auditoría', cell: (row: AssignmentRow) => <button type="button" className="button button--secondary" onClick={() => onInspect(row)}>Ver eventos</button> }] : []),
    ]} />
  </PagedResults>
}
export function AssignmentEventHistory({ assignmentId }: { assignmentId: string }) {
  const [page, setPage] = useState(0)
  const loader = useCallback(() => loadAssignmentEvents(assignmentId, page), [assignmentId, page]); const events = useResource(loader)
  return <section aria-label="Eventos administrativos"><h3>Eventos administrativos</h3><PagedResults loading={events.loading} error={events.error} count={events.data?.count ?? 0} page={page} setPage={setPage} reload={events.reload}>
    <DataTable caption="Auditoría de la asignación" rows={events.data?.rows ?? []} rowKey={row => row.id} columns={[
      { label: 'Evento', cell: row => row.event_type }, { label: 'Actor', cell: row => row.actor_user_id ?? 'Identidad retirada' },
      { label: 'Motivo', cell: row => row.reason_code ?? 'Confirmación de propuesta' }, { label: 'Justificación', cell: row => row.reason_text ?? '—' },
      { label: 'Fecha', cell: row => new Date(row.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) },
    ]} />
  </PagedResults></section>
}
