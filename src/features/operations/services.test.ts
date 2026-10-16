import { beforeEach, expect, it, vi } from 'vitest'
import { client } from '../../lib/supabase/feature-helpers'
import { operationalExport } from './services'

vi.mock('../../lib/supabase/feature-helpers', async () => ({
  ...await vi.importActual<typeof import('../../lib/supabase/feature-helpers')>('../../lib/supabase/feature-helpers'), client: vi.fn(),
}))
const rpc = vi.fn()
beforeEach(() => { rpc.mockReset(); vi.mocked(client).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof client>>) })
it('exports beyond the server page cap using a cursor without dropping the last row', async () => {
  const first = Array.from({ length: 500 }, (_, n) => ({ id: String(n).padStart(5, '0'), student: 'Persona' }))
  rpc.mockResolvedValueOnce({ data: first, error: null }).mockResolvedValueOnce({ data: [{ id: '00500', student: 'Última persona' }], error: null })
  expect(await operationalExport('period', 'assignments')).toHaveLength(501)
  expect(rpc).toHaveBeenNthCalledWith(2, 'pyr_unibague_operational_export', { p_period_id: 'period', p_kind: 'assignments', p_after_id: '00499' })
})
it('rejects a repeated cursor instead of looping forever or exporting duplicates', async () => {
  const batch = Array.from({ length: 500 }, (_, n) => ({ id: String(n).padStart(5, '0') }))
  rpc.mockResolvedValue({ data: batch, error: null })
  await expect(operationalExport('period', 'positions')).rejects.toThrow('orden esperado')
  expect(rpc).toHaveBeenCalledTimes(2)
})
it('stops on permission errors without downloading partial results', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Denied' } })
  await expect(operationalExport('period', 'assignments')).rejects.toThrow('permiso')
})
