import { beforeEach, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchingWorkspace from './MatchingWorkspace'
import { ConfigurationEditor } from './ConfigurationEditor'
import { MatchingResults } from './MatchingResults'
import * as services from './services'
import type { ConfigRow, RunRow, CandidateRow } from './services'
import { FeatureError } from '../../lib/supabase/feature-helpers'
vi.mock('./services', async original => ({ ...await original<typeof services>(), loadMatchingMetadata: vi.fn(), loadRuns: vi.fn(), configurationUsed: vi.fn(), saveConfiguration: vi.fn(), updateConfigurationMetadata: vi.fn(), executeMatching: vi.fn(), loadMatchingFilters: vi.fn(), loadCandidates: vi.fn() }))
const config: ConfigRow = { id: 'c', name: 'Configuración histórica', algorithm_version: 'hybrid-v0.1', minimum_recommended_score: 99, academic_period_id: null, is_active: true, weights: { academic: 100, skills: 0, experience: 0, interests: 0, location: 0, preference: 0, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false }, created_at: '', updated_at: '', created_by: null }
const run: RunRow = { id: 'r', academic_period_id: 'p', matching_configuration_id: 'c', status: 'completed', started_at: null, completed_at: null, created_at: '2026-10-01T12:00:00Z', started_by: null, summary: { configuration_snapshot: { minimum_recommended_score: 70 }, algorithm_version: 'hybrid-v0.1', semantic_mode: 'structured_only' } }
const candidate: CandidateRow = { id: 'pair', matching_run_id: 'r', student_id: 's', project_position_id: 'pos', is_eligible: true, total_score: 70, blockers: [], recommendations: [{ message: 'Revisar habilidades declaradas.' }], explanation: 'Compatibilidad calculada.', created_at: '', component_scores: { academic: { raw_score: 100, configured_weight: 25, effective_weight: 100, available: true }, semantic: { raw_score: null, configured_weight: 15, effective_weight: 0, available: false } } }
beforeEach(() => {
  vi.mocked(services.loadMatchingMetadata).mockResolvedValue({ periods: [], configurations: [config] })
  vi.mocked(services.loadRuns).mockResolvedValue({ rows: [run], count: 1 })
  vi.mocked(services.configurationUsed).mockResolvedValue(false)
  vi.mocked(services.loadMatchingFilters).mockResolvedValue({ students: [{ id: 's', label: 'Estudiante de prueba' }], positions: [{ id: 'pos', label: 'Proyecto / Plaza' }] })
  vi.mocked(services.loadCandidates).mockResolvedValue({ rows: [candidate], count: 1 })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
})
it('empty periods/configuration state never substitutes production demo data', async () => { render(<MatchingWorkspace />); expect(await screen.findByRole('heading', { name: 'Sin periodos académicos' })).toBeInTheDocument(); expect(screen.queryByText('Estudiante de prueba')).not.toBeInTheDocument() })
it('used configurations disable semantic fields and duplication unlocks a new inactive draft', async () => {
  vi.mocked(services.configurationUsed).mockResolvedValue(true)
  render(<ConfigurationEditor selected={config} periods={[]} onSaved={() => {}} />)
  await screen.findByText('Configuración histórica protegida')
  expect(screen.getByLabelText('Peso academic (%)')).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Duplicar configuración' }))
  expect(screen.getByLabelText('Peso academic (%)')).toBeEnabled(); expect(screen.getByLabelText('Configuración activa')).not.toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Crear copia' }))
  await waitFor(() => expect(services.saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({ name: 'Configuración histórica (copia)', is_active: false }), undefined))
})
it('ranking uses historical threshold, opens components with unavailable semantics, and paginates', async () => {
  vi.mocked(services.loadCandidates).mockResolvedValue({ rows: [candidate], count: 30 })
  render(<MatchingResults run={run} />)
  expect(await screen.findByRole('heading', { name: 'Estudiante de prueba' })).toBeInTheDocument()
  expect(screen.getByText(/· Recomendada/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
  expect(screen.getByRole('dialog', { name: 'Detalle de compatibilidad' })).toBeInTheDocument()
  expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
  expect(screen.getByText('Compatibilidad calculada.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await waitFor(() => expect(services.loadCandidates).toHaveBeenLastCalledWith(run, 1, { student: '', position: '', state: 'all' }))
  await userEvent.selectOptions(screen.getByLabelText('Filtrar compatibilidad'), 'blocked')
  await waitFor(() => expect(services.loadCandidates).toHaveBeenLastCalledWith(run, 0, { student: '', position: '', state: 'blocked' }))
})
it('failed run never loads partial candidates as a completed ranking', async () => { render(<MatchingResults run={{ ...run, status: 'failed' }} />); expect(screen.getByText('Ejecución fallida')).toBeInTheDocument(); await waitFor(() => expect(services.loadCandidates).not.toHaveBeenCalled()) })

it('requires a deliberate history refresh after an uncertain matching execution', async () => {
  vi.mocked(services.loadMatchingMetadata).mockResolvedValue({ periods: [{ id: 'p', name: 'Periodo demo', is_current: true }], configurations: [config] } as Awaited<ReturnType<typeof services.loadMatchingMetadata>>)
  vi.mocked(services.executeMatching).mockRejectedValue(new FeatureError('Revisa el historial antes de reintentar.', 'UNCERTAIN_RUN'))
  render(<MatchingWorkspace />)
  await userEvent.click(await screen.findByRole('button', { name: /^Ejecutar$/ }))
  await userEvent.selectOptions(screen.getByLabelText('Configuración para ejecutar'), 'c')
  await userEvent.click(screen.getByRole('button', { name: 'Revisar y ejecutar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Ejecutar compatibilidad' }))
  await screen.findByText('Revisa el historial antes de reintentar.')
  expect(screen.getByRole('button', { name: 'Revisar y ejecutar' })).toBeDisabled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar historial' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Revisar y ejecutar' })).toBeEnabled())
  expect(services.executeMatching).toHaveBeenCalledTimes(1)
})
