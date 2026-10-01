import { useCallback, useEffect, useRef, useState } from 'react'
import { Select } from '../../components/ui/Fields'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert, EmptyState, ErrorState } from '../../components/feedback/States'
import { candidateComponents, jsonEntries, jsonObject, loadCandidates, loadMatchingFilters, PAGE_SIZE, runThreshold } from './services'
import type { CandidateRow, CandidateFilters, RunRow } from './services'
import { useMatchingResource } from './useMatchingResource'
export function MatchingResults({ run }: { run: RunRow }) {
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<CandidateFilters>({ student: '', position: '', state: 'all' })
  const [detail, setDetail] = useState<CandidateRow | null>(null)
  const options = useMatchingResource(loadMatchingFilters)
  const loader = useCallback(() => loadCandidates(run, page, filters), [run, page, filters])
  const results = useMatchingResource(loader, run.status === 'completed')
  const threshold = runThreshold(run)
  const change = (next: CandidateFilters) => { setPage(0); setFilters(next); setDetail(null) }
  const students = new Map(options.data?.students.map(s => [s.id, s.label]))
  const positions = new Map(options.data?.positions.map(p => [p.id, p.label]))
  if (run.status !== 'completed') return <Alert title={run.status === 'failed' ? 'Ejecución fallida' : 'Ejecución en curso'}>Los candidatos parciales no se presentan como ranking válido. Actualiza el historial para consultar el estado.</Alert>
  return <Card><h2>Resultados · ranking de compatibilidad</h2><p>Umbral histórico: {threshold ?? 'no disponible'}. El ranking recomienda candidatos; cada plaza conserva su capacidad para la decisión de P6.</p>
    {options.error && <ErrorState title={options.error} onRetry={options.reload} />}
    <div className="form-grid"><Select label="Filtrar estudiante" value={filters.student} onChange={e => change({ ...filters, student: e.target.value })}><option value="">Todos los estudiantes</option>{options.data?.students.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
    <Select label="Filtrar proyecto / plaza" value={filters.position} onChange={e => change({ ...filters, position: e.target.value })}><option value="">Todas las plazas</option>{options.data?.positions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
    <Select label="Filtrar compatibilidad" value={filters.state} onChange={e => change({ ...filters, state: e.target.value as CandidateFilters['state'] })}><option value="all">Todas las parejas</option><option value="eligible">Sin bloqueos</option><option value="blocked">Con bloqueos</option><option value="recommended">Recomendadas</option><option value="below">Debajo del umbral</option></Select></div>
    {results.loading && <p role="status">Cargando ranking…</p>}
    {results.error && <ErrorState title={results.error} onRetry={results.reload} />}
    {results.data && <><p role="status">{results.data.count} parejas · página {page + 1}</p>
      {!results.data.rows.length ? <EmptyState title="Sin candidatos para estos filtros">Revisa los filtros y el pool elegible del periodo.</EmptyState> : <ol className="matching-ranking" start={page * PAGE_SIZE + 1}>{results.data.rows.map(row => <li key={row.id}>
        <h3>{students.get(row.student_id) ?? row.student_id}</h3><p>{positions.get(row.project_position_id) ?? row.project_position_id}</p>
        <p><strong>{row.total_score === null ? 'Sin score final' : `${row.total_score.toFixed(1)} / 100`}</strong> · {!row.is_eligible ? 'Bloqueada' : threshold !== null && row.total_score !== null && row.total_score >= threshold ? 'Recomendada' : 'Debajo del umbral'}</p>
        {!row.is_eligible && <p>Bloqueos: {jsonEntries(row.blockers).map(b => b.code).join(', ')}</p>}
        <Button variant="secondary" onClick={() => setDetail(row)}>Ver detalle</Button>
      </li>)}</ol>}
      <div className="module-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={(page + 1) * PAGE_SIZE >= results.data.count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </>}
    <CandidateDetail candidate={detail} run={run} onClose={() => setDetail(null)} />
  </Card>
}
function CandidateDetail({ candidate, run, onClose }: { candidate: CandidateRow | null; run: RunRow; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (candidate) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close() }, [candidate])
  const components = candidate ? candidateComponents(candidate) : []
  return <dialog ref={dialog} className="confirm-dialog matching-detail" aria-labelledby="matching-detail-title" onCancel={e => { e.preventDefault(); onClose() }}>
    <h2 id="matching-detail-title">Detalle de compatibilidad</h2>
    {candidate && <><p>Total: {candidate.total_score ?? 'sin score final'} / 100 · umbral: {runThreshold(run) ?? 'no disponible'}</p>
      <p>Modo de la ejecución: {jsonObject(run.summary).semantic_mode === 'embeddings' ? 'embeddings' : 'solo estructurado'}. Semántica de la pareja: {components.find(([key]) => key === 'semantic')?.[1].available ? 'disponible' : 'no disponible'}.</p>
      <div className="matching-table-scroll" tabIndex={0} role="region" aria-label="Tabla de componentes desplazable"><table><caption>Componentes y redistribución de pesos</caption><thead><tr><th>Componente</th><th>Score bruto</th><th>Peso configurado</th><th>Peso efectivo</th></tr></thead><tbody>{components.map(([key, score]) => <tr key={key}><th scope="row">{key}</th><td>{score.available ? score.raw_score?.toFixed(1) : 'No disponible'}</td><td>{score.configured_weight}%</td><td>{score.effective_weight.toFixed(2)}%</td></tr>)}</tbody></table></div>
      <h3>Bloqueos</h3>{jsonEntries(candidate.blockers).length ? <ul>{jsonEntries(candidate.blockers).map((b, i) => <li key={i}>{String(b.code)}{b.skill_id ? ` · habilidad ${String(b.skill_id)}` : ''}</li>)}</ul> : <p>Sin bloqueos.</p>}
      <h3>Fortalezas</h3><p>{components.filter(([, s]) => s.available && (s.raw_score ?? 0) >= 75).map(([key]) => key).join(', ') || 'Sin componentes fuertes disponibles.'}</p>
      <h3>Brechas y recomendaciones</h3><ul>{jsonEntries(candidate.recommendations).map((r, i) => <li key={i}>{String(r.message ?? r.code)}</li>)}</ul>
      <h3>Explicación</h3><p>{candidate.explanation ?? 'Sin explicación histórica.'}</p>
    </>}
    <Button autoFocus variant="secondary" onClick={onClose}>Cerrar detalle</Button>
  </dialog>
}
