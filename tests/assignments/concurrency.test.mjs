// Real independent PostgreSQL sessions. Requires a DISPOSABLE Supabase test database.
// Fixtures intentionally remain because assignment/matching history cannot be deleted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
const env = process.env
const ready = Boolean(env.P6C_PG_MODULE && env.P6C_POSTGRES_URL && env.P6C_ALLOW_DISPOSABLE_TESTS === 'yes')
const skip = ready ? false : 'SKIPPED: disposable Supabase PostgreSQL runtime/driver not configured; P6C_ALLOW_DISPOSABLE_TESTS=yes required.'
async function connection() {
  const module = await import(env.P6C_PG_MODULE); const Client = module.Client ?? module.default.Client
  const db = new Client({ connectionString: env.P6C_POSTGRES_URL }); await db.connect(); return db
}
async function seed(db) {
  const actor = randomUUID(); const users = [randomUUID(), randomUUID()]; const students = [randomUUID(), randomUUID()]
  const period = randomUUID(); const org = randomUUID(); const project = randomUUID(); const positions = [randomUUID(), randomUUID()]; const config = randomUUID(); const run = randomUUID()
  const candidates = students.map(() => positions.map(() => randomUUID()))
  await db.query('begin')
  try {
    for (const [i, id] of [actor, ...users].entries()) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, `p6c-concurrency-${id}@example.test`])
      await db.query('insert into public."PYRUnibague_UserRoles"(user_id,role_id) select $1,id from public."PYRUnibague_Roles" where code=$2', [id, i === 0 ? 'ADMIN' : 'STUDENT'])
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
    await db.query('insert into public."PYRUnibague_AcademicPeriods"(id,code,name,status) values($1,$2,\'P6C concurrency fixture\',\'test\')', [period, `P6C-${period}`])
    for (let i = 0; i < students.length; i++) {
      await db.query('insert into public."PYRUnibague_Students"(id,user_id) values($1,$2)', [students[i], users[i]])
      await db.query('insert into public."PYRUnibague_StudentPeriodParticipations"(student_id,academic_period_id,status,eligible_for_matching) values($1,$2,\'test\',true)', [students[i], period])
    }
    await db.query('insert into public."PYRUnibague_Organizations"(id,legal_name,status,verified_at,verified_by) values($1,\'P6C concurrency fixture\',\'approved\',now(),$2)', [org, actor])
    await db.query('insert into public."PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status) values($1,$2,$3,\'P6C fixture\',\'approved\')', [project, org, period])
    for (const p of positions) await db.query('insert into public."PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values($1,$2,\'Fixture\',1,\'test\')', [p, project])
    await db.query('insert into public."PYRUnibague_MatchingConfigurations"(id,name,algorithm_version,minimum_recommended_score,weights,rules,is_active) values($1,\'P6C fixture\',\'hybrid-v0.1\',70,$2,$3,true)', [config, { academic: 25, skills: 20, experience: 10, interests: 10, location: 10, preference: 10, semantic: 15 }, { requiredSkillsAreHardConstraint: true, semanticEnabled: false }])
    await db.query('insert into public."PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status) values($1,$2,$3,\'running\')', [run, period, config])
    for (let s = 0; s < students.length; s++) for (let p = 0; p < positions.length; p++) await db.query('insert into public."PYRUnibague_MatchCandidates"(id,matching_run_id,student_id,project_position_id,is_eligible,total_score) values($1,$2,$3,$4,true,95)', [candidates[s][p], run, students[s], positions[p]])
    await db.query('update public."PYRUnibague_MatchingRuns" set status=\'completed\',completed_at=now() where id=$1', [run]); await db.query('commit')
    return { actor, students, positions, period, run, candidates }
  } catch (error) { await db.query('rollback'); throw error }
}
for (const sameStudent of [false, true]) test(sameStudent ? 'two real confirmations cannot assign one student twice' : 'two real confirmations cannot overbook a position', { skip }, async () => {
  const observer = await connection(); const a = await connection(); const b = await connection()
  try {
    const fixture = await seed(observer)
    for (const db of [a, b]) { await db.query('begin'); await db.query('set local role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [fixture.actor]); await db.query("set local statement_timeout='15s'") }
    const revision = (await a.query('select public.pyr_unibague_assignment_snapshot($1,$2) as state', [fixture.period, fixture.run])).rows[0].state.revision
    const action = (s, p) => ({ kind: 'confirm', student_id: fixture.students[s], position_id: fixture.positions[p], candidate_id: fixture.candidates[s][p], source: 'MATCHING' })
    const sql = 'select public.pyr_unibague_confirm_assignment($1,$2,$3,$4::jsonb)'
    await a.query(sql, [fixture.period, fixture.run, revision, action(0, 0)])
    const pid = (await b.query('select pg_backend_pid() as pid')).rows[0].pid
    const pending = b.query(sql, [fixture.period, fixture.run, revision, sameStudent ? action(0, 1) : action(1, 0)]).then(() => 'UNEXPECTED_SUCCESS', e => e.code)
    let waited = false
    for (let i = 0; i < 80; i++) { const state = (await observer.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0]; if (state?.wait_event_type === 'Lock') { waited = true; break }; await delay(50) }
    assert.equal(waited, true, 'Second session must wait for the transactional serialization lock')
    await a.query('commit'); assert.equal(await pending, 'P0001', 'Second confirmation must reject its stale whole proposal'); await b.query('rollback')
    const count = (await observer.query('select count(*)::integer as count from public."PYRUnibague_Assignments" where academic_period_id=$1 and is_active', [fixture.period])).rows[0].count
    assert.equal(count, 1)
    const excess = (await observer.query('select count(*)::integer as count from (select pp.id from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_Assignments" a on a.project_position_id=pp.id and a.is_active where a.academic_period_id=$1 group by pp.id,pp.capacity having count(*)>pp.capacity) x', [fixture.period])).rows[0].count
    assert.equal(excess, 0, 'No destination exceeds capacity')
  } finally { await Promise.allSettled([a.query('rollback'), b.query('rollback')]); await Promise.allSettled([observer.end(), a.end(), b.end()]) }
})
