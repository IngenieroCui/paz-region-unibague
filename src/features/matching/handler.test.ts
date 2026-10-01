import { it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { createMatchingHandler } from '../../../supabase/functions/matching-run/handler'
import type { Student, Position } from '../../../supabase/functions/_shared/matching/engine'
const period = '51000000-0000-0000-0000-000000000001'; const configuration = '51000000-0000-0000-0000-000000000002'
const config = { id: configuration, name: 'Test only', academic_period_id: period, is_active: true, algorithm_version: 'hybrid-v0.1', minimum_recommended_score: 80, weights: { academic: 100, skills: 0, experience: 0, interests: 0, location: 0, preference: 0, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false } }
const student: Student = { id: 'student-test', academic_program_id: 'program', bio: null, desired_work_description: null, current_municipality_id: null, origin_municipality_id: null, experiences: [], interests: [], skills: [], preferences: [] }
const position: Position = { id: 'position-test', title: 'Test', description: null, project: { name: 'Test', description: null, summary: null, municipality_id: null }, programs: [{ academic_program_id: 'program', is_required: true }], requirements: [], skills: [] }
function fixture(options: { roles?: string[]; authError?: boolean; concurrent?: boolean; writeError?: boolean; failureUpdateError?: boolean; configRow?: typeof config } = {}) {
  const operations: { table: string; action: string; payload: unknown }[] = []
  const from = vi.fn((table: string) => {
    let action = 'select'; let payload: unknown
    const response = () => {
      if (table === 'PYRUnibague_AcademicPeriods') return { data: { id: period }, error: null }
      if (table === 'PYRUnibague_MatchingConfigurations') return { data: options.configRow ?? config, error: null }
      if (table === 'PYRUnibague_MatchingRuns' && action === 'insert') return options.concurrent ? { data: null, error: { code: '23505' } } : { data: { id: 'run-test', summary: (payload as { summary: unknown }).summary }, error: null }
      if (table === 'PYRUnibague_MatchCandidates') return { data: null, error: options.writeError ? { code: '42501', message: 'SENSITIVE' } : null }
      if (options.failureUpdateError && (payload as { status?: string })?.status === 'failed') return { data: null, error: { code: '42501' } }
      return { data: { id: 'run-test' }, error: null }
    }
    const builder = {
      select: () => builder, eq: () => builder,
      insert: (value: unknown) => { action = 'insert'; payload = value; operations.push({ table, action, payload }); return builder },
      update: (value: unknown) => { action = 'update'; payload = value; operations.push({ table, action, payload }); return builder },
      single: async () => response(),
      then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve),
    }
    return builder
  })
  const db = { from, auth: { getUser: vi.fn(async () => ({ data: { user: options.authError ? null : { id: 'persisted-actor', user_metadata: { role: 'ADMIN' } } }, error: options.authError ? new Error('token') : null })) }, rpc: vi.fn(async () => ({ data: options.roles ?? ['ADMIN'], error: null })) } as unknown as SupabaseClient<Database>
  const pool = vi.fn(async () => ({ students: [student], positions: [position] }))
  const handler = createMatchingHandler({ client: () => db, pool, env: key => key === 'PYRUNIBAGUE_ALLOWED_ORIGINS' ? 'https://app.example.test' : undefined })
  return { handler, pool, operations, db }
}
function request(body: unknown = { academic_period_id: period, matching_configuration_id: configuration }, auth = true, origin?: string) {
  return new Request('https://edge.example.test/matching-run', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer signed-user-jwt' } : {}), ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) })
}
it('anon and invalid JWT cannot execute', async () => { let f = fixture(); expect((await f.handler(request(undefined, false))).status).toBe(401); expect(f.pool).not.toHaveBeenCalled(); f = fixture({ authError: true }); expect((await f.handler(request())).status).toBe(401) })
it.each([{ roles: ['STUDENT'] }, { roles: ['ORGANIZATION'] }, { roles: [] }])('persisted roles $roles cannot execute despite editable ADMIN metadata', async ({ roles }) => { const f = fixture({ roles }); expect((await f.handler(request())).status).toBe(403); expect(f.operations).toEqual([]) })
it('rejects actor injection, invalid UUIDs and untrusted CORS origins', async () => { const f = fixture(); expect((await f.handler(request({ academic_period_id: period, matching_configuration_id: configuration, started_by: 'attacker' }))).status).toBe(400); expect((await f.handler(request({ academic_period_id: 'bad', matching_configuration_id: configuration }))).status).toBe(400); expect((await f.handler(request(undefined, true, 'https://evil.example.test'))).status).toBe(403) })
it('ADMIN creates candidates with verified actor and safe historical summary, never assignments', async () => {
  const f = fixture(); const response = await f.handler(request(undefined, true, 'https://app.example.test')); expect(response.status).toBe(200)
  const result = await response.json(); expect(result.summary).toMatchObject({ algorithm_version: 'hybrid-v0.1', student_count: 1, position_count: 1, pair_count: 1, eligible_pairs: 1, blocked_pairs: 0, recommended_pairs: 1, below_threshold_pairs: 0, semantic_mode: 'structured_only' })
  expect(f.operations[0]?.payload).toMatchObject({ started_by: 'persisted-actor' }); expect(f.operations.some(o => o.table.includes('Assignment'))).toBe(false); expect(JSON.stringify(result)).not.toContain('signed-user-jwt'); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test')
})
it('same running combination returns 409 before pool or provider', async () => { const f = fixture({ concurrent: true }); expect((await f.handler(request())).status).toBe(409); expect(f.pool).not.toHaveBeenCalled() })
it('critical error records failed and only a safe technical code', async () => { const f = fixture({ writeError: true }); const response = await f.handler(request()); expect(response.status).toBe(500); expect(f.operations.at(-1)?.payload).toMatchObject({ status: 'failed', summary: { error: 'CANDIDATES_WRITE_FAILED' } }); expect(JSON.stringify(await response.json())).not.toContain('SENSITIVE') })
it('failure finalization denied by changed permissions reports real recovery need', async () => { const f = fixture({ writeError: true, failureUpdateError: true }); expect(await (await f.handler(request())).json()).toMatchObject({ recovery_required: true }) })
it('writes batches of 200 instead of keeping a full candidate matrix in memory', async () => { const f = fixture(); f.pool.mockResolvedValue({ students: Array.from({ length: 402 }, (_, i) => ({ ...student, id: String(i) })), positions: [position] }); expect((await f.handler(request())).status).toBe(200); expect(f.operations.filter(o => o.table === 'PYRUnibague_MatchCandidates').map(o => (o.payload as unknown[]).length)).toEqual([200, 200, 2]) })
it('provider unavailable still completes structured-only with warning', async () => { const f = fixture({ configRow: { ...config, weights: { ...config.weights, academic: 85, semantic: 15 }, rules: { ...config.rules, semanticEnabled: true } } }); const response = await f.handler(request()); expect(response.status).toBe(200); const result = await response.json(); expect(result.summary.warnings).toEqual(['SEMANTIC_SETTINGS_MISSING']); expect(result.summary.recommended_pairs).toBe(1) })
it('unsupported config rejected before creating run', async () => { const f = fixture({ configRow: { ...config, algorithm_version: 'unknown' } }); expect((await f.handler(request())).status).toBe(400); expect(f.operations).toEqual([]) })
