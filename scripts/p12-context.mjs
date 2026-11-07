// Node only. The scenario never creates Auth identities, roles, fake candidates or notifications.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { adminClient, publicClient, environment, check, ref, url } from './supabase-admin.mjs'
export { check, ref, url }
export const SCENARIO = 'PYR-DEMO-2026B'
export const directory = 'work/p12'
export const table = (c, name) => c.from('PYRUnibague_' + name)
export async function rows(c, name, filter = {}) {
  const result = []
  for (let start = 0; ; start += 500) {
    const page = check(await table(c, name).select('*').match(filter).order('id').range(start, start + 499), name)
    result.push(...page)
    if (page.length < 500) return result
  }
}
export async function save(name, value) {
  await mkdir(directory, { recursive: true })
  const path = `${directory}/${name}`
  const temporary = path + '.' + randomUUID() + '.tmp'
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  await rename(temporary, path)
}
export async function context() {
  execFileSync('git', ['check-ignore', '--quiet', resolve(directory + '/manifest.local.json')])
  const ledger = JSON.parse(await readFile(process.env.PYR_P12_LEDGER || 'work/p12/cuentas-test.local.json', 'utf8'))
  validateLedger(ledger)
  const service = await adminClient()
  const clients = []
  try {
    for (const account of ledger.accounts) {
      const identity = check(await service.auth.admin.getUserById(account.user_id), 'Identidad TEST').user
      assert.equal(identity.email, account.email)
      assert.equal(identity.user_metadata?.pyr_test_account, true)
      const client = await publicClient()
      const signed = check(await client.auth.signInWithPassword({ email: account.email, password: account.password }), 'Login TEST')
      clients.push({ account, client })
      assert.equal(signed.user.id, account.user_id)
      assert.deepEqual(check(await client.rpc('pyr_unibague_current_roles'), 'Roles persistidos'), [account.role])
      const profile = check(await table(client, 'UserProfiles').select('*').eq('user_id', account.user_id).single(), 'Perfil TEST')
      assert.equal(profile.institutional_email, account.email)
      assert.match(profile.display_name, /\(TEST\)/)
    }
    const admin = clients.find(x => x.account.role === 'ADMIN').client
    const byRole = role => clients.filter(x => x.account.role === role)
    return { service, admin, clients, byRole, close: () => Promise.all(clients.map(x => x.client.auth.signOut())) }
  } catch (error) { await Promise.all(clients.map(x => x.client.auth.signOut())); throw error }
}
export function validateLedger(ledger) {
  assert.equal(ledger.project_ref, ref, 'Registro de otro proyecto')
  assert.equal(ledger.accounts.length, 9)
  const expected = [['estudiante','STUDENT'], ['estudiante2','STUDENT'], ['estudiante3','STUDENT'], ['estudiante4','STUDENT'], ['asesor','ADVISOR'], ['asesor2','ADVISOR'], ['entidad','ORGANIZATION'], ['entidad2','ORGANIZATION'], ['administrador','ADMIN']]
  assert.equal(new Set(ledger.accounts.map(x => x.user_id)).size, 9, 'UUID duplicado')
  for (const [name, role] of expected) assert.ok(ledger.accounts.some(x => x.email === `pyrdemo.${name}@${role === 'STUDENT' ? 'estudiantesunibague.edu.co' : 'unibague.edu.co'}` && x.role === role && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x.user_id)), 'Registro TEST incompatible')
}
export async function inspect(ctx) {
  const env = await environment()
  const response = await fetch(url + '/rest/v1/', { headers: { apikey: env.SUPABASE_SECRET_KEY }, signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200, 'No se pudo inspeccionar OpenAPI administrativo')
  const schema = await response.json()
  const definitions = Object.fromEntries(Object.entries(schema.definitions).filter(([name]) => name.startsWith('PYRUnibague_')))
  const rpc = Object.fromEntries(Object.entries(schema.paths).filter(([name]) => name.startsWith('/rpc/pyr_unibague_')))
  await save('contracts.local.json', { project_ref: ref, definitions, rpc })
  // Only prerequisites needed for this demo. Institutional onboarding RPCs and PAT
  // migration certification are unrelated to seeding this already-migrated demo.
  const blockers = ['AcademicPeriods','Students','Organizations','Projects','ProjectPositions','MatchingConfigurations'].filter(name => !definitions['PYRUnibague_' + name]).map(name => 'Falta tabla ' + name)
  const session = check(await ctx.admin.auth.getSession(), 'Sesión ADMIN').session
  const edge = await fetch(url + '/functions/v1/matching-run', { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token }, signal: AbortSignal.timeout(20000) })
  if (edge.status !== 405) blockers.push(`matching-run no disponible: HTTP ${edge.status}`)
  const sql = { status: 'NOT_REQUIRED', reason: 'Migraciones demo ya confirmadas; las operaciones se verifican con sesiones reales y RLS.' }
  const report = { checked_at: new Date().toISOString(), project_ref: ref, tables: Object.keys(definitions).length, rpc: Object.keys(rpc).length, edge_http: edge.status, sql, blockers }
  await save('preflight.local.json', report)
  return report
}
export async function readManifest() {
  let m
  try { m = JSON.parse(await readFile(directory + '/manifest.local.json', 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error; m = { version: 1, project_ref: ref, scenario: SCENARIO, records: {}, operations: {} } }
  assert.equal(m.project_ref, ref); assert.equal(m.scenario, SCENARIO); assert.equal(m.version, 1)
  return m
}
export async function lock() {
  await mkdir(directory, { recursive: true })
  const path = directory + '/seed.lock'
  const handle = await open(path, 'wx')
  await handle.writeFile(String(process.pid))
  return async () => { await handle.close(); await unlink(path) }
}
export function writer(manifest, persist = () => save('manifest.local.json', manifest)) {
  async function ensure(c, name, key, filter, fields = {}) {
    const existing = await rows(c, name, filter)
    assert.ok(existing.length <= 1, `Colisión ambigua: ${key}`)
    const prior = manifest.records[key]
    if (existing[0]) {
      if (prior) assert.equal(existing[0].id, prior.id, `Identidad modificada: ${key}`)
      else manifest.records[key] = { table: name, id: existing[0].id, created: false, filter }
      await persist()
      return existing[0]
    }
    if (prior?.created === false) throw Error(`Registro reutilizado desapareció: ${key}; requiere revisión`)
    // Write intent BEFORE the request: an uncertain commit is recovered by id, never duplicated.
    const record = prior ?? { table: name, id: randomUUID(), created: true, filter }
    manifest.records[key] = record
    await persist()
    return check(await table(c, name).insert({ id: record.id, ...filter, ...fields }).select('*').single(), 'Crear ' + name)
  }
  async function update(c, name, id, fields) {
    const current = check(await table(c, name).select('*').eq('id', id).single(), 'Leer ' + name)
    if (Object.entries(fields).every(([k,v]) => JSON.stringify(current[k]) === JSON.stringify(v))) return current
    return check(await table(c, name).update(fields).eq('id', id).select('*').single(), 'Actualizar ' + name)
  }
  return { ensure, update, persist }
}
