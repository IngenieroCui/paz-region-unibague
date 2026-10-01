import { test } from 'node:test'
import assert from 'node:assert/strict'
const env = process.env
const keys = ['P5_SUPABASE_URL', 'P5_SUPABASE_ANON_KEY', 'P5_ADMIN_JWT', 'P5_STUDENT_JWT', 'P5_ORGANIZATION_JWT', 'P5_PERIOD_ID', 'P5_CONFIGURATION_ID']
const ready = keys.every(key => env[key])
const skip = ready ? false : 'SKIPPED: Supabase runtime and isolated test accounts/configuration not configured.'
const body = { academic_period_id: env.P5_PERIOD_ID, matching_configuration_id: env.P5_CONFIGURATION_ID }
async function run(jwt) { return fetch(env.P5_SUPABASE_URL + '/functions/v1/matching-run', { method: 'POST', headers: { apikey: env.P5_SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(150000) }) }
test('Supabase Edge rejects anon', { skip }, async () => { assert.equal((await run()).status, 401) })
for (const role of ['STUDENT', 'ORGANIZATION']) test(`Supabase Edge rejects ${role} and RLS hides candidates`, { skip }, async () => {
  assert.equal((await run(env[`P5_${role}_JWT`])).status, 403)
  const response = await fetch(env.P5_SUPABASE_URL + '/rest/v1/PYRUnibague_MatchCandidates?select=id&limit=1', { headers: { apikey: env.P5_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env[`P5_${role}_JWT`] } })
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), [])
})
test('Supabase ADMIN runs and reads its candidate history', { skip }, async () => {
  const response = await run(env.P5_ADMIN_JWT); assert.equal(response.status, 200)
  const result = await response.json(); assert.equal(result.summary.algorithm_version, 'hybrid-v0.1')
  const candidates = await fetch(env.P5_SUPABASE_URL + '/rest/v1/PYRUnibague_MatchCandidates?select=id&matching_run_id=eq.' + result.run_id, { headers: { apikey: env.P5_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.P5_ADMIN_JWT } })
  assert.equal(candidates.status, 200); assert.ok(Array.isArray(await candidates.json()))
})
