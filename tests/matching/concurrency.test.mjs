// Use only an isolated test database; successful test retains a failed test run.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
const env = process.env
const ready = ['P5_PG_MODULE', 'P5_POSTGRES_URL', 'P5_ADMIN_USER_ID', 'P5_PERIOD_ID', 'P5_CONFIGURATION_ID'].every(key => env[key])
test('two real PostgreSQL sessions cannot create running runs for the same combination', { skip: ready ? false : 'SKIPPED: isolated PostgreSQL runtime/driver/ADMIN fixture not configured.' }, async () => {
  const module = await import(env.P5_PG_MODULE)
  const Client = module.Client ?? module.default.Client
  const a = new Client({ connectionString: env.P5_POSTGRES_URL }); const b = new Client({ connectionString: env.P5_POSTGRES_URL })
  const observer = new Client({ connectionString: env.P5_POSTGRES_URL })
  let runId; let aCommitted = false
  try {
    await Promise.all([a.connect(), b.connect(), observer.connect()])
    for (const db of [a, b]) { await db.query('begin'); await db.query('set local role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [env.P5_ADMIN_USER_ID]); await db.query("set local statement_timeout='10s'") }
    const pid = (await b.query('select pg_backend_pid() as pid')).rows[0].pid
    const sql = 'insert into public."PYRUnibague_MatchingRuns"(academic_period_id,matching_configuration_id,status) values ($1,$2,\'running\') returning id'
    const args = [env.P5_PERIOD_ID, env.P5_CONFIGURATION_ID]
    runId = (await a.query(sql, args)).rows[0].id
    const pending = b.query(sql, args).then(() => ({ code: 'UNEXPECTED_SUCCESS' }), error => ({ code: error.code }))
    let lockObserved = false
    for (let attempt = 0; attempt < 50; attempt++) {
      // Only the administrative observer can inspect other sessions' wait events.
      // Keep the two competing writers authenticated; do not grant them pg_monitor.
      const wait = await observer.query("select wait_event_type from pg_stat_activity where pid=$1", [pid])
      if (wait.rows[0]?.wait_event_type === 'Lock') { lockObserved = true; break }
      await delay(50)
    }
    assert.equal(lockObserved, true, 'Second session must wait for configuration/index lock')
    await a.query('commit'); aCommitted = true
    assert.equal((await pending).code, '23505', 'Unique running combination must reject second session')
    await b.query('rollback')
  } finally {
    await Promise.allSettled([a.query('rollback'), b.query('rollback')])
    if (runId && aCommitted) {
      await a.query('begin'); await a.query('set local role authenticated'); await a.query("select set_config('request.jwt.claim.sub',$1,true)", [env.P5_ADMIN_USER_ID])
      await a.query('update public."PYRUnibague_MatchingRuns" set status=\'failed\',completed_at=now(),summary=summary||\'{"error":"CONCURRENCY_TEST_COMPLETE"}\'::jsonb where id=$1 and status=\'running\'', [runId])
      await a.query('commit')
    }
    await Promise.allSettled([a.end(), b.end(), observer.end()])
  }
})
