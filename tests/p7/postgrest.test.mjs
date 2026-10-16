// Real HTTP only; requires pre-provisioned disposable test users/data. No mocks,
// schema changes, project creation, service key or production access.
import { test } from 'node:test'
import assert from 'node:assert/strict'
const env = process.env
const base = Boolean(env.P7_ALLOW_DISPOSABLE_TESTS === 'yes' && env.P7_SUPABASE_URL && env.P7_PUBLIC_KEY)
const ready = (...keys) => base && keys.every(key => env[key])
const skip = 'SKIPPED: real disposable Supabase HTTP/JWT fixtures unavailable.'
async function request(path, jwt, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(env.P7_SUPABASE_URL + path, {
    method, headers: { apikey: env.P7_PUBLIC_KEY, Authorization: 'Bearer ' + jwt, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: response.status, data: await response.json() }
}
for (const role of ['STUDENT', 'ORGANIZATION', 'ADVISOR', 'ADMIN']) {
  const key = `P7_${role}_JWT`
  test(`real Auth validates ${role} JWT and persisted roles`, { skip: ready(key) ? false : skip }, async () => {
    const user = await request('/auth/v1/user', env[key])
    assert.equal(user.status, 200); assert.equal(typeof user.data.id, 'string')
    const roles = await request('/rest/v1/rpc/pyr_unibague_current_roles', env[key], {})
    assert.equal(roles.status, 200); assert.ok(roles.data.includes(role))
  })
  if (role !== 'ADMIN') test(`real PostgREST rejects ${role} operational export and summary`, { skip: ready(key, 'P7_PERIOD_ID') ? false : skip }, async () => {
    for (const [rpc, body] of [['operational_export', { p_period_id: env.P7_PERIOD_ID, p_kind: 'assignments' }], ['operational_summary', { p_period_id: env.P7_PERIOD_ID }]]) {
      const result = await request('/rest/v1/rpc/pyr_unibague_' + rpc, env[key], body)
      assert.equal(result.status, 403); assert.equal(result.data.code, '42501')
    }
  })
}
test('real notifications are visible and writable only by their recipient', { skip: ready('P7_STUDENT_JWT', 'P7_OTHER_STUDENT_JWT', 'P7_NOTIFICATION_ID') ? false : skip }, async () => {
  const path = '/rest/v1/PYRUnibague_Notifications?select=id,read_at&id=eq.' + encodeURIComponent(env.P7_NOTIFICATION_ID)
  const own = await request(path, env.P7_STUDENT_JWT), foreign = await request(path, env.P7_OTHER_STUDENT_JWT)
  assert.equal(own.status, 200); assert.equal(own.data.length, 1)
  assert.equal(foreign.status, 200); assert.deepEqual(foreign.data, [])
  const denied = await request('/rest/v1/rpc/pyr_unibague_mark_notification_read', env.P7_OTHER_STUDENT_JWT, { notification_id: env.P7_NOTIFICATION_ID })
  assert.equal(denied.status, 200); assert.equal(denied.data, false)
  const marked = await request('/rest/v1/rpc/pyr_unibague_mark_notification_read', env.P7_STUDENT_JWT, { notification_id: env.P7_NOTIFICATION_ID })
  assert.equal(marked.status, 200); assert.equal(marked.data, true)
})
test('real organization and advisor cannot read a foreign project projection', { skip: ready('P7_ORGANIZATION_JWT', 'P7_ADVISOR_JWT', 'P7_FOREIGN_PROJECT_ID') ? false : skip }, async () => {
  for (const [rpc, jwt] of [['project_team', env.P7_ORGANIZATION_JWT], ['advisor_project_team', env.P7_ADVISOR_JWT]]) {
    const result = await request('/rest/v1/rpc/pyr_unibague_' + rpc, jwt, { p_project_id: env.P7_FOREIGN_PROJECT_ID })
    assert.equal(result.status, 403); assert.equal(result.data.code, '42501')
  }
})
test('real private Storage signs own test object and denies foreign ownership', { skip: ready('P7_STUDENT_JWT', 'P7_OTHER_STUDENT_JWT', 'P7_PRIVATE_BUCKET', 'P7_PRIVATE_OBJECT_PATH') ? false : skip }, async () => {
  const bucket = encodeURIComponent(env.P7_PRIVATE_BUCKET), object = env.P7_PRIVATE_OBJECT_PATH.split('/').map(encodeURIComponent).join('/')
  const path = '/storage/v1/object/sign/' + bucket + '/' + object
  const own = await request(path, env.P7_STUDENT_JWT, { expiresIn: 60 })
  assert.equal(own.status, 200); assert.equal(typeof own.data.signedURL, 'string')
  const foreign = await request(path, env.P7_OTHER_STUDENT_JWT, { expiresIn: 60 })
  assert.ok([400, 403, 404].includes(foreign.status))
  const publicObject = await fetch(env.P7_SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + object)
  assert.ok([400, 403, 404].includes(publicObject.status))
})
