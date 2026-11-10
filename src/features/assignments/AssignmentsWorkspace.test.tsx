import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssignmentsWorkspace } from './AssignmentsWorkspace'
import { pool } from './test-fixtures'
import { solveAssignments } from '../optimizer/solveAssignments'
import * as services from './services'
import { FeatureError } from '../../lib/supabase/feature-helpers'
import type { AssignmentSnapshot } from './types'
vi.mock('./services', () => ({ loadAssignmentMetadata: vi.fn(), loadAssignmentSnapshot: vi.fn(), commitAssignments: vi.fn(), loadAssignmentHistory: vi.fn(), loadAssignmentEvents: vi.fn() }))
class FixtureWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  stopped = false
  postMessage(value: { snapshot: AssignmentSnapshot; excluded: string[] }) { queueMicrotask(() => { if (!this.stopped) this.onmessage?.({ data: { proposal: solveAssignments(value.snapshot, value.excluded) } }) }) }
  terminate() { this.stopped = true }
}
beforeEach(() => {
  vi.stubGlobal('Worker', FixtureWorker)
  vi.mocked(services.loadAssignmentMetadata).mockResolvedValue({ periods: [{ id: 'period', name: 'Periodo de prueba', is_current: true }], runs: [{ id: 'run', academic_period_id: 'period', created_at: '2026-10-01T12:00:00Z', status: 'completed' }] } as Awaited<ReturnType<typeof services.loadAssignmentMetadata>>)
  vi.mocked(services.loadAssignmentSnapshot).mockImplementation(async (_period, run) => { const data = pool([[95, 92], [94, 72]]); if (!run) { data.run = null; data.candidates = [] }; return data })
  vi.mocked(services.commitAssignments).mockResolvedValue([])
  vi.mocked(services.loadAssignmentHistory).mockResolvedValue({ rows: [], count: 0 })
  vi.mocked(services.loadAssignmentEvents).mockResolvedValue({ rows: [], count: 0 })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
})
async function proposal() {
  render(<AssignmentsWorkspace />); await screen.findByRole('heading', { name: /Resumen · Periodo/ })
  await userEvent.selectOptions(screen.getByLabelText('Ejecución completada'), 'run')
  await userEvent.click(screen.getByRole('button', { name: 'Optimizar y revisar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Calcular propuesta' }))
  await screen.findByText(/compatibilidad total 186.00/)
}
it('computes global draft and writes nothing until the admin confirms a review dialog', async () => {
  await proposal(); expect(services.commitAssignments).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Revisar y confirmar lote (2)' }))
  const dialog = screen.getByRole('dialog', { name: 'Confirmar decisión administrativa' }); expect(dialog).toHaveAttribute('open')
  expect(services.commitAssignments).not.toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar decisión' }))
  await waitFor(() => expect(services.commitAssignments).toHaveBeenCalledWith(expect.objectContaining({ revision: 'draft', run: expect.objectContaining({ id: 'run' }) }), [expect.objectContaining({ student_id: 's0', position_id: 'p1' }), expect.objectContaining({ student_id: 's1', position_id: 'p0' })]))
})
it('exclusion recalculates the remaining global draft without writes', async () => {
  await proposal(); await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]!)
  await screen.findByText(/compatibilidad total 167.00/); expect(services.commitAssignments).not.toHaveBeenCalled()
})
it('stale batch remains unconfirmed and requires explicit refresh/recalculation', async () => {
  vi.mocked(services.commitAssignments).mockRejectedValue(new FeatureError('Recalcula la propuesta.', 'P0001'))
  await proposal(); await userEvent.click(screen.getByRole('button', { name: 'Revisar y confirmar lote (2)' }))
  const dialog = screen.getByRole('dialog', { name: 'Confirmar decisión administrativa' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar decisión' }))
  await screen.findByText('Propuesta desactualizada')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('button', { name: 'Revisar y confirmar lote (2)' })).toBeDisabled()
})
it('manual unscored assignment requires explicit acknowledgement, reason and final review', async () => {
  render(<AssignmentsWorkspace />); await screen.findByRole('heading', { name: /Resumen ·/ }); await userEvent.click(screen.getByRole('button', { name: 'Intervención manual' }))
  await userEvent.selectOptions(screen.getByLabelText('Estudiante a intervenir'), 's0'); await userEvent.selectOptions(screen.getByLabelText('Destino manual'), 'p0')
  await userEvent.selectOptions(screen.getByLabelText('Motivo de intervención'), 'OTHER'); await userEvent.type(screen.getByLabelText('Justificación'), 'Caso revisado por coordinación')
  expect(screen.getByRole('button', { name: 'Revisar asignación manual' })).toBeDisabled()
  await userEvent.click(screen.getByLabelText('Confirmo asignación manual sin compatibilidad histórica verificable'))
  await userEvent.click(screen.getByRole('button', { name: 'Revisar asignación manual' })); expect(services.commitAssignments).not.toHaveBeenCalled()
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar decisión' }))
  await waitFor(() => expect(services.commitAssignments).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ source: 'MANUAL', allow_unscored: true, reason_code: 'OTHER', reason_text: 'Caso revisado por coordinación' })]))
})
it('loads paginated history using the chosen student filter', async () => {
  render(<AssignmentsWorkspace />); await screen.findByRole('heading', { name: /Resumen ·/ }); await userEvent.click(screen.getByRole('button', { name: 'Historial' })); await screen.findByLabelText('Historial del estudiante')
  await userEvent.selectOptions(screen.getByLabelText('Historial del estudiante'), 's1')
  await waitFor(() => expect(services.loadAssignmentHistory).toHaveBeenLastCalledWith('period', 0, expect.objectContaining({ studentId: 's1' })))
})
it('non-admin workspace renders its denial without loading a snapshot', async () => {
  vi.mocked(services.loadAssignmentMetadata).mockRejectedValue(new FeatureError('Asignaciones requiere el rol ADMIN.', '42501'))
  render(<AssignmentsWorkspace />); await screen.findByText('Asignaciones requiere el rol ADMIN.'); expect(services.loadAssignmentSnapshot).not.toHaveBeenCalled()
})
it('keeps the reviewed proposal while refreshing the matching run list', async () => {
  await proposal()
  let finish: (value: Awaited<ReturnType<typeof services.loadAssignmentMetadata>>) => void = () => {}
  const data = await services.loadAssignmentMetadata()
  vi.mocked(services.loadAssignmentMetadata).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar ejecuciones' }))
  expect(screen.getByText(/compatibilidad total 186.00/)).toBeInTheDocument()
  finish(data)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar ejecuciones' })).toBeEnabled())
  expect(screen.getByText(/compatibilidad total 186.00/)).toBeInTheDocument()
})
