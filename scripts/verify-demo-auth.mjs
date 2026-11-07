import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
const ledger = JSON.parse(await readFile('work/p12/cuentas-test.local.json', 'utf8'))
const client = createClient('https://irykykwhvattrduuqxhj.supabase.co', 'sb_publishable_uqG76WLgB-WzdoZNX3Agag_er6FEhM3', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const results = []
for (const account of ledger.accounts) {
  const login = await client.auth.signInWithPassword({ email: account.email, password: account.password })
  if (login.error) throw new Error(`${account.role}: login failed (${login.error.code ?? login.error.message})`)
  const roles = await client.rpc('pyr_unibague_current_roles')
  if (roles.error || JSON.stringify(roles.data) !== JSON.stringify([account.role])) throw new Error(`${account.role}: persisted role mismatch`)
  results.push({ email: account.email, role: account.role, login: 'PASS', persisted_role: 'PASS' })
  await client.auth.signOut()
}
console.log(JSON.stringify(results))
