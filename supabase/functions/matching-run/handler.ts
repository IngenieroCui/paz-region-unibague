import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../../src/lib/supabase/database.types.ts'
import { ALGORITHM_VERSION, COMPONENTS, calculatePair, constraints, validateConfiguration } from '../_shared/matching/engine.ts'
import type { PairResult } from '../_shared/matching/engine.ts'
import { prepareSemantic } from '../_shared/matching/embeddings.ts'
import { loadPool } from './repository.ts'
type Client = SupabaseClient<Database>
type Dependencies = {
  client: (authorization: string) => Client; env: (key: string) => string | undefined
  pool?: typeof loadPool; semantic?: typeof prepareSemantic; now?: () => number
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function createMatchingHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin')
    const origins = (deps.env('PYRUNIBAGUE_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin', 'Cache-Control': 'no-store' }
    const reply = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status, headers })
    if (origin && !origins.includes(origin)) return reply(403, { error: 'ORIGIN_NOT_ALLOWED' })
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' })
    const authorization = request.headers.get('Authorization') ?? ''
    if (!/^Bearer \S+$/i.test(authorization)) return reply(401, { error: 'AUTH_REQUIRED' })
    let db: Client
    let actor: string
    try {
      db = deps.client(authorization)
      const identity = await db.auth.getUser(authorization.slice(7))
      if (identity.error || !identity.data.user) return reply(401, { error: 'AUTH_REQUIRED' })
      actor = identity.data.user.id
      const roles = await db.rpc('pyr_unibague_current_roles')
      if (roles.error || !roles.data?.includes('ADMIN')) return reply(403, { error: 'ADMIN_REQUIRED' })
    } catch { return reply(503, { error: 'AUTH_UNAVAILABLE' }) }
    let period: string; let configurationId: string
    try {
      const text = await request.text()
      if (text.length > 2048) return reply(400, { error: 'INVALID_INPUT' })
      const body: unknown = JSON.parse(text)
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'INVALID_INPUT' })
      const input = body as Record<string, unknown>
      if (Object.keys(input).length !== 2 || typeof input.academic_period_id !== 'string' || typeof input.matching_configuration_id !== 'string' || !uuid.test(input.academic_period_id) || !uuid.test(input.matching_configuration_id)) return reply(400, { error: 'INVALID_INPUT' })
      period = input.academic_period_id; configurationId = input.matching_configuration_id
    } catch { return reply(400, { error: 'INVALID_INPUT' }) }
    const clock = deps.now ?? Date.now; const start = clock(); let runId: string | undefined
    let summary: Record<string, Json> = {}
    try {
      const [periodResult, configResult] = await Promise.all([
        db.from('PYRUnibague_AcademicPeriods').select('id').eq('id', period).single(),
        db.from('PYRUnibague_MatchingConfigurations').select('*').eq('id', configurationId).single(),
      ])
      if (periodResult.error || configResult.error || !configResult.data || !periodResult.data) return reply(400, { error: 'PERIOD_OR_CONFIGURATION_INVALID' })
      const row = configResult.data
      if (!row.is_active || row.academic_period_id && row.academic_period_id !== period) return reply(400, { error: 'CONFIGURATION_NOT_AVAILABLE' })
      let config
      try { config = validateConfiguration(row) } catch { return reply(400, { error: 'CONFIGURATION_INVALID' }) }
      const snapshot = { academic_period_id: row.academic_period_id, ...config }
      summary = { algorithm_version: ALGORITHM_VERSION, configuration_snapshot: snapshot, student_count: 0, position_count: 0, pair_count: 0, eligible_pairs: 0, blocked_pairs: 0, recommended_pairs: 0, below_threshold_pairs: 0, semantic_mode: 'structured_only', warnings: [], timing: { started_at: new Date(start).toISOString() } }
      const created = await db.from('PYRUnibague_MatchingRuns').insert({ academic_period_id: period, matching_configuration_id: configurationId, status: 'running', started_by: actor, started_at: new Date(start).toISOString(), summary }).select('id,summary').single()
      if (created.error?.code === '23505') return reply(409, { error: 'RUN_ALREADY_RUNNING' })
      if (created.error || !created.data) throw new Error('RUN_CREATE_FAILED')
      runId = created.data.id
      // DB locked the configuration while creating its snapshot. Refuse a pre-insert edit race.
      const dbSummary = created.data.summary as Record<string, Json>
      if (JSON.stringify(dbSummary.configuration_snapshot) !== JSON.stringify(snapshot)) {
        // JSONB key order is not stable: compare the meaning through validation.
        const stored = dbSummary.configuration_snapshot as Record<string, unknown>
        const actual = validateConfiguration(stored)
        if (stored.academic_period_id !== row.academic_period_id || actual.minimum_recommended_score !== config.minimum_recommended_score || COMPONENTS.some(key => actual.weights[key] !== config.weights[key]) || actual.rules.requiredSkillsAreHardConstraint !== config.rules.requiredSkillsAreHardConstraint || actual.rules.semanticEnabled !== config.rules.semanticEnabled) throw new Error('CONFIGURATION_CHANGED_RETRY')
      }
      const pool = await (deps.pool ?? loadPool)(db, period)
      summary.student_count = pool.students.length; summary.position_count = pool.positions.length
      summary.pair_count = pool.students.length * pool.positions.length
      // Fail safely before spending on embeddings when a synchronous Edge run is oversized.
      if (Number(summary.pair_count) > 250000) throw new Error('POOL_TOO_LARGE')
      const semanticStudents = new Set<string>(); const semanticPositions = new Set<string>()
      for (const student of pool.students) for (const position of pool.positions) if (!constraints(student, position, config).length) { semanticStudents.add(student.id); semanticPositions.add(position.id) }
      const semantic = config.rules.semanticEnabled && config.weights.semantic > 0
        ? await (deps.semantic ?? prepareSemantic)(pool.students.filter(s => semanticStudents.has(s.id)), pool.positions.filter(p => semanticPositions.has(p.id)), { baseUrl: deps.env('PYRUNIBAGUE_AI_BASE_URL'), apiKey: deps.env('PYRUNIBAGUE_AI_API_KEY'), model: deps.env('PYRUNIBAGUE_AI_EMBEDDING_MODEL') })
        : { mode: 'structured_only' as const, warnings: ['SEMANTIC_DISABLED'], model: null, score: () => null }
      summary.semantic_mode = semantic.mode; summary.warnings = semantic.warnings; summary.embedding_model = semantic.model
      let eligible = 0; let blocked = 0; let recommended = 0; let below = 0; let persisted = 0
      let batch: PairResult[] = []
      async function flush() {
        if (!batch.length) return
        const response = await db.from('PYRUnibague_MatchCandidates').insert(batch.map(pair => ({ ...pair, matching_run_id: runId!, component_scores: pair.component_scores, blockers: pair.blockers, recommendations: pair.recommendations })))
        if (response.error) throw new Error('CANDIDATES_WRITE_FAILED')
        persisted += batch.length; summary.persisted_pairs = persisted; batch = []
      }
      for (const student of pool.students) for (const position of pool.positions) {
        if (clock() - start > 100000) throw new Error('RUN_TIME_LIMIT')
        const pair = calculatePair(student, position, config, semantic.score(student, position))
        if (pair.is_eligible) { eligible++; if (pair.total_score! >= config.minimum_recommended_score) recommended++; else below++ } else blocked++
        Object.assign(summary, { eligible_pairs: eligible, blocked_pairs: blocked, recommended_pairs: recommended, below_threshold_pairs: below, evaluated_pairs: eligible + blocked })
        batch.push(pair); if (batch.length === 200) await flush()
      }
      await flush()
      Object.assign(summary, { eligible_pairs: eligible, blocked_pairs: blocked, recommended_pairs: recommended, below_threshold_pairs: below, timing: { started_at: new Date(start).toISOString(), completed_at: new Date(clock()).toISOString(), duration_ms: clock() - start } })
      const completed = await db.from('PYRUnibague_MatchingRuns').update({ status: 'completed', completed_at: new Date(clock()).toISOString(), summary }).eq('id', runId).eq('status', 'running').select('id').single()
      if (completed.error || !completed.data) throw new Error('RUN_COMPLETE_FAILED')
      return reply(200, { run_id: runId, summary })
    } catch (error) {
      const known = new Set(['CONFIGURATION_CHANGED_RETRY', 'POOL_TOO_LARGE', 'RUN_TIME_LIMIT', 'POOL_READ_FAILED', 'POOL_REFERENCE_MISSING', 'CANDIDATES_WRITE_FAILED', 'RUN_COMPLETE_FAILED', 'RUN_CREATE_FAILED'])
      const code = error instanceof Error && known.has(error.message) ? error.message : 'RUN_FAILED'
      if (runId) {
        summary.error = code; summary.timing = { started_at: new Date(start).toISOString(), failed_at: new Date(clock()).toISOString(), duration_ms: clock() - start }
        try {
          const failed = await db.from('PYRUnibague_MatchingRuns').update({ status: 'failed', completed_at: new Date(clock()).toISOString(), summary }).eq('id', runId).eq('status', 'running').select('id').single()
          if (failed.error || !failed.data) return reply(500, { run_id: runId, error: code, recovery_required: true })
        } catch { return reply(500, { run_id: runId, error: code, recovery_required: true }) }
      }
      return reply(500, { run_id: runId, error: code })
    }
  }
}
