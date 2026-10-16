import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/layout/Headers'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Fields'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { ConfirmDialog } from '../../components/forms/Editor'
import { DataTable } from '../../components/forms/PagedData'
import { useResource } from '../../components/forms/useResource'
import { errorMessage, FeatureError } from '../../lib/supabase/feature-helpers'
import { AssignmentEventHistory, AssignmentReadList } from './AssignmentReadList'
import { commitAssignments, loadAssignmentMetadata, loadAssignmentSnapshot } from './services'
import { REASONS } from './types'
import type { AssignmentAction, AssignmentSnapshot, Proposal, ProposalRow } from './types'
import './assignments.css'

export function AssignmentsWorkspace() {
  const metadata = useResource(loadAssignmentMetadata)
  const [periodSelection, setPeriod] = useState(() => new URLSearchParams(window.location.search).get('period') ?? ''); const [runId, setRun] = useState(''); const [tab, setTab] = useState('overview')
  const period = periodSelection || metadata.data?.periods.find(p => p.is_current)?.id || metadata.data?.periods[0]?.id || ''
  if (metadata.loading) return <p role="status">Cargando asignaciones…</p>
  if (metadata.error) return <ErrorState title={metadata.error} onRetry={() => void metadata.reload()} />
  const runs = metadata.data?.runs.filter(r => r.academic_period_id === period) ?? []
  return <div className="module-stack assignments-workspace">
    <PageHeader eyebrow="Administración" title="Asignaciones" description="Optimización global, revisión y decisiones definitivas por periodo." />
    <Alert title="Compatibilidad IA ≠ asignación confirmada">El optimizador prepara un borrador. Solo la confirmación administrativa ocupa cupos.</Alert>
    <nav aria-label="Secciones de asignaciones" className="module-actions">{[['overview', 'Resumen'], ['optimize', 'Optimizar y revisar'], ['manual', 'Intervención manual'], ['history', 'Historial']].map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'secondary'} aria-pressed={tab === key} onClick={() => setTab(key!)}>{label}</Button>)}</nav>
    <div className="assignment-filters"><Select label="Periodo académico" value={period} onChange={e => { setPeriod(e.target.value); setRun('') }}>{metadata.data?.periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <Select label="Ejecución completada" value={runId} onChange={e => setRun(e.target.value)}><option value="">Sin ejecución · intervención manual</option>{runs.map(r => <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {r.id}</option>)}</Select></div>
    <Button variant="secondary" onClick={() => void metadata.reload()}>Actualizar ejecuciones</Button>
    {period ? <PeriodWorkspace key={`${period}/${runId}`} periodId={period} runId={runId} tab={tab} periodLabel={metadata.data?.periods.find(p => p.id === period)?.name ?? period} /> : <EmptyState title="Sin periodos académicos">Configura un periodo real antes de asignar.</EmptyState>}
  </div>
}

function PeriodWorkspace({ periodId, runId, tab, periodLabel }: { periodId: string; runId: string; tab: string; periodLabel: string }) {
  const loader = useCallback(() => loadAssignmentSnapshot(periodId, runId || null), [periodId, runId]); const resource = useResource(loader)
  const [draft, setDraft] = useState<{ snapshot: AssignmentSnapshot; proposal: Proposal } | null>(null)
  const [excluded, setExcluded] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [stale, setStale] = useState(false)
  const [confirmation, setConfirmation] = useState<{ snapshot: AssignmentSnapshot; actions: AssignmentAction[]; description: string } | null>(null)
  const [filter, setFilter] = useState(''); const [projectFilter, setProjectFilter] = useState(''); const [page, setPage] = useState(0)
  const [manualStudent, setManualStudent] = useState(''); const [manualPosition, setManualPosition] = useState(''); const [reason, setReason] = useState(''); const [justification, setJustification] = useState(''); const [exceptionConfirmed, setExceptionConfirmed] = useState(false)
  const [historyStudent, setHistoryStudent] = useState(''); const [historyProject, setHistoryProject] = useState(''); const [eventId, setEventId] = useState(''); const [historyVersion, setHistoryVersion] = useState(0)
  const [success, setSuccess] = useState('')
  const worker = useRef<Worker | null>(null)
  useEffect(() => () => { worker.current?.terminate() }, [])
  const snapshot = resource.data
  const students = new Map(snapshot?.students.map(s => [s.id, s]) ?? []); const positions = new Map(snapshot?.positions.map(p => [p.id, p]) ?? [])
  const projects = [...new Map(snapshot?.positions.map(p => [p.projectId, p.projectName]) ?? [])]
  const name = (id: string) => students.get(id)?.label ?? id
  const destination = (id: string) => { const p = positions.get(id); return p ? `${p.organizationName} / ${p.projectName} / ${p.label}` : id }
  const existing = snapshot?.existing.filter(a => a.active) ?? []
  const occupied = (id: string) => existing.filter(a => a.positionId === id).length
  function cancelDraft() { worker.current?.terminate(); worker.current = null; setBusy(false); setDraft(null); setConfirmation(null) }
  async function refresh() { cancelDraft(); setStale(false); setError(''); await resource.reload(); setHistoryVersion(v => v + 1) }
  function optimize(exclusions = excluded) {
    if (!snapshot || stale) return
    worker.current?.terminate(); setBusy(true); setError(''); setDraft(null); setPage(0)
    const current = new Worker(new URL('../optimizer/optimizer.worker.ts', import.meta.url), { type: 'module' }); worker.current = current
    current.onmessage = (event: MessageEvent<{ proposal?: Proposal; error?: string }>) => {
      if (current !== worker.current) return
      if (event.data.proposal) setDraft({ snapshot, proposal: event.data.proposal }); else setError(event.data.error ?? 'No se pudo calcular.')
      setBusy(false); current.terminate(); worker.current = null
    }
    current.onerror = () => { if (worker.current === current) { setError('No se pudo ejecutar el optimizador. Reintenta.'); setBusy(false); worker.current = null }; current.terminate() }
    current.postMessage({ snapshot, excluded: exclusions })
  }
  function propose(rows: ProposalRow[]) {
    if (!draft || stale) return
    setConfirmation({ snapshot: draft.snapshot, actions: rows.map(r => ({ kind: 'confirm', student_id: r.studentId, position_id: r.positionId, candidate_id: r.candidateId, source: 'MATCHING' })), description: `${rows.length === 1 ? `${name(rows[0]!.studentId)} → ${destination(rows[0]!.positionId)}. ` : ''}${rows.length} decisiones definitivas del run ${runId}. Compatibilidad total: ${rows.reduce((n, r) => n + r.score, 0).toFixed(2)}. El lote se confirma completo o se rechaza completo.` })
  }
  const manualCandidate = snapshot?.candidates.find(c => c.studentId === manualStudent && c.positionId === manualPosition)
  const threshold = snapshot?.run?.threshold
  const unscored = !manualCandidate
  const below = manualCandidate?.score !== null && manualCandidate?.score !== undefined && threshold !== null && threshold !== undefined && manualCandidate.score < threshold
  const blocked = Boolean(manualCandidate && (!manualCandidate.eligible || manualCandidate.currentEligible !== true || !Array.isArray(manualCandidate.blockers) || manualCandidate.blockers.length || manualCandidate.score === null || threshold === null))
  const activeStudentAssignment = existing.find(a => a.studentId === manualStudent)
  function manual(kind: 'confirm' | 'reassign' | 'unassign') {
    if (!snapshot || stale || !manualStudent || !reason || !justification.trim()) return
    const action: AssignmentAction = { kind, student_id: manualStudent, assignment_id: activeStudentAssignment?.id, source: 'MANUAL', reason_code: reason, reason_text: justification.trim() }
    if (kind !== 'unassign') Object.assign(action, { position_id: manualPosition, candidate_id: manualCandidate?.id ?? null, allow_below_threshold: below && exceptionConfirmed, allow_unscored: unscored && exceptionConfirmed })
    setConfirmation({ snapshot, actions: [action], description: `${kind === 'unassign' ? 'Retirar' : kind === 'reassign' ? 'Reasignar' : 'Asignar'} a ${name(manualStudent)}${kind === 'unassign' ? '' : ` en ${destination(manualPosition)}`}. Motivo: ${REASONS.find(r => r[0] === reason)?.[1]}. ${justification.trim()}${below ? ' Compatibilidad debajo del umbral, confirmada expresamente.' : unscored && kind !== 'unassign' ? ' Sin compatibilidad histórica verificable, confirmado expresamente.' : ''}` })
  }
  if (resource.loading) return <p role="status">Cargando cupos y elegibilidad…</p>
  if (resource.error) return <ErrorState title={resource.error} onRetry={() => void refresh()} />
  if (!snapshot) return null
  const proposed = (draft?.proposal.rows ?? []).filter(r => (!projectFilter || positions.get(r.positionId)?.projectId === projectFilter) && `${name(r.studentId)} ${destination(r.positionId)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    .sort((a, b) => destination(a.positionId).localeCompare(destination(b.positionId)) || a.studentId.localeCompare(b.studentId))
  const manualDestination = positions.get(manualPosition)
  const manualValid = Boolean(students.get(manualStudent)?.active && students.get(manualStudent)?.eligible && manualDestination && manualDestination.active && manualDestination.approved && manualDestination.validated && occupied(manualPosition) < manualDestination.capacity && !blocked && (!(below || unscored) || exceptionConfirmed) && manualPosition !== activeStudentAssignment?.positionId)
  return <div className="module-stack">
    <div className="module-actions"><Button variant="secondary" disabled={busy} onClick={() => void refresh()}>Actualizar cupos y descartar borrador</Button>{stale && <Alert tone="error" title="Propuesta desactualizada">Actualiza los datos y recalcula antes de confirmar.</Alert>}</div>
    {error && <Alert tone="error" title={error} />}
    {success && <Alert tone="success" title={success}><a href="/app/admin/advisors">Revisar asesor individual</a> · <a href="/app/admin/groups">Vincular equipo del proyecto</a></Alert>}
    <p>Regla conservadora provisional: proyecto aprobado y organización aprobada con verificación. Requiere validación institucional; no constituye normativa oficial.</p>
    <p>Los vínculos con asesores y equipos están pendientes de integración. La decisión confirma estudiante y plaza.</p>
    {tab === 'overview' && <Card><h2>Resumen · {periodLabel}</h2><dl className="assignment-metrics">{[
      ['Estudiantes elegibles', snapshot.students.filter(s => s.active && s.eligible).length], ['Plazas habilitadas', snapshot.positions.filter(p => p.active && p.approved && p.validated).length],
      ['Cupos habilitados', snapshot.positions.filter(p => p.active && p.approved && p.validated).reduce((n, p) => n + p.capacity, 0)], ['Confirmados', existing.length],
      ['Propuestos', draft?.proposal.rows.length ?? 0], ['Sin asignación', snapshot.students.filter(s => s.active && s.eligible && !existing.some(a => a.studentId === s.id) && !draft?.proposal.rows.some(a => a.studentId === s.id)).length],
      ['Capacidad disponible', snapshot.positions.filter(p => p.active && p.approved && p.validated).reduce((n, p) => n + Math.max(0, p.capacity - occupied(p.id)), 0)],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Card>}
    {tab === 'optimize' && <><Card><h2>Propuesta global</h2><p>Ejecución: {snapshot.run?.id ?? 'sin seleccionar'}. Configuración: {snapshot.run?.configurationId ?? '—'}. Umbral histórico: {threshold ?? 'no disponible'}.</p>
      <details><summary>Configuración histórica utilizada</summary><pre className="assignment-snapshot">{JSON.stringify(snapshot.run?.snapshot ?? null, null, 2)}</pre></details>
      <Button disabled={!runId || stale || threshold === null || threshold === undefined} loading={busy} onClick={() => optimize()}>Calcular propuesta</Button>
      {excluded.length > 0 && <Button variant="secondary" disabled={busy || stale} onClick={() => { setExcluded([]); optimize([]) }}>Restablecer exclusiones y recalcular</Button>}
      {!runId && <EmptyState title="Selecciona un matching completado">No se usan candidatos de ejecuciones parciales o fallidas.</EmptyState>}
      {draft && <><p role="status">{draft.proposal.rows.length} propuestas · compatibilidad total {draft.proposal.totalScore.toFixed(2)} · {draft.proposal.unassigned.length} sin asignación. Borrador sin persistir.</p>
        <div className="assignment-filters"><Input label="Buscar propuesta" value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} /><Select label="Filtrar proyecto" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(0) }}><option value="">Todos los proyectos</option>{projects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></div>
        <DataTable caption="Propuestas agrupadas por organización y proyecto" rows={proposed.slice(page * 25, page * 25 + 25)} rowKey={r => r.candidateId} columns={[
          { label: 'Organización / proyecto / plaza', cell: r => destination(r.positionId) }, { label: 'Estudiante', cell: r => name(r.studentId) }, { label: 'Compatibilidad', cell: r => `${r.score.toFixed(2)} / 100` },
          { label: 'Revisión', cell: r => <div className="module-actions"><Button disabled={stale} onClick={() => propose([r])}>Confirmar {name(r.studentId)}</Button><Button variant="secondary" onClick={() => { const next = [...excluded, r.candidateId]; setExcluded(next); optimize(next) }}>Excluir</Button><Button variant="secondary" onClick={() => { setManualStudent(r.studentId); setManualPosition(r.positionId); setExceptionConfirmed(false); document.getElementById('assignment-manual')?.scrollIntoView({ behavior: 'smooth' }) }}>Cambiar destino</Button></div> },
        ]} />
        <Pagination page={page} setPage={setPage} count={proposed.length} />
        <Button disabled={!draft.proposal.rows.length || draft.proposal.rows.length > 500 || stale} onClick={() => propose(draft.proposal.rows)}>Revisar y confirmar lote ({draft.proposal.rows.length})</Button>
        {draft.proposal.rows.length > 500 && <p>Confirma individualmente y recalcula: máximo 500 decisiones por transacción.</p>}
        <UnassignedList rows={draft.proposal.unassigned} name={name} />
      </>}
    </Card><CapacityList snapshot={snapshot} proposal={draft?.proposal ?? null} /></>}
    {(tab === 'manual' || tab === 'optimize') && <Card><section id="assignment-manual" aria-label="Intervención manual"><h2>Intervención manual</h2><p>Los motivos son códigos internos provisionales. Elegibilidad, periodo, capacidad y bloqueos actuales se validan en servidor.</p>
      <div className="assignment-filters"><Select label="Estudiante a intervenir" value={manualStudent} onChange={e => { setManualStudent(e.target.value); setExceptionConfirmed(false) }}><option value="">Selecciona estudiante</option>{snapshot.students.map(s => <option key={s.id} value={s.id}>{s.label}{existing.some(a => a.studentId === s.id) ? ' · asignado' : ''}{!s.active || !s.eligible ? ' · no elegible' : ''}</option>)}</Select>
        <Select label="Destino manual" value={manualPosition} onChange={e => { setManualPosition(e.target.value); setExceptionConfirmed(false) }}><option value="">Selecciona plaza</option>{snapshot.positions.map(p => <option key={p.id} value={p.id}>{destination(p.id)} · {p.capacity - occupied(p.id)} cupos</option>)}</Select></div>
      {activeStudentAssignment && <p>Asignación vigente: {destination(activeStudentAssignment.positionId)}. Reasignar conserva el historial anterior.</p>}
      {manualDestination && <p>Cupos confirmados: {occupied(manualPosition)} / {manualDestination.capacity}. Compatibilidad: {manualCandidate?.score ?? 'sin evaluación'} / 100. Umbral histórico: {threshold ?? 'no disponible'}.</p>}
      {blocked && <Alert tone="error" title="Compatibilidad bloqueada o snapshot inválido">No se puede confirmar esta pareja. Una excepción institucional requiere validación fuera de este módulo.</Alert>}
      {below && <Checkbox label="Confirmo expresamente la asignación debajo del umbral histórico" checked={exceptionConfirmed} onChange={e => setExceptionConfirmed(e.target.checked)} />}
      {unscored && manualStudent && manualPosition && <Checkbox label="Confirmo asignación manual sin compatibilidad histórica verificable" checked={exceptionConfirmed} onChange={e => setExceptionConfirmed(e.target.checked)} />}
      <Select label="Motivo de intervención" value={reason} onChange={e => setReason(e.target.value)}><option value="">Selecciona motivo</option>{REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select>
      <Textarea label="Justificación" value={justification} maxLength={2000} onChange={e => setJustification(e.target.value)} />
      <div className="module-actions"><Button disabled={!manualValid || !reason || !justification.trim() || stale} onClick={() => manual(activeStudentAssignment ? 'reassign' : 'confirm')}>{activeStudentAssignment ? 'Revisar reasignación' : 'Revisar asignación manual'}</Button>
        <Button variant="secondary" disabled={!activeStudentAssignment || !reason || !justification.trim() || stale} onClick={() => manual('unassign')}>Revisar retiro</Button></div>
    </section></Card>}
    {tab === 'history' && <Card><h2>Historial por estudiante y proyecto</h2><div className="assignment-filters"><Select label="Historial del estudiante" value={historyStudent} onChange={e => { setHistoryStudent(e.target.value); setEventId('') }}><option value="">Todos los estudiantes</option>{snapshot.students.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select><Select label="Historial del proyecto" value={historyProject} onChange={e => { setHistoryProject(e.target.value); setEventId('') }}><option value="">Todos los proyectos</option>{projects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></div>
      <AssignmentReadList key={`${historyStudent}/${historyProject}/${historyVersion}`} periodId={periodId} studentId={historyStudent || undefined} positionIds={historyProject ? snapshot.positions.filter(p => p.projectId === historyProject).map(p => p.id) : undefined} studentLabel={name} positionLabel={destination} onInspect={row => setEventId(row.id)} />
      {eventId && <AssignmentEventHistory key={eventId} assignmentId={eventId} />}
    </Card>}
    <ConfirmDialog open={Boolean(confirmation)} title="Confirmar decisión administrativa" confirmLabel="Confirmar decisión" onCancel={() => setConfirmation(null)} onConfirm={async () => {
      if (!confirmation || stale) throw new FeatureError('Actualiza y recalcula antes de confirmar.')
      try {
        const response = await commitAssignments(confirmation.snapshot, confirmation.actions)
        const missing = Array.isArray(response) && response.some(row => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) return false
          const integrations = row.integrations
          return integrations && typeof integrations === 'object' && !Array.isArray(integrations) && integrations.advisor === 'missing_advisor'
        })
        await refresh(); setSuccess('Decisión confirmada. Cupos e historial actualizados.' + (missing ? ' Falta vincular asesor individual; resuélvelo en Asesores y responsabilidades.' : '')); setExceptionConfirmed(false); setJustification(''); setReason('')
      }
      catch (cause) { if (cause instanceof FeatureError && ['P0001', '23514', '23505', 'UNCERTAIN_COMMIT'].includes(cause.code)) setStale(true); setError(errorMessage(cause)); throw cause }
    }}>{confirmation?.description}</ConfirmDialog>
  </div>
}

function Pagination({ page, setPage, count }: { page: number; setPage: (page: number) => void; count: number }) {
  return <div className="module-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span role="status">{count} registros · página {page + 1} de {Math.max(1, Math.ceil(count / 25))}</span><Button variant="secondary" disabled={(page + 1) * 25 >= count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
}
function UnassignedList({ rows, name }: { rows: Proposal['unassigned']; name: (id: string) => string }) {
  const [page, setPage] = useState(0)
  return <section><h3>Sin asignación</h3><DataTable caption="Estudiantes sin asignación y motivos" rows={rows.slice(page * 25, page * 25 + 25)} rowKey={r => r.studentId} columns={[{ label: 'Estudiante', cell: r => name(r.studentId) }, { label: 'Motivos', cell: r => r.reasons.join('; ') }]} /><Pagination page={Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1))} setPage={setPage} count={rows.length} /></section>
}
function CapacityList({ snapshot, proposal }: { snapshot: AssignmentSnapshot; proposal: Proposal | null }) {
  const [page, setPage] = useState(0)
  return <Card><h2>Ocupación por plaza</h2><DataTable caption="Cupos confirmados y propuestos" rows={snapshot.positions.slice(page * 25, page * 25 + 25)} rowKey={p => p.id} columns={[
    { label: 'Organización / proyecto / plaza', cell: p => `${p.organizationName} / ${p.projectName} / ${p.label}` }, { label: 'Capacidad', cell: p => p.capacity },
    { label: 'Confirmados', cell: p => snapshot.existing.filter(a => a.active && a.positionId === p.id).length }, { label: 'Propuestos', cell: p => proposal?.rows.filter(r => r.positionId === p.id).length ?? 0 },
    { label: 'Disponibles tras propuesta', cell: p => proposal?.available[p.id] ?? Math.max(0, p.capacity - snapshot.existing.filter(a => a.active && a.positionId === p.id).length) },
    { label: 'Habilitación', cell: p => p.active && p.approved && p.validated ? 'Habilitada' : 'Pendiente de validación' },
  ]} /><Pagination page={page} setPage={setPage} count={snapshot.positions.length} /></Card>
}
export default AssignmentsWorkspace
