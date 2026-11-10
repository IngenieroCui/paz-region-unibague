import { beforeEach, it, expect, vi } from 'vitest'
import { client } from '../../lib/supabase/feature-helpers'
import { executeMatching, loadCandidates, saveConfiguration, updateConfigurationMetadata } from './services'
import type { ConfigDraft, RunRow } from './services'
vi.mock('../../lib/supabase/feature-helpers', async original => ({ ...await original<typeof import('../../lib/supabase/feature-helpers')>(), client: vi.fn() }))
let role = ['ADMIN']; let used = false
const calls: { method: string; args: unknown[] }[] = []
const invoke = vi.fn()
beforeEach(() => {
  role = ['ADMIN']; used = false; calls.length = 0
  invoke.mockReset().mockResolvedValue({ data: { run_id: 'new-run' }, error: null })
  const response = () => ({ data: [{ id: 'candidate' }], count: used ? 1 : 0, error: null })
  const builder: Record<string, unknown> = { then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve), single: async () => ({ data: { id: 'saved' }, error: null }) }
  for (const method of ['select','eq','in','order','range','gte','lt','insert','update']) builder[method] = (...args: unknown[]) => { calls.push({ method, args }); return builder }
  vi.mocked(client).mockResolvedValue({ functions: { invoke }, from: (table: string) => { calls.push({ method: 'from', args: [table] }); return builder }, rpc: async () => ({ data: role, error: null }), auth: { getUser: async () => ({ data: { user: { id: 'verified' } }, error: null }) } } as unknown as Awaited<ReturnType<typeof client>>)
})
const draft: ConfigDraft = { name: 'Test config', academic_period_id: null, is_active: false, algorithm_version: 'hybrid-v0.1', minimum_recommended_score: 55, weights: { academic: 100, skills: 0, experience: 0, interests: 0, location: 0, preference: 0, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false } }
it('config insert validates and whitelists actor and meaning fields', async () => { await saveConfiguration({ ...draft, created_by: 'attacker', id: 'attacker' } as ConfigDraft); const payload = calls.find(c => c.method === 'insert')?.args[0]; expect(payload).toMatchObject({ created_by: 'verified', minimum_recommended_score: 55 }); expect(payload).not.toHaveProperty('id') })
it('used configuration cannot update meaning through service; metadata remains possible', async () => { used = true; await expect(saveConfiguration(draft, 'existing')).rejects.toThrow(/Duplicar/); expect(calls.some(c => c.method === 'update')).toBe(false); await updateConfigurationMetadata('existing', 'Renamed', false); expect(calls.find(c => c.method === 'update')?.args[0]).toEqual({ name: 'Renamed', is_active: false }) })
it('non-admin cannot save configuration and invalid weights fail before write', async () => { role = ['STUDENT']; await expect(saveConfiguration(draft)).rejects.toThrow(/ADMIN/); role = ['ADMIN']; await expect(saveConfiguration({ ...draft, weights: { ...draft.weights, academic: 99 } })).rejects.toThrow(/sumen/); expect(calls.some(c => c.method === 'insert')).toBe(false) })
it('ranking is server paginated with stored threshold and stable ordering', async () => { const run: RunRow = { id: 'run', academic_period_id: 'p', matching_configuration_id: 'c', started_by: null, started_at: null, completed_at: null, created_at: '', status: 'completed', summary: { configuration_snapshot: { minimum_recommended_score: 55 } } }; await loadCandidates(run, 2, { student: 's', position: 'p', state: 'recommended' }); expect(calls).toContainEqual({ method: 'gte', args: ['total_score', 55] }); expect(calls).toContainEqual({ method: 'range', args: [50, 74] }); expect(calls).toContainEqual({ method: 'eq', args: ['is_eligible', true] }); expect(calls).toContainEqual({ method: 'order', args: ['id'] }) })
it('a rejected matching request is an uncertain execution requiring history inspection', async () => {
  invoke.mockRejectedValue(new TypeError('Network lost'))
  await expect(executeMatching('period', 'config')).rejects.toMatchObject({ code: 'UNCERTAIN_RUN' })
})
it('runs matching with a bounded wait and refuses non-admin calls', async () => {
  expect(await executeMatching('period', 'config')).toBe('new-run')
  expect(invoke).toHaveBeenCalledWith('matching-run', expect.objectContaining({ timeout: 120_000 }))
  role = ['ADVISOR']
  await expect(executeMatching('period', 'config')).rejects.toMatchObject({ code: '42501' })
  expect(invoke).toHaveBeenCalledTimes(1)
})
it.each([[401, 'AUTH_REQUIRED', '401'], [403, 'ADMIN_REQUIRED', '42501'], [409, 'RUN_ALREADY_RUNNING', 'RUN_ALREADY_RUNNING']] as const)('translates HTTP %s without exposing backend details', async (status, code, expected) => {
  invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: code, debug: 'private diagnostic' }), { status }) } })
  await expect(executeMatching('period', 'config')).rejects.toMatchObject({ code: expected })
})
