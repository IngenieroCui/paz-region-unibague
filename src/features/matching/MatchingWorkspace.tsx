import { useCallback, useState } from 'react'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Fields'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { ConfirmDialog } from '../../components/forms/Editor'
import { loadMatchingMetadata, loadRuns, executeMatching, jsonObject, PAGE_SIZE } from './services'
import type { RunRow } from './services'
import { useMatchingResource } from './useMatchingResource'
import { ConfigurationEditor } from './ConfigurationEditor'
import { MatchingResults } from './MatchingResults'
import './matching.css'
function runStateLabel(status: string) {
  const labels: Record<string, string> = { running: 'En curso', completed: 'Completada', failed: 'Fallida', pending: 'Pendiente' }
  return labels[status] ?? status
}
export function MatchingWorkspace() {
  const metadata = useMatchingResource(loadMatchingMetadata)
  const [periodOverride, setPeriod] = useState<string | null>(null)
  const [configurationId, setConfiguration] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')
  const [runPage, setRunPage] = useState(0)
  const [selectedId, setSelected] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [editorRevision, setEditorRevision] = useState(0)
  const period = periodOverride ?? metadata.data?.periods.find(p => p.is_current)?.id ?? metadata.data?.periods[0]?.id ?? ''
  const runLoader = useCallback(() => loadRuns(period, runPage), [period, runPage])
  const runs = useMatchingResource(runLoader, Boolean(period))
  // Do not display an unrelated historical run while the requested run is loading.
  const selected = selectedId ? runs.data?.rows.find(r => r.id === selectedId) ?? null : runs.data?.rows[0] ?? null
  const configOptions = metadata.data?.configurations.filter(c => c.is_active && (!c.academic_period_id || c.academic_period_id === period)) ?? []
  const config = configOptions.find(c => c.id === configurationId)
  const blockedByRunning = runs.data?.rows.some(r => r.matching_configuration_id === config?.id && r.status === 'running') ?? false
  if (metadata.loading) return <p role="status">Cargando matching…</p>
  if (metadata.error) return <ErrorState title={metadata.error} onRetry={metadata.reload} />
  const data = metadata.data
  if (!data) return null
  return <div className="module-stack matching-workspace"><PageHeader eyebrow="Administración" title="Matching" description="Compatibilidad calculada entre estudiantes y plazas. Las recomendaciones requieren una decisión de asignación posterior." />
    <nav className="module-actions" aria-label="Secciones de matching">{[['overview', 'Resumen'], ['configurations', 'Configuraciones'], ['run', 'Ejecutar'], ['results', 'Resultados']].map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'secondary'} aria-pressed={tab === key} onClick={() => { setTab(key!); if (key === 'overview') setRunPage(0) }}>{label}</Button>)}</nav>
    <Select label="Periodo académico" value={period} onChange={e => { setPeriod(e.target.value); setRunPage(0); setSelected(''); setConfiguration('') }}><option value="">Selecciona un periodo</option>{data.periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
    {!data.periods.length && <EmptyState title="Sin periodos académicos">Coordinación debe configurar un periodo real.</EmptyState>}
    {runs.loading && <p role="status">Cargando historial…</p>}{runs.error && <ErrorState title={runs.error} onRetry={runs.reload} />}
    {tab === 'overview' && <><div className="dashboard-grid"><Card><h2>Configuraciones</h2><p>{configOptions.length} activas para este periodo.</p><Button variant="secondary" onClick={() => setTab('configurations')}>Gestionar configuraciones</Button></Card><Card><h2>Última ejecución</h2>{runs.data?.rows[0] ? <RunSummary run={runs.data.rows[0]} /> : <EmptyState title="Sin ejecuciones">Selecciona una configuración para calcular compatibilidad.</EmptyState>}</Card></div></>}
    {tab === 'configurations' && <Card><h2>Configuraciones del motor</h2><Select label="Configuración a editar" value={editing ?? ''} onChange={e => { setEditing(e.target.value || null); setEditorRevision(v => v + 1) }}><option value="">Crear nueva configuración</option>{data.configurations.map(c => <option key={c.id} value={c.id}>{c.name} · {c.is_active ? 'activa' : 'inactiva'}</option>)}</Select>
      <ConfigurationEditor key={`${editing ?? 'new'}-${editorRevision}`} selected={data.configurations.find(c => c.id === editing) ?? null} periods={data.periods} onSaved={() => { metadata.reload(); setEditing(null); setEditorRevision(v => v + 1) }} />
    </Card>}
    {tab === 'run' && <Card><h2>Ejecutar matching</h2><Select label="Configuración para ejecutar" value={configurationId} onChange={e => setConfiguration(e.target.value)}><option value="">Selecciona una configuración activa</option>{configOptions.map(c => <option key={c.id} value={c.id}>{c.name} · {c.algorithm_version}</option>)}</Select>
      {config && <p>Umbral configurado: {config.minimum_recommended_score ?? 'sin configurar'} / 100. Semántica: {jsonObject(config.rules).semanticEnabled === true ? 'solicitada; depende del proveedor' : 'desactivada'}.</p>}
      <Alert title="Recomendaciones sin asignación">Se evaluará todo el pool elegible del periodo. Los bloqueos y scores quedarán registrados en una nueva ejecución histórica.</Alert>
      <Button disabled={!period || !config || blockedByRunning || runs.loading} onClick={() => setConfirmation(true)}>Revisar y ejecutar</Button>{blockedByRunning && <p role="status">Esta configuración tiene una ejecución en curso.</p>}
      <ConfirmDialog open={confirmation} title="Confirmar ejecución de matching" confirmLabel="Ejecutar compatibilidad" onCancel={() => { setConfirmation(false); runs.reload() }} onConfirm={async () => {
        if (!config) return
        try { const id = await executeMatching(period, config.id); setRunPage(0); setSelected(id); setTab('results') }
        finally { runs.reload() }
      }}>Periodo: {data.periods.find(p => p.id === period)?.name}. Configuración: {config?.name}. Esta operación calcula candidatos y conserva una nueva ejecución; no crea asignaciones.</ConfirmDialog>
    </Card>}
    {(tab === 'results' || tab === 'overview' || tab === 'run') && period && <Card><h2>Historial de ejecuciones</h2><Button variant="secondary" onClick={runs.reload}>Actualizar historial</Button>
      {runs.data && <><ul className="module-list">{runs.data.rows.map(r => <li key={r.id}><div><p>{new Date(r.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {runStateLabel(r.status)}</p><p>{data.configurations.find(c => c.id === r.matching_configuration_id)?.name ?? r.matching_configuration_id}</p></div><Button variant="secondary" aria-pressed={selected?.id === r.id} onClick={() => { setSelected(r.id); setTab('results') }}>Ver ejecución</Button></li>)}</ul>
      <div className="module-actions"><Button variant="secondary" disabled={!runPage} onClick={() => { setRunPage(runPage - 1); setSelected('') }}>Historial anterior</Button><Button variant="secondary" disabled={(runPage + 1) * PAGE_SIZE >= runs.data.count} onClick={() => { setRunPage(runPage + 1); setSelected('') }}>Historial siguiente</Button></div></>}
    </Card>}
    {tab === 'results' && !runs.loading && !runs.error && (selected ? <><Card><RunSummary run={selected} /></Card><MatchingResults key={selected.id} run={selected} /></> : <EmptyState title={selectedId ? 'Ejecución no encontrada en esta página' : 'Sin ejecución seleccionada'}>{selectedId ? 'Actualiza el historial o selecciona otra ejecución.' : 'Ejecuta matching o selecciona un resultado del historial.'}</EmptyState>)}
  </div>
}
function RunSummary({ run }: { run: RunRow }) {
  const summary = jsonObject(run.summary)
  const warningLabels: Record<string, string> = { SEMANTIC_DISABLED: 'Análisis semántico desactivado', SEMANTIC_SETTINGS_MISSING: 'Proveedor semántico pendiente de configurar', SEMANTIC_TEXTS_EMPTY: 'Sin textos para análisis semántico', SEMANTIC_TEXT_TOO_LONG: 'Texto demasiado largo para análisis semántico', SEMANTIC_PROVIDER_FAILED: 'Proveedor semántico no disponible; se usaron datos estructurados' }
  return <><h3>{String(summary.algorithm_version ?? 'Versión no registrada')} · {runStateLabel(run.status)}</h3><dl className="matching-metrics">{[['student_count', 'Estudiantes'], ['position_count', 'Plazas'], ['pair_count', 'Parejas'], ['eligible_pairs', 'Sin bloqueos'], ['blocked_pairs', 'Bloqueadas'], ['recommended_pairs', 'Recomendadas'], ['below_threshold_pairs', 'Debajo del umbral']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{String(summary[key!] ?? '—')}</dd></div>)}</dl><p>Modo semántico: {summary.semantic_mode === 'structured_only' ? 'Solo datos estructurados' : summary.semantic_mode === 'embeddings' ? 'Vectores semánticos' : String(summary.semantic_mode ?? 'no registrado')}</p>
    {Array.isArray(summary.warnings) && summary.warnings.length > 0 && <p>Avisos: {summary.warnings.map(value => warningLabels[String(value)] ?? String(value)).join(', ')}</p>}{summary.error && <Alert tone="error" title={`Error técnico: ${String(summary.error)}`} />}</>
}
export default MatchingWorkspace
