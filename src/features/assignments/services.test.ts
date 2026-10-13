import { beforeEach, expect, it, vi } from 'vitest'
import { commitAssignments, loadAssignmentMetadata, loadAssignmentSnapshot } from './services'
import { pool } from './test-fixtures'
const rpc = vi.fn(); const from = vi.fn()
vi.mock('../../lib/supabase/client', () => ({ getSupabase: async () => ({ rpc, from }) }))
beforeEach(() => { rpc.mockReset(); from.mockReset() })
it('fails closed for non-admin metadata without loading any matching tables', async () => {
  rpc.mockResolvedValue({ data: ['STUDENT'], error: null })
  await expect(loadAssignmentMetadata()).rejects.toMatchObject({ code: '42501' }); expect(from).not.toHaveBeenCalled()
})
it('loads one authoritative transactional snapshot', async () => {
  const snapshot = pool([[99]]); rpc.mockResolvedValue({ data: snapshot, error: null })
  expect(await loadAssignmentSnapshot('period', 'run')).toEqual(snapshot)
  expect(rpc).toHaveBeenCalledWith('pyr_unibague_assignment_snapshot', { p_period_id: 'period', p_run_id: 'run' })
})
it('routes a batch to the all-or-nothing RPC with the draft revision', async () => {
  const snapshot = pool([[99], [98]]); const actions = snapshot.students.map(s => ({ kind: 'confirm' as const, student_id: s.id, position_id: 'p0', source: 'MATCHING' as const }))
  rpc.mockResolvedValue({ data: [], error: null }); await commitAssignments(snapshot, actions)
  expect(rpc).toHaveBeenCalledWith('pyr_unibague_confirm_assignment_batch', { p_period_id: 'period', p_run_id: 'run', p_revision: 'draft', p_actions: actions }); expect(from).not.toHaveBeenCalled()
})
it.each([['confirm', 'pyr_unibague_confirm_assignment'], ['reassign', 'pyr_unibague_reassign_assignment'], ['unassign', 'pyr_unibague_unassign_assignment']] as const)('routes %s through its audited singleton RPC', async (kind, endpoint) => {
  rpc.mockResolvedValue({ data: [], error: null }); await commitAssignments(pool([[99]]), [{ kind, student_id: 's0' }]); expect(rpc.mock.calls[0]![0]).toBe(endpoint)
})
it('stale batches tell the admin to recalculate without claiming partial success', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'internal detail' } })
  await expect(commitAssignments(pool([[99]]), [{ kind: 'confirm', student_id: 's0' }])).rejects.toMatchObject({ code: 'P0001', message: expect.stringContaining('no se confirmó ninguna fila') })
})
it('malformed snapshots fail closed', async () => { rpc.mockResolvedValue({ data: {}, error: null }); await expect(loadAssignmentSnapshot('period', 'run')).rejects.toThrow(/incompleta/) })
it('network failure after sending a decision requires history refresh before retry', async () => {
  rpc.mockRejectedValue(new TypeError('Network connection lost'))
  await expect(commitAssignments(pool([[99]]), [{ kind: 'confirm', student_id: 's0' }])).rejects.toMatchObject({ code: 'UNCERTAIN_COMMIT', message: expect.stringContaining('Actualiza cupos e historial') })
})
