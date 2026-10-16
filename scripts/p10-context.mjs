import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
export const ref = 'flrdqhemgbrdclgeynpk'
export const url = `https://${ref}.supabase.co`
export const expected = [
 ['6407bfc1-3c2e-42a1-acb9-900a22d3c201','STUDENT'],
 ['2f9ea050-8343-48ec-af31-dea5ed6cce51','STUDENT'],
 ['97977b5b-0fe8-44b6-b410-e89cde91ca62','STUDENT'],
 ['1c0fa87b-9ea2-467c-a5d9-ab57265fc563','STUDENT'],
 ['5387d4dc-24a3-4345-a365-ffcbc0740baf','ADMIN'],
 ['2ab1f908-67d9-4b4a-85f0-bba7cb97a7ed','ADVISOR'],
 ['08aae3aa-9c39-42f7-85ca-cbd255b5a756','ADVISOR'],
 ['409f5da2-fccd-453c-b580-3bd5683e0529','ORGANIZATION'],
 ['54379aff-0d7f-4886-a523-ef1fb9cd4682','ORGANIZATION'],
]
export const ledgerPath = process.env.PYR_P10_LEDGER || 'work/p9/cuentas-institucionales.local.json'
export const ledger = JSON.parse(await readFile(ledgerPath,'utf8'))
if (ledger.project_ref !== ref || ledger.accounts.length !== 9 || expected.some(([id,role])=>!ledger.accounts.some(a=>a.user_id===id&&a.role===role&&a.email.startsWith('pyrprueba.')))) throw Error('Registro P9 incompatible; ninguna identidad puede modificarse.')
const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
export const check = (r,label) => { if(r.error) throw Error(`${label}: ${r.error.code ?? r.error.status ?? ''} ${r.error.message}`); return r.data }
export async function management(path,body) {
 const file = process.env.PYR_ADMIN_ENV_FILE
 const local = file ? parseEnv(await readFile(file,'utf8')) : {}
 const token = process.env.SUPABASE_ACCESS_TOKEN || local.SUPABASE_ACCESS_TOKEN
 if(!token) throw Error('Falta acceso administrativo local; no pegar secretos en consola.')
 const r = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)})
 if(!r.ok) throw Error(`Management ${path}: HTTP ${r.status}`)
 return r.json()
}
export async function adminClient() {
 const keys = await management('/api-keys?reveal=true')
 const key = keys.find(k=>k.type==='secret'&&!k.disabled)?.api_key || keys.find(k=>k.name==='service_role')?.api_key
 if(!key) throw Error('No se encontró clave administrativa existente.')
 return createClient(url,key,options)
}
export async function publicClient() {
 const local = parseEnv(await readFile('.env.local','utf8'))
 if(local.VITE_SUPABASE_URL!==url) throw Error('Entorno diferente del piloto autorizado.')
 return createClient(url,local.VITE_SUPABASE_ANON_KEY,options)
}
export async function login(account) {
 const c=await publicClient()
 const data=check(await c.auth.signInWithPassword({email:account.email,password:account.password}),'Login TEST')
 if(data.user.id!==account.user_id) throw Error('Identidad de login inesperada')
 const roles=check(await c.rpc('pyr_unibague_current_roles'),'Roles persistidos')
 if(JSON.stringify(roles)!==JSON.stringify([account.role])) throw Error('Rol persistido inesperado')
 return c
}
export async function save(name,value) {
 await mkdir('work/p10',{recursive:true})
 await writeFile(`work/p10/${name}`,JSON.stringify(value,null,2)+'\n',{mode:0o600})
}
