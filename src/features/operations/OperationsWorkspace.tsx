import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useResource } from '../../components/forms/useResource'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Fields'
import { Skeleton } from '../../components/ui/Progress'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { errorMessage } from '../../lib/supabase/feature-helpers'
import { downloadCsv } from './csv'
import { operationalExport, operationalPeriods, operationalSummary } from './services'
import type { ExportKind, OperationalSummary } from './services'

export function OperationsWorkspace() {
  const periods = useResource(operationalPeriods), [params, setParams] = useSearchParams()
  const requested = params.get('period')
  const period = periods.data?.find(row => row.id === requested)?.id ?? periods.data?.find(row => row.is_current)?.id ?? periods.data?.[0]?.id ?? ''
  return <div className="module-stack"><PageHeader title="Pendientes de coordinación" description="Operación y exportaciones del periodo seleccionado." />
    {periods.error ? <ErrorState title={periods.error} onRetry={() => void periods.reload()} /> : periods.loading ? <Skeleton label="Cargando periodos" /> : <Select label="Periodo operativo" value={period} onChange={event => setParams({ period: event.target.value })}>{periods.data?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>}
    {!periods.loading && !periods.error && !period && <EmptyState title="Configura un periodo académico"><Link to="/app/admin/settings?catalog=AcademicPeriods">Configurar periodos</Link></EmptyState>}
    {period && <PeriodOperations key={period} period={period} />}
  </div>
}
function PeriodOperations({ period }: { period: string }) {
  const resource = useResource(useCallback(() => operationalSummary(period), [period]))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const metrics: [keyof OperationalSummary, string, string][] = [
    ['pendingOrganizations', 'Organizaciones pendientes', '/app/admin/organizations?status=pending'],
    ['pendingProjects', 'Proyectos pendientes', `/app/admin/projects?status=submitted&period=${period}`],
    ['unassignedEligible', 'Elegibles sin asignación', `/app/admin/assignments?period=${period}`],
    ['vacantPositions', 'Plazas con cupos disponibles', `/app/admin/projects?period=${period}`],
    ['organizationsWithoutAdvisor', 'Organizaciones sin asesor vigente', '/app/admin/advisors'],
    ['assignmentsWithoutAdvisor', 'Asignados sin asesor individual vigente', '/app/admin/advisors'],
    ['assignmentsRequiringReview', 'Asignaciones para revisión', `/app/admin/assignments?period=${period}`],
  ]
  async function exportRows(kind: ExportKind) {
    setBusy(true); setError(''); setMessage('')
    try { const rows = await operationalExport(period, kind); if (active.current) { downloadCsv(kind, period, rows); setMessage(`CSV generado: ${rows.length} registro(s).`) } }
    catch (cause) { if (active.current) setError(errorMessage(cause)) }
    finally { if (active.current) setBusy(false) }
  }
  return <>
    <Button variant="secondary" onClick={() => void resource.reload()}>Actualizar pendientes</Button>
    {resource.error ? <ErrorState title={resource.error} onRetry={() => void resource.reload()} /> : resource.loading || !resource.data ? <Skeleton label="Cargando pendientes" /> : <>
      <p>Las organizaciones pendientes abarcan todo el registro. Los demás indicadores corresponden al periodo seleccionado. Revisión incluye intervenciones manuales y asignaciones cuya elegibilidad o destino cambió.</p>
      <div className="p4-metrics">{metrics.map(([key, label, path]) => <Card key={key}><h2>{label}</h2><strong>{resource.data![key]}</strong><p><Link to={path}>Abrir módulo · {label.toLowerCase()}</Link></p></Card>)}</div>
      <p>Cupos disponibles en plazas activas de proyectos y organizaciones aprobados: {resource.data.vacantCapacity}.</p>
    </>}
    <Card><h2>Exportación operativa CSV</h2><p>Incluye historial de asignaciones y ocupación confirmada. Asesor y grupo reflejan vínculos vigentes. Actualiza la exportación después de cambios concurrentes.</p>
      <div className="module-actions"><Button disabled={busy} onClick={() => void exportRows('assignments')}>Exportar asignaciones</Button><Button variant="secondary" disabled={busy} onClick={() => void exportRows('positions')}>Exportar plazas y ocupación</Button></div>
      {busy && <p role="status">Preparando CSV…</p>}{error && <Alert tone="error" title={error} />}{message && <p role="status">{message}</p>}
    </Card>
  </>
}
