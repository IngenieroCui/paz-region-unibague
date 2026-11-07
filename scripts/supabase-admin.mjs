// Node-only. Never import from src/ or expose its environment to Vite.
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
export const ref = 'irykykwhvattrduuqxhj'
export const url = `https://${ref}.supabase.co`
export const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
export async function environment() {
  const files = []
  for (const path of ['.env', '.env.local', 'work/admin.env']) {
    try { files.push(parseEnv(await readFile(path, 'utf8'))) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  for (const file of [...files, process.env]) {
    if (file.VITE_SUPABASE_URL && file.VITE_SUPABASE_URL.replace(/\/$/, '') !== url) throw Error('Proyecto Supabase inesperado; ninguna petición realizada.')
  }
  const values = Object.assign({}, ...files, process.env)
  const key = values.VITE_SUPABASE_ANON_KEY
  if (!key || key.startsWith('sb_secret_')) throw Error('Falta una clave pública válida.')
  if (key.split('.').length === 3) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'))
    if (claims.role !== 'anon' || (claims.ref && claims.ref !== ref)) throw Error('Clave pública incompatible con el proyecto.')
  } else if (!key.startsWith('sb_publishable_')) throw Error('Clave pública no válida.')
  return values
}
function guardedFetch(input, init) {
  const target = new URL(typeof input === 'string' ? input : input.url ?? input)
  if (target.origin !== url) throw Error('Petición fuera del proyecto autorizado.')
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20000) })
}
export async function adminClient({ testInventory = false } = {}) {
  const values = await environment()
  const key = values.SUPABASE_SECRET_KEY
  if (!key) throw Error('Falta SUPABASE_SECRET_KEY en work/admin.env; Auth Admin no requiere PAT.')
  if (!key.startsWith('sb_secret_')) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url'))
    if (claims.role !== 'service_role' || claims.ref !== ref) throw Error('Clave administrativa incompatible.')
  }
  return createClient(url, key, { ...options, global: { fetch: (input, init) => {
    // Auth supports filter; the installed SDK exposes only pagination.
    const target = new URL(typeof input === 'string' ? input : input.url ?? input)
    if (testInventory && target.pathname === '/auth/v1/admin/users' && (!init?.method || init.method === 'GET')) target.searchParams.set('filter', 'pyrdemo.')
    return guardedFetch(target.href, init)
  } } })
}
export async function publicClient() {
  const values = await environment()
  return createClient(url, values.VITE_SUPABASE_ANON_KEY, { ...options, global: { fetch: guardedFetch } })
}
export function check(result, label) {
  // No request bodies, raw Auth errors, sessions or credentials in logs.
  if (result.error) throw Error(`${label}: ${result.error.code ?? result.error.status ?? result.status ?? 'error'}`)
  return result.data
}
