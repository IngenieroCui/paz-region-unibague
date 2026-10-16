import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const env = process.env
const postgresReady = Boolean(env.P6C_PG_MODULE && env.P6C_POSTGRES_URL && env.P6C_ALLOW_DISPOSABLE_TESTS === 'yes')
test('real Supabase/PostgreSQL pgTAP security, history, capacity and atomic batch checks', { skip: postgresReady ? false : 'SKIPPED: disposable PostgreSQL runtime/driver not configured.' }, async () => {
  const module = await import(env.P6C_PG_MODULE); const Client = module.Client ?? module.default.Client
  const db = new Client({ connectionString: env.P6C_POSTGRES_URL })
  try {
    await db.connect(); const results = await db.query(await readFile(new URL('../../supabase/tests/p6c_assignments.test.sql', import.meta.url), 'utf8'))
    const lines = (Array.isArray(results) ? results : [results]).flatMap(r => r.rows.flatMap(row => Object.values(row).filter(v => typeof v === 'string')))
    const failures = lines.filter(line => /^not ok\b|Looks like you failed/.test(line))
    assert.deepEqual(failures, []); assert.ok(lines.filter(line => /^ok\b/.test(line)).length >= 68)
  } finally { await db.query('rollback').catch(() => {}); await db.end() }
})
const httpReady = ['P6C_SUPABASE_URL','P6C_PUBLIC_KEY','P6C_STUDENT_JWT','P6C_ORGANIZATION_JWT','P6C_PERIOD_ID'].every(k => env[k])
for (const role of ['STUDENT', 'ORGANIZATION']) test(`real PostgREST ${role} cannot invoke administrative confirmation`, { skip: httpReady ? false : 'SKIPPED: isolated Supabase HTTP URL/key/JWT fixtures not configured.' }, async () => {
  const response = await fetch(`${env.P6C_SUPABASE_URL}/rest/v1/rpc/pyr_unibague_confirm_assignment`, { method: 'POST', headers: { apikey: env.P6C_PUBLIC_KEY, Authorization: `Bearer ${env[`P6C_${role}_JWT`]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_period_id: env.P6C_PERIOD_ID, p_run_id: null, p_revision: 'forged', p_action: {} }) })
  assert.equal(response.status, 403); assert.equal((await response.json()).code, '42501')
})
