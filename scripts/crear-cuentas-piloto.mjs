// Auth Admin only; no SQL in auth.users, invitations or emails.
import { randomBytes } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { adminClient, publicClient, check, ref } from './supabase-admin.mjs'

const users = [
  ['estudiante','STUDENT'], ['estudiante2','STUDENT'], ['estudiante3','STUDENT'], ['estudiante4','STUDENT'],
  ['asesor','ADVISOR'], ['asesor2','ADVISOR'], ['entidad','ORGANIZATION'], ['entidad2','ORGANIZATION'], ['administrador','ADMIN'],
].map(([name, role]) => ({ email: `pyrprueba.${name}@${role === 'STUDENT' ? 'estudiantesunibague.edu.co' : 'unibague.edu.co'}`, role, display_name: `Pyrprueba ${name} (TEST)` }))
const apply = process.argv.includes('--apply')
const ledgerPath = resolve(process.env.PYR_P11_LEDGER || 'work/p11/cuentas-test.local.json')
await mkdir(dirname(ledgerPath), { recursive: true })
try { execFileSync('git', ['check-ignore', '--quiet', ledgerPath]) }
catch { throw Error('El registro privado debe estar dentro del repositorio e ignorado por Git.') }
let ledger = { project_ref: ref, accounts: [] }
try { ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
if (ledger.project_ref !== ref) throw Error('Registro de otro proyecto; no se reutilizan UUID ni contraseñas.')
if (process.env.PYR_P9_LEDGER) {
  const historical = JSON.parse(await readFile(process.env.PYR_P9_LEDGER, 'utf8'))
  if (historical.accounts.length !== 9 || users.some(u => !historical.accounts.some(a => a.email === u.email && a.role === u.role))) throw Error('Las cuentas no coinciden con P9.')
}
const admin = await adminClient({ testInventory: true })
const existing = check(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'Inventario TEST').users
if (existing.length >= 1000 || existing.some(u => !u.email?.startsWith('pyrprueba.'))) throw Error('Inventario TEST no acotado.')
const roles = check(await admin.from('PYRUnibague_Roles').select('id,code'), 'Catálogo de roles')
for (const u of users) if (!roles.some(r => r.code === u.role)) throw Error(`Falta rol persistido ${u.role}`)
for (const u of users) {
  const identity = existing.find(a => a.email?.toLowerCase() === u.email)
  // Metadata alone never proves ownership of a preexisting account.
  if (identity && (!ledger.accounts.some(a => a.email === u.email && a.user_id === identity.id && a.role === u.role) || identity.user_metadata?.pyr_test_account !== true)) throw Error(`Colisión TEST ${u.email}; cuenta no modificada.`)
}
const report = { checked_at: new Date().toISOString(), project: ref, mode: apply ? 'apply' : 'inventory', accounts: [] }
const persist = () => writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', { mode: 0o600 })
for (const u of users) {
  let identity = existing.find(a => a.email?.toLowerCase() === u.email)
  let account = ledger.accounts.find(a => a.email === u.email)
  const outcome = { email: u.email, role: u.role, existed: Boolean(identity), status: 'MISSING' }
  if (!apply) { outcome.status = identity ? 'EXISTS' : 'MISSING'; report.accounts.push(outcome); continue }
  try {
    if (!identity) {
      if (account?.user_id) throw Error('Identidad registrada ausente; revisar antes de recrear.')
      // Persist before mutation, preserving credentials after interruptions.
      if (!account) { account = { ...u, password: `PyR!${randomBytes(36).toString('base64url')}7x`, created_at: new Date().toISOString() }; ledger.accounts.push(account); await persist() }
      identity = check(await admin.auth.admin.createUser({ email: u.email, password: account.password, email_confirm: true, user_metadata: { display_name: u.display_name, pyr_test_account: true }, app_metadata: { pyr_test_batch: 'P11' } }), 'Crear TEST').user
      if (!identity?.id) throw Error('Auth no devolvió UUID.')
      account.user_id = identity.id; await persist()
    }
    const profile = check(await admin.from('PYRUnibague_UserProfiles').select('*').eq('user_id', identity.id).maybeSingle(), 'Consultar perfil')
    if (profile?.display_name && !profile.display_name.includes('(TEST)')) throw Error('Perfil no reconocido como TEST.')
    check(await admin.from('PYRUnibague_UserProfiles').upsert({ user_id: identity.id, display_name: u.display_name, institutional_email: u.email }, { onConflict: 'user_id' }), 'Guardar perfil TEST')
    const roleId = roles.find(r => r.code === u.role).id
    const assigned = check(await admin.from('PYRUnibague_UserRoles').select('role_id').eq('user_id', identity.id), 'Consultar permisos')
    if (assigned.some(r => r.role_id !== roleId)) throw Error('Permisos inesperados; no se reemplazan.')
    if (!assigned.length) check(await admin.from('PYRUnibague_UserRoles').insert({ user_id: identity.id, role_id: roleId }), 'Asignar rol TEST')
    if (u.role === 'ADVISOR') {
      const staff = check(await admin.from('PYRUnibague_StaffProfiles').select('*').eq('user_id', identity.id).maybeSingle(), 'Consultar StaffProfile')
      if (!staff) check(await admin.from('PYRUnibague_StaffProfiles').insert({ user_id: identity.id, staff_code: `TEST-P11-${u.email.split('@')[0]}`, academic_unit: 'TEST · Paz y Región', status: 'active' }), 'Crear StaffProfile TEST')
    }
    const client = await publicClient()
    try {
      const login = check(await client.auth.signInWithPassword({ email: u.email, password: account.password }), 'Login TEST')
      if (login.user.id !== identity.id) throw Error('UUID inesperado.')
      const codes = check(await client.rpc('pyr_unibague_current_roles'), 'Roles persistidos')
      if (JSON.stringify(codes) !== JSON.stringify([u.role])) throw Error('Rol de sesión inesperado.')
      outcome.status = 'PASS'; outcome.login = true; outcome.profile = true; outcome.persisted_role = true
      if (u.role === 'ADVISOR') outcome.staff_profile = true
    } finally { await client.auth.signOut() }
  } catch (error) { outcome.status = 'FAIL'; outcome.error = error.message; process.exitCode = 1 }
  report.accounts.push(outcome)
  console.log(u.role, u.email, outcome.status, outcome.error ?? '')
}
await mkdir('docs/p11', { recursive: true })
await writeFile('docs/p11/accounts.json', JSON.stringify(report, null, 2) + '\n')
console.log('Credenciales: work/p11/cuentas-test.local.json (ignorado). Informe: docs/p11/accounts.json')
